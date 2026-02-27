"""Custom CSV format import endpoints: analyze, auto-detect, preview, confirm, and CRUD."""

from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel as PydanticBaseModel

from app.database import get_session
from app.orm import CustomFormatConfig, ImportFormatType, ReconciliationStatus, Transaction
from app.schemas import CustomFormatConfigCreate, CustomFormatConfigUpdate
from app.parsers import (
    ParserRegistry,
    CustomCsvParser,
    CustomCsvConfig,
    analyze_csv_columns,
    find_header_row,
    compute_header_signature,
)
from app.tag_inference import infer_bucket_tag
from app.utils.hashing import compute_transaction_hash_from_dict
from app.errors import ErrorCode, not_found, bad_request
from app.routers.import_helpers import (
    apply_bucket_tag,
    apply_merchant_alias,
    get_merchant_aliases,
    get_or_create_account_tag,
)
from app.orm import ImportSession

router = APIRouter(prefix="/api/v1/import", tags=["import"])


# ============================================================================
# Custom CSV Format Endpoints
# ============================================================================


class AnalyzeResponse(PydanticBaseModel):
    """Response from CSV analysis endpoint"""

    headers: List[str]
    sample_rows: List[List[str]]
    column_hints: Dict[str, Any]
    row_count: int
    detected_format: Optional[str] = None
    format_confidence: Optional[float] = None
    suggested_config: Optional[Dict[str, Any]] = None


class CustomPreviewRequest(PydanticBaseModel):
    """Request for custom format preview"""

    config: Dict[str, Any]  # CustomCsvConfig as dict


class CustomPreviewResponse(PydanticBaseModel):
    """Response from custom format preview"""

    transaction_count: int
    transactions: List[Dict[str, Any]]
    total_amount: float
    errors: List[str]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_csv_file(
    file: UploadFile = File(..., description="CSV file to analyze"),
    skip_rows: int = Form(0, description="Number of rows to skip before header"),
):
    """
    Analyze a CSV file and return column information with auto-detection hints.

    Use this before creating a custom format configuration to understand
    the structure of the CSV file.

    Returns:
    - **headers**: Column names from the CSV
    - **sample_rows**: First 5 data rows for preview
    - **column_hints**: Auto-detected column types and formats
    - **row_count**: Total number of data rows
    - **detected_format**: Auto-detected file format (if recognized)
    - **format_confidence**: Confidence score for detected format (0-1)
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise bad_request(
            ErrorCode.IMPORT_UNSUPPORTED_FORMAT, "Only CSV files can be analyzed for custom format creation"
        )

    content = await file.read()
    csv_content = content.decode("utf-8")

    analysis = analyze_csv_columns(csv_content, skip_rows)

    # Count total rows
    lines = csv_content.strip().split("\n")
    row_count = max(0, len(lines) - 1 - skip_rows)  # Subtract header and skipped rows

    # Try to detect known format
    detected_format: Optional[str] = None
    format_confidence: Optional[float] = None
    try:
        parser, confidence = ParserRegistry.detect_format(csv_content)
        if parser:
            detected_format = parser.format_key
            format_confidence = confidence
    except Exception:
        pass  # Format detection failed, leave as None

    return AnalyzeResponse(
        headers=analysis["headers"],
        sample_rows=analysis["sample_rows"],
        column_hints=analysis["column_hints"],
        row_count=row_count,
        detected_format=detected_format,
        format_confidence=format_confidence,
        suggested_config=analysis.get("suggested_config"),
    )


class AutoDetectResponse(PydanticBaseModel):
    """Response from auto-detect endpoint"""

    analysis: Dict[str, Any]  # Same as AnalyzeResponse
    config: Optional[Dict[str, Any]]  # Suggested config
    skip_rows: int  # Number of header rows to skip
    detection_successful: bool
    matched_config: Optional[Dict[str, Any]] = None  # Matched saved config by signature
    header_signature: Optional[str] = None  # Computed signature for this file


@router.post("/custom/auto-detect")
async def auto_detect_csv_format_endpoint(
    file: UploadFile = File(..., description="CSV file to auto-detect"),
    session: AsyncSession = Depends(get_session),
):
    """
    Auto-detect CSV format including header row location and column mappings.

    This is a convenience endpoint that combines header detection and column analysis.
    Use this when you don't know anything about the CSV structure.

    The endpoint first checks for a saved custom format with a matching header signature.
    If found, it returns the saved configuration with matched_config populated.

    Returns:
    - **analysis**: Column headers, sample rows, and hints (with confidence scores)
    - **config**: Suggested configuration for parsing
    - **skip_rows**: Number of rows to skip before the header
    - **detection_successful**: Whether all required columns were detected
    - **matched_config**: Saved config that matches this file's header signature (if any)
    - **header_signature**: Computed signature for this file's headers
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise bad_request(ErrorCode.IMPORT_UNSUPPORTED_FORMAT, "Only CSV files can be auto-detected")

    content = await file.read()
    csv_content = content.decode("utf-8")

    # Step 1: Find the header row
    header_result = find_header_row(csv_content)
    skip_rows = 0
    headers: List[str] = []
    if header_result:
        skip_rows, headers = header_result

    # Step 2: Compute header signature
    header_signature = None
    matched_config = None
    if headers:
        header_signature = compute_header_signature(headers)

        # Step 3: Look for saved config with matching signature
        result = await session.execute(
            select(CustomFormatConfig).where(CustomFormatConfig.header_signature == header_signature)
        )
        saved_config = result.scalar_one_or_none()
        if saved_config:
            import json

            matched_config = {
                "id": saved_config.id,
                "name": saved_config.name,
                "description": saved_config.description,
                "config": json.loads(saved_config.config_json),
                "use_count": saved_config.use_count,
            }

    # Step 4: Analyze columns with the detected header row
    analysis = analyze_csv_columns(csv_content, skip_rows)

    # Step 5: Get suggested config (fallback if no signature match)
    suggested = analysis.get("suggested_config", {})

    # Determine if detection was successful
    detection_successful = (
        suggested.get("date_column") is not None
        and suggested.get("amount_column") is not None
        and suggested.get("description_column") is not None
    ) or matched_config is not None

    return {
        "analysis": analysis,
        "config": suggested,
        "skip_rows": skip_rows,
        "detection_successful": detection_successful,
        "matched_config": matched_config,
        "header_signature": header_signature,
    }


@router.post("/custom/preview", response_model=CustomPreviewResponse)
async def preview_custom_import(
    file: UploadFile = File(..., description="CSV file to preview"),
    config_json: str = Form(..., description="CustomCsvConfig as JSON string"),
    session: AsyncSession = Depends(get_session),
):
    """
    Preview import using a custom CSV format configuration.

    This lets you test your column mappings before saving the configuration.
    The config_json should be a JSON object matching the CustomCsvConfig structure.

    Returns:
    - **transaction_count**: Number of transactions parsed
    - **transactions**: Preview of first 100 transactions
    - **total_amount**: Sum of all transaction amounts
    - **errors**: Any parsing errors encountered
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise bad_request(ErrorCode.IMPORT_UNSUPPORTED_FORMAT, "Custom format preview only supports CSV files")

    content = await file.read()
    csv_content = content.decode("utf-8")

    errors = []
    try:
        config = CustomCsvConfig.from_json(config_json)
    except Exception as e:
        raise bad_request(ErrorCode.IMPORT_PARSE_ERROR, f"Invalid config JSON: {str(e)}")

    try:
        parser = CustomCsvParser(config)
        parsed_transactions = parser.parse(csv_content)
    except Exception as e:
        errors.append(f"Parse error: {str(e)}")
        return CustomPreviewResponse(transaction_count=0, transactions=[], total_amount=0.0, errors=errors)

    # Convert ParsedTransaction objects to dicts
    transactions = [t.to_dict() for t in parsed_transactions]

    # Add bucket tag suggestions
    all_txns_result = await session.execute(select(Transaction).where(Transaction.category.isnot(None)))
    all_txns = all_txns_result.scalars().all()
    user_history: Dict[str, str] = {}
    for db_txn in all_txns:
        if db_txn.merchant and db_txn.category:
            merchant = db_txn.merchant.lower()
            bucket_value = db_txn.category.lower().replace(" ", "-").replace("&", "and")
            user_history[merchant] = f"bucket:{bucket_value}"

    for txn in transactions:
        suggestions = infer_bucket_tag(
            txn.get("merchant", ""), txn.get("description", ""), txn.get("amount", 0), user_history
        )
        if suggestions:
            tag = suggestions[0][0]
            bucket_value = tag.split(":", 1)[1] if ":" in tag else tag
            txn["bucket"] = bucket_value
            txn["bucket_tag"] = tag

    total_amount = sum(t.amount for t in parsed_transactions)

    return CustomPreviewResponse(
        transaction_count=len(transactions), transactions=transactions[:100], total_amount=total_amount, errors=errors
    )


@router.post("/custom/confirm")
async def confirm_custom_import(
    file: UploadFile = File(..., description="CSV file to import"),
    config_json: str = Form(..., description="CustomCsvConfig as JSON string"),
    save_config: bool = Form(False, description="Save the config for future use"),
    header_signature: Optional[str] = Form(
        None, description="Header signature for auto-matching (computed by auto-detect)"
    ),
    session: AsyncSession = Depends(get_session),
):
    """
    Confirm and import transactions using a custom CSV format configuration.

    This is the final step after previewing with /custom/preview.
    Parses the CSV file with the custom config and saves transactions to database.

    Returns:
    - **imported**: Number of new transactions imported
    - **duplicates**: Number of duplicates skipped
    - **config_saved**: Whether the config was saved for future use
    - **import_session_id**: ID for tracking this import batch
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise bad_request(ErrorCode.IMPORT_UNSUPPORTED_FORMAT, "Custom format import only supports CSV files")

    content = await file.read()
    csv_content = content.decode("utf-8")

    # Parse and validate config
    try:
        config = CustomCsvConfig.from_json(config_json)
    except Exception as e:
        raise bad_request(ErrorCode.IMPORT_PARSE_ERROR, f"Invalid config JSON: {str(e)}")

    # Parse transactions
    try:
        parser = CustomCsvParser(config)
        parsed_transactions = parser.parse(csv_content)
    except Exception as e:
        raise bad_request(ErrorCode.IMPORT_PARSE_ERROR, f"Parse error: {str(e)}")

    if not parsed_transactions:
        raise bad_request(ErrorCode.IMPORT_NO_TRANSACTIONS)

    # Build user history for bucket tag suggestions
    all_txns_result = await session.execute(select(Transaction).where(Transaction.category.isnot(None)))
    all_txns = all_txns_result.scalars().all()
    user_history: Dict[str, str] = {}
    for db_txn in all_txns:
        if db_txn.merchant and db_txn.category:
            merchant = db_txn.merchant.lower()
            bucket_value = db_txn.category.lower().replace(" ", "-").replace("&", "and")
            user_history[merchant] = f"bucket:{bucket_value}"

    # Load merchant aliases for normalization
    merchant_aliases = await get_merchant_aliases(session)

    # Create import session
    import_session = ImportSession(
        filename=file.filename,
        format_type=ImportFormatType.custom,
        account_source=config.account_source,
        transaction_count=0,
        duplicate_count=0,
        total_amount=0.0,
        status="in_progress",
    )
    session.add(import_session)
    await session.flush()

    # Import transactions
    imported_count = 0
    duplicate_count = 0
    total_amount = 0.0
    dates = []
    cross_account_warnings = []

    for parsed_txn in parsed_transactions:
        txn_data = parsed_txn.to_dict()

        # Generate hashes for deduplication
        content_hash = compute_transaction_hash_from_dict(txn_data, include_account=True)
        content_hash_no_account = compute_transaction_hash_from_dict(txn_data, include_account=False)

        # Check for exact duplicate
        if content_hash:
            dup_query = select(Transaction).where(Transaction.content_hash == content_hash)
            result = await session.execute(dup_query)
            existing = result.scalar_one_or_none()

            if existing:
                duplicate_count += 1
                continue

            # Check for cross-account duplicate
            if content_hash_no_account:
                cross_query = select(Transaction).where(
                    Transaction.content_hash_no_account == content_hash_no_account,
                    Transaction.account_source != txn_data["account_source"],
                )
                result = await session.execute(cross_query)
                cross_match = result.scalar_one_or_none()

                if cross_match:
                    cross_account_warnings.append(
                        {
                            "date": str(txn_data["date"]),
                            "amount": txn_data["amount"],
                            "description": txn_data["description"][:50],
                            "existing_account": cross_match.account_source,
                            "importing_account": txn_data["account_source"],
                        }
                    )

        # Infer bucket tag
        suggestions = infer_bucket_tag(
            txn_data.get("merchant", ""), txn_data.get("description", ""), txn_data.get("amount", 0), user_history
        )

        if suggestions:
            bucket_tag = suggestions[0][0]
            bucket_value = bucket_tag.split(":", 1)[1] if ":" in bucket_tag else "none"
        else:
            bucket_value = "none"

        category_display = bucket_value.replace("-", " ").title() if bucket_value != "none" else None

        # Apply merchant alias
        merchant_name = txn_data.get("merchant")
        if merchant_aliases:
            aliased_merchant = apply_merchant_alias(txn_data["description"], merchant_aliases)
            if aliased_merchant:
                merchant_name = aliased_merchant

        # Create transaction
        db_transaction = Transaction(
            date=txn_data["date"],
            amount=txn_data["amount"],
            description=txn_data["description"],
            merchant=merchant_name,
            account_source=txn_data["account_source"],
            card_member=txn_data.get("card_member"),
            category=category_display,
            reconciliation_status=ReconciliationStatus.unreconciled,
            reference_id=txn_data.get("reference_id"),
            import_session_id=import_session.id,
            content_hash=content_hash,
            content_hash_no_account=content_hash_no_account,
        )

        # Set account_tag_id
        if txn_data["account_source"]:
            account_tag = await get_or_create_account_tag(session, txn_data["account_source"])
            db_transaction.account_tag_id = account_tag.id

        session.add(db_transaction)
        await session.flush()

        # Apply bucket tag
        await apply_bucket_tag(session, db_transaction.id, bucket_value)

        imported_count += 1
        total_amount += txn_data["amount"]
        dates.append(txn_data["date"])

    # Update import session
    import_session.transaction_count = imported_count
    import_session.duplicate_count = duplicate_count
    import_session.total_amount = total_amount
    import_session.status = "completed"
    if dates:
        import_session.date_range_start = min(dates)
        import_session.date_range_end = max(dates)

    # Save config if requested
    config_saved = False
    if save_config:
        # Check if config with same name exists
        config_result = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.name == config.name))
        existing_config = config_result.scalar_one_or_none()

        if existing_config:
            # Update existing config
            existing_config.config_json = config_json
            existing_config.use_count += 1
            existing_config.updated_at = datetime.utcnow()
            # Update signature if provided
            if header_signature:
                existing_config.header_signature = header_signature
        else:
            # Create new config with signature for auto-matching
            new_config = CustomFormatConfig(
                name=config.name,
                config_json=config_json,
                use_count=1,
                header_signature=header_signature,
            )
            session.add(new_config)

        config_saved = True

    await session.commit()

    response: Dict[str, Any] = {
        "imported": imported_count,
        "duplicates": duplicate_count,
        "config_saved": config_saved,
        "import_session_id": import_session.id,
    }

    if cross_account_warnings:
        response["cross_account_warnings"] = cross_account_warnings[:10]
        response["cross_account_warning_count"] = len(cross_account_warnings)

    return response


# ============================================================================
# Custom Format Configuration CRUD
# ============================================================================


@router.post("/custom/configs")
async def create_custom_config(config: CustomFormatConfigCreate, session: AsyncSession = Depends(get_session)):
    """
    Save a custom CSV format configuration.

    The config_json should be a JSON string containing:
    - name: Display name for the format
    - account_source: Default account source for imports
    - date_column, amount_column, description_column: Required column mappings
    - Optional: merchant_column, reference_column, category_column, card_member_column
    - date_format: strptime format string (default: "%m/%d/%Y")
    - amount_sign_convention: "negative_prefix", "parentheses", or "plus_minus"
    - row_handling: { skip_header_rows, skip_footer_rows, skip_patterns }

    The header_signature is optional but recommended for auto-matching. It should be
    computed from the CSV headers using the /custom/auto-detect endpoint.
    """
    # Validate the config JSON
    try:
        CustomCsvConfig.from_json(config.config_json)
    except Exception as e:
        raise bad_request(ErrorCode.IMPORT_PARSE_ERROR, f"Invalid config JSON: {str(e)}")

    # Check for duplicate name
    result = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.name == config.name))
    if result.scalar_one_or_none():
        raise bad_request(
            ErrorCode.VALIDATION_ERROR, f"A configuration named '{config.name}' already exists", config_name=config.name
        )

    db_config = CustomFormatConfig(
        name=config.name,
        description=config.description,
        config_json=config.config_json,
        header_signature=config.header_signature,  # Store signature for auto-matching
    )
    session.add(db_config)
    await session.commit()
    await session.refresh(db_config)

    return db_config


@router.get("/custom/configs")
async def list_custom_configs(session: AsyncSession = Depends(get_session)):
    """List all saved custom CSV format configurations, ordered by usage count."""
    result = await session.execute(select(CustomFormatConfig).order_by(CustomFormatConfig.use_count.desc()))
    return result.scalars().all()


@router.get("/custom/configs/{config_id}")
async def get_custom_config(config_id: int, session: AsyncSession = Depends(get_session)):
    """Get a specific custom CSV format configuration."""
    result = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise not_found(ErrorCode.IMPORT_CONFIG_NOT_FOUND, config_id=config_id)
    return config


@router.put("/custom/configs/{config_id}")
async def update_custom_config(
    config_id: int, update: CustomFormatConfigUpdate, session: AsyncSession = Depends(get_session)
):
    """Update a custom CSV format configuration."""
    result = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise not_found(ErrorCode.IMPORT_CONFIG_NOT_FOUND, config_id=config_id)

    # Validate config_json if provided
    if update.config_json:
        try:
            CustomCsvConfig.from_json(update.config_json)
        except Exception as e:
            raise bad_request(ErrorCode.IMPORT_PARSE_ERROR, f"Invalid config JSON: {str(e)}")

    # Check for duplicate name
    if update.name and update.name != config.name:
        existing = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.name == update.name))
        if existing.scalar_one_or_none():
            raise bad_request(
                ErrorCode.VALIDATION_ERROR,
                f"A configuration named '{update.name}' already exists",
                config_name=update.name,
            )

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    config.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(config)

    return config


@router.delete("/custom/configs/{config_id}")
async def delete_custom_config(config_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a custom CSV format configuration."""
    result = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise not_found(ErrorCode.IMPORT_CONFIG_NOT_FOUND, config_id=config_id)

    await session.delete(config)
    await session.commit()
    return {"deleted": True}
