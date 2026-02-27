from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from datetime import UTC, date, datetime
from pydantic import BaseModel as PydanticBaseModel

from app.database import get_session
from app.orm import BatchImportSession, CustomFormatConfig, ImportFormat, ImportFormatType, ImportSession, MerchantAlias, MerchantAliasMatchType, ReconciliationStatus, Tag, Transaction, TransactionTag
from app.schemas import CustomFormatConfigCreate, CustomFormatConfigUpdate
from app.csv_parser import parse_csv, detect_format
from app.parsers import (
    CustomCsvParser,
    CustomCsvConfig,
    analyze_csv_columns,
    find_header_row,
    compute_header_signature,
)
from app.tag_inference import infer_bucket_tag
from app.utils.hashing import compute_transaction_hash_from_dict
from app.errors import ErrorCode, not_found, bad_request
import re as regex_module

router = APIRouter(prefix="/api/v1/import", tags=["import"])

# Supported import file extensions
SUPPORTED_EXTENSIONS = (".csv", ".qif", ".qfx", ".ofx")


def is_valid_import_file(filename: str) -> bool:
    """Check if a filename has a supported import extension."""
    return filename.lower().endswith(SUPPORTED_EXTENSIONS)


async def get_or_create_bucket_tag(session: AsyncSession, bucket_value: str) -> Tag:
    """Get bucket tag by value, creating if needed"""
    result = await session.execute(select(Tag).where(and_(Tag.namespace == "bucket", Tag.value == bucket_value)))
    tag = result.scalar_one_or_none()
    if not tag:
        # Create the bucket tag
        tag = Tag(namespace="bucket", value=bucket_value)
        session.add(tag)
        await session.flush()
    return tag


async def get_or_create_account_tag(session: AsyncSession, account_source: str) -> Tag:
    """Get or create an account tag for the given account_source.

    The tag value is the normalized account_source (lowercase, dashes for spaces).
    The description defaults to the original account_source as the display name.
    """
    # Normalize to tag value format
    tag_value = account_source.lower().replace(" ", "-")

    result = await session.execute(select(Tag).where(and_(Tag.namespace == "account", Tag.value == tag_value)))
    tag = result.scalar_one_or_none()
    if not tag:
        # Create the account tag with original name as description (display name)
        tag = Tag(
            namespace="account",
            value=tag_value,
            description=account_source,  # Use original as default display name
        )
        session.add(tag)
        await session.flush()
    return tag


async def apply_bucket_tag(session: AsyncSession, transaction_id: int, bucket_value: str):
    """Apply a bucket tag to a transaction"""
    tag = await get_or_create_bucket_tag(session, bucket_value)

    # Remove any existing bucket tags first
    existing_result = await session.execute(
        select(TransactionTag)
        .join(Tag)
        .where(and_(TransactionTag.transaction_id == transaction_id, Tag.namespace == "bucket"))
    )
    for existing in existing_result.scalars().all():
        await session.delete(existing)

    # Add the new bucket tag
    txn_tag = TransactionTag(transaction_id=transaction_id, tag_id=tag.id)
    session.add(txn_tag)


async def get_merchant_aliases(session: AsyncSession) -> List[MerchantAlias]:
    """Get all merchant aliases ordered by priority (highest first)"""
    result = await session.execute(select(MerchantAlias).order_by(MerchantAlias.priority.desc()))
    return list(result.scalars().all())


def apply_merchant_alias(description: str, aliases: List[MerchantAlias]) -> Optional[str]:
    """
    Apply merchant aliases to get a canonical merchant name from a description.
    Returns the canonical name if matched, None otherwise.
    """
    if not description:
        return None

    desc_lower = description.lower()

    for alias in aliases:
        pattern_lower = alias.pattern.lower()

        if alias.match_type == MerchantAliasMatchType.exact:
            if desc_lower == pattern_lower:
                return alias.canonical_name
        elif alias.match_type == MerchantAliasMatchType.contains:
            if pattern_lower in desc_lower:
                return alias.canonical_name
        elif alias.match_type == MerchantAliasMatchType.regex:
            try:
                if regex_module.search(alias.pattern, description, regex_module.IGNORECASE):
                    return alias.canonical_name
            except regex_module.error:
                continue

    return None


async def update_alias_match_stats(session: AsyncSession, alias_id: int):
    """Increment match count for an alias"""
    result = await session.execute(select(MerchantAlias).where(MerchantAlias.id == alias_id))
    alias = result.scalar_one_or_none()
    if alias:
        alias.match_count += 1
        alias.last_matched_date = datetime.now(UTC)


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(..., description="CSV, QIF, QFX, or OFX file to import"),
    account_source: Optional[str] = Form(
        None, description="Account name (required for some formats like Bank of America)"
    ),
    format_hint: Optional[ImportFormatType] = Form(None, description="Override auto-detection with specific format"),
    session: AsyncSession = Depends(get_session),
):
    """
    Preview import without saving to database.

    Supports multiple file formats:
    - **CSV**: Bank of America, American Express, Venmo, Inspira HSA
    - **QIF**: Quicken Interchange Format
    - **QFX/OFX**: Quicken Financial Exchange / Open Financial Exchange

    Returns:
    - **transactions**: Parsed transactions with suggested bucket tags
    - **detected_format**: Auto-detected file format
    - **total_amount**: Sum of all transaction amounts
    - **duplicate_count**: Number of transactions already in database

    Use this to review before calling `/confirm` to actually import.
    """
    if not file.filename or not is_valid_import_file(file.filename):
        raise bad_request(
            ErrorCode.IMPORT_UNSUPPORTED_FORMAT,
            f"Unsupported file type. Supported formats: {', '.join(SUPPORTED_EXTENSIONS)}",
            filename=file.filename,
        )

    # Read file content
    content = await file.read()
    csv_content = content.decode("utf-8")

    # Check for saved import format preference
    if not format_hint and account_source:
        fmt_result = await session.execute(select(ImportFormat).where(ImportFormat.account_source == account_source))
        saved_format = fmt_result.scalar_one_or_none()
        if saved_format:
            format_hint = ImportFormatType(saved_format.format_type)

    # Parse CSV
    transactions, detected_format = parse_csv(csv_content, account_source, format_hint)

    # Build user history for bucket tag suggestions
    # Note: This uses the old category field for now during transition
    all_txns_result = await session.execute(select(Transaction).where(Transaction.category.isnot(None)))
    all_txns = all_txns_result.scalars().all()
    # Convert old category format to bucket tag format for user history
    user_history: Dict[str, str] = {}
    for db_txn in all_txns:
        if db_txn.merchant and db_txn.category:
            merchant = db_txn.merchant.lower()
            bucket_value = db_txn.category.lower().replace(" ", "-").replace("&", "and")
            user_history[merchant] = f"bucket:{bucket_value}"

    # Add bucket tag suggestions to each transaction
    for txn in transactions:
        suggestions = infer_bucket_tag(
            txn.get("merchant", ""), txn.get("description", ""), txn.get("amount", 0), user_history
        )
        # Get bucket value from tag
        if suggestions:
            tag = suggestions[0][0]  # e.g., "bucket:groceries"
            bucket_value = tag.split(":", 1)[1] if ":" in tag else tag
            txn["bucket"] = bucket_value
            txn["bucket_tag"] = tag
            # Keep category for backwards compatibility
            txn["category"] = bucket_value.replace("-", " ").title()

    return {
        "detected_format": detected_format,
        "transaction_count": len(transactions),
        "transactions": transactions[:100],  # Limit preview to 100 transactions
        "total_amount": sum(txn["amount"] for txn in transactions),
    }


@router.post("/confirm")
async def confirm_import(
    file: UploadFile = File(..., description="Same file that was previewed"),
    account_source: Optional[str] = Form(None, description="Account name"),
    format_type: ImportFormatType = Form(..., description="Confirmed format from preview"),
    save_format: bool = Form(False, description="Remember this format for future imports"),
    session: AsyncSession = Depends(get_session),
):
    """
    Confirm and save imported transactions to database.

    Call this after `/preview` to actually import the transactions.

    Returns:
    - **imported_count**: Number of new transactions imported
    - **duplicate_count**: Number of duplicates skipped
    - **import_session_id**: ID for tracking this import batch

    Duplicates are detected by content hash (date + amount + description + account).
    Merchant aliases are applied automatically during import.
    """
    if not file.filename or not is_valid_import_file(file.filename):
        raise bad_request(
            ErrorCode.IMPORT_UNSUPPORTED_FORMAT,
            f"Unsupported file type. Supported formats: {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    # Read file content
    content = await file.read()
    file_content = content.decode("utf-8")

    # Parse file with confirmed format
    transactions, _ = parse_csv(file_content, account_source, format_type)

    if not transactions:
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

    # Create import session to track this batch
    import_session = ImportSession(
        filename=file.filename,
        format_type=format_type,
        account_source=account_source,
        transaction_count=0,
        duplicate_count=0,
        total_amount=0.0,
        status="in_progress",
    )
    session.add(import_session)
    await session.flush()  # Get the ID

    # Check for duplicates and save
    imported_count = 0
    duplicate_count = 0
    skipped_count = 0
    total_amount = 0.0
    dates = []
    cross_account_warnings = []  # Warnings for transactions that exist in other accounts

    for txn_data in transactions:
        # Generate both hashes for deduplication
        content_hash = compute_transaction_hash_from_dict(txn_data, include_account=True)
        content_hash_no_account = compute_transaction_hash_from_dict(txn_data, include_account=False)

        # Check for exact duplicate using content_hash (primary method)
        if content_hash:
            dup_query = select(Transaction).where(Transaction.content_hash == content_hash)
            result = await session.execute(dup_query)
            existing = result.scalar_one_or_none()

            if existing:
                duplicate_count += 1
                continue

            # Check for cross-account duplicate (same transaction in different account)
            if content_hash_no_account:
                cross_account_query = select(Transaction).where(
                    Transaction.content_hash_no_account == content_hash_no_account,
                    Transaction.account_source != txn_data["account_source"],
                )
                result = await session.execute(cross_account_query)
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
        else:
            # Fallback to old deduplication logic if hash generation fails
            dup_query = select(Transaction).where(
                Transaction.date == txn_data["date"],
                Transaction.amount == txn_data["amount"],
                Transaction.merchant == txn_data.get("merchant"),
            )
            result = await session.execute(dup_query)
            existing = result.scalar_one_or_none()

            if existing:
                duplicate_count += 1
                continue

        # Infer bucket tag
        suggestions = infer_bucket_tag(
            txn_data.get("merchant", ""), txn_data.get("description", ""), txn_data.get("amount", 0), user_history
        )

        # Determine bucket value
        if suggestions:
            bucket_tag = suggestions[0][0]  # e.g., "bucket:groceries"
            bucket_value = bucket_tag.split(":", 1)[1] if ":" in bucket_tag else "none"
        else:
            bucket_value = "none"

        # Create transaction linked to import session
        # Keep category field for backwards compatibility during migration
        category_display = bucket_value.replace("-", " ").title() if bucket_value != "none" else None

        # Apply merchant alias to normalize merchant name
        merchant_name = txn_data.get("merchant")
        if merchant_aliases:
            aliased_merchant = apply_merchant_alias(txn_data["description"], merchant_aliases)
            if aliased_merchant:
                merchant_name = aliased_merchant

        db_transaction = Transaction(
            date=txn_data["date"],
            amount=txn_data["amount"],
            description=txn_data["description"],
            merchant=merchant_name,
            account_source=txn_data["account_source"],
            card_member=txn_data.get("card_member"),
            category=category_display,  # Legacy field
            reconciliation_status=ReconciliationStatus.unreconciled,
            reference_id=txn_data.get("reference_id"),
            import_session_id=import_session.id,
            content_hash=content_hash,  # Store computed hash
            content_hash_no_account=content_hash_no_account,  # Store hash without account for cross-account detection
        )

        # Set account_tag_id foreign key for data integrity
        if txn_data["account_source"]:
            account_tag = await get_or_create_account_tag(session, txn_data["account_source"])
            db_transaction.account_tag_id = account_tag.id

        session.add(db_transaction)
        await session.flush()  # Get the transaction ID

        # Apply bucket tag via junction table
        await apply_bucket_tag(session, db_transaction.id, bucket_value)

        imported_count += 1
        total_amount += txn_data["amount"]
        dates.append(txn_data["date"])

    # Update import session with final stats
    import_session.transaction_count = imported_count
    import_session.duplicate_count = duplicate_count
    import_session.total_amount = total_amount
    import_session.status = "completed"
    if dates:
        import_session.date_range_start = min(dates)
        import_session.date_range_end = max(dates)

    # Save import format preference if requested
    if save_format and account_source:
        # Check if format already exists
        fmt_result = await session.execute(select(ImportFormat).where(ImportFormat.account_source == account_source))
        existing_format = fmt_result.scalar_one_or_none()

        if existing_format:
            existing_format.format_type = format_type
            existing_format.updated_at = datetime.now(UTC)
        else:
            new_format = ImportFormat(account_source=account_source, format_type=format_type)
            session.add(new_format)

    await session.commit()

    response: Dict[str, Any] = {
        "imported": imported_count,
        "duplicates": duplicate_count,
        "skipped": skipped_count,
        "format_saved": save_format,
        "import_session_id": import_session.id,
    }

    # Include cross-account warnings if any transactions match in other accounts
    if cross_account_warnings:
        response["cross_account_warnings"] = cross_account_warnings[:10]  # Limit to first 10
        response["cross_account_warning_count"] = len(cross_account_warnings)

    return response


@router.get("/formats")
async def list_saved_formats(session: AsyncSession = Depends(get_session)):
    """List saved import format preferences"""
    result = await session.execute(select(ImportFormat))
    formats = result.scalars().all()
    return formats


@router.delete("/formats/{format_id}")
async def delete_saved_format(format_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a saved import format"""
    result = await session.execute(select(ImportFormat).where(ImportFormat.id == format_id))
    format_pref = result.scalar_one_or_none()
    if not format_pref:
        raise not_found(ErrorCode.IMPORT_FORMAT_NOT_FOUND, format_id=format_id)

    await session.delete(format_pref)
    await session.commit()
    return {"deleted": True}


# Batch Import Models
class BatchFilePreview(PydanticBaseModel):
    """Preview data for a single file in batch import"""

    filename: str
    account_source: Optional[str] = None
    detected_format: ImportFormatType
    transaction_count: int
    duplicate_count: int  # Duplicates against DB
    cross_file_duplicate_count: int  # Duplicates within batch
    total_amount: float
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None
    transactions: List[Dict[str, Any]]  # Preview of first 10 transactions


class BatchConfirmFile(PydanticBaseModel):
    """Information about a file to confirm in batch import"""

    filename: str
    account_source: Optional[str]
    format_type: ImportFormatType


class BatchConfirmRequest(PydanticBaseModel):
    """Request to confirm batch import"""

    files: List[BatchConfirmFile]
    save_format: bool = False


@router.post("/batch/upload")
async def batch_upload_preview(files: List[UploadFile] = File(...), session: AsyncSession = Depends(get_session)):
    """
    Upload multiple files for batch import preview.

    Supports CSV, QIF, and QFX/OFX file formats.

    Returns preview data for each file including:
    - Detected format
    - Transaction count
    - Duplicate count (against DB and within batch)
    - Date range
    - Preview of transactions
    """
    if not files:
        raise bad_request(ErrorCode.IMPORT_NO_FILES)

    # Validate all files have supported extensions
    for file in files:
        if not file.filename or not is_valid_import_file(file.filename):
            raise bad_request(
                ErrorCode.IMPORT_UNSUPPORTED_FORMAT,
                f"File {file.filename} has unsupported format. Supported: {', '.join(SUPPORTED_EXTENSIONS)}",
                filename=file.filename,
            )

    previews: List[BatchFilePreview] = []

    # Track all transactions across files for cross-file duplicate detection
    all_batch_transactions: List[Dict[str, Any]] = []

    # Build user history for bucket tag suggestions
    all_txns_result = await session.execute(select(Transaction).where(Transaction.category.isnot(None)))
    all_txns = all_txns_result.scalars().all()
    user_history: Dict[str, str] = {}
    for db_txn in all_txns:
        if db_txn.merchant and db_txn.category:
            merchant = db_txn.merchant.lower()
            bucket_value = db_txn.category.lower().replace(" ", "-").replace("&", "and")
            user_history[merchant] = f"bucket:{bucket_value}"

    # Process each file
    for file in files:
        # Read file content
        content = await file.read()
        csv_content = content.decode("utf-8")

        # file.filename validated above
        filename = file.filename or ""

        # Try to infer account_source from filename if possible
        # e.g., "BOFA-Checking-2024.csv" -> "BOFA-Checking"
        account_source = None
        filename_lower = filename.lower()
        if "bofa" in filename_lower or "bank-of-america" in filename_lower:
            # Extract account info from filename (strip any supported extension)
            base_filename = filename
            for ext in SUPPORTED_EXTENSIONS:
                if base_filename.lower().endswith(ext):
                    base_filename = base_filename[: -len(ext)]
                    break
            parts = base_filename.split("-")
            if len(parts) >= 2:
                account_source = "-".join(parts[:2])

        # Check for saved import format preference
        format_hint: Optional[ImportFormatType] = None
        if account_source:
            fmt_result = await session.execute(select(ImportFormat).where(ImportFormat.account_source == account_source))
            saved_format = fmt_result.scalar_one_or_none()
            if saved_format:
                format_hint = ImportFormatType(saved_format.format_type)

        # Parse CSV
        transactions, detected_format = parse_csv(csv_content, account_source, format_hint)

        # Add bucket tag suggestions to each transaction
        for txn in transactions:
            suggestions = infer_bucket_tag(
                txn.get("merchant", ""), txn.get("description", ""), txn.get("amount", 0), user_history
            )
            if suggestions:
                tag = suggestions[0][0]
                bucket_value = tag.split(":", 1)[1] if ":" in tag else tag
                txn["bucket"] = bucket_value
                txn["bucket_tag"] = tag
                txn["category"] = bucket_value.replace("-", " ").title()

        # Check for duplicates against existing DB transactions
        db_duplicate_count = 0
        for txn in transactions:
            dup_query = select(Transaction).where(
                Transaction.date == txn["date"],
                Transaction.amount == txn["amount"],
                Transaction.reference_id == txn.get("reference_id"),
            )
            result = await session.execute(dup_query)
            existing = result.scalar_one_or_none()
            if existing:
                db_duplicate_count += 1
                txn["is_db_duplicate"] = True
            else:
                txn["is_db_duplicate"] = False

        # Check for cross-file duplicates (against previously processed files in this batch)
        cross_file_duplicate_count = 0
        for txn in transactions:
            if txn.get("is_db_duplicate"):
                continue  # Already marked as DB duplicate

            # Check if this transaction matches any in previously processed files
            for batch_txn in all_batch_transactions:
                if (
                    txn["date"] == batch_txn["date"]
                    and txn["amount"] == batch_txn["amount"]
                    and txn.get("reference_id") == batch_txn.get("reference_id")
                ):
                    cross_file_duplicate_count += 1
                    txn["is_cross_file_duplicate"] = True
                    break
            else:
                txn["is_cross_file_duplicate"] = False

        # Add this file's transactions to the batch tracking
        all_batch_transactions.extend(transactions)

        # Calculate stats
        total_amount = sum(txn["amount"] for txn in transactions)
        dates = [txn["date"] for txn in transactions]
        date_range_start = min(dates) if dates else None
        date_range_end = max(dates) if dates else None

        # Create preview
        preview = BatchFilePreview(
            filename=filename,
            account_source=account_source,
            detected_format=detected_format,
            transaction_count=len(transactions),
            duplicate_count=db_duplicate_count,
            cross_file_duplicate_count=cross_file_duplicate_count,
            total_amount=total_amount,
            date_range_start=date_range_start,
            date_range_end=date_range_end,
            transactions=transactions[:10],  # Preview first 10
        )
        previews.append(preview)

    return {
        "files": previews,
        "total_files": len(previews),
        "total_transactions": sum(p.transaction_count for p in previews),
        "total_duplicates": sum(p.duplicate_count + p.cross_file_duplicate_count for p in previews),
    }


@router.post("/batch/confirm")
async def batch_confirm_import(
    files: List[UploadFile] = File(...), request: str = Form(...), session: AsyncSession = Depends(get_session)
):
    """
    Confirm and import selected files from batch

    Args:
        files: The actual CSV files
        request: JSON string containing BatchConfirmRequest data
    """
    import json

    # Parse the request JSON
    request_data = json.loads(request)
    request_obj = BatchConfirmRequest(**request_data)

    if not request_obj.files:
        raise bad_request(ErrorCode.IMPORT_NO_FILES)

    # Create batch import session
    batch_session = BatchImportSession(total_files=len(request_obj.files), status="in_progress")
    session.add(batch_session)
    await session.flush()  # Get the ID

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

    # Track all transactions being imported for cross-file duplicate detection
    batch_transactions_to_import: List[Dict[str, Any]] = []

    results = []
    total_imported = 0
    total_duplicates = 0

    # Create a mapping of filenames to file objects
    file_map = {f.filename: f for f in files}

    for file_info in request_obj.files:
        # Find the matching uploaded file
        if file_info.filename not in file_map:
            raise bad_request(
                ErrorCode.VALIDATION_ERROR,
                f"File {file_info.filename} not found in uploaded files",
                filename=file_info.filename,
            )

        file = file_map[file_info.filename]

        # Read file content
        content = await file.read()
        csv_content = content.decode("utf-8")

        # Parse CSV with confirmed format
        transactions, _ = parse_csv(csv_content, file_info.account_source, file_info.format_type)

        if not transactions:
            continue

        # Create import session for this file
        import_session = ImportSession(
            filename=file_info.filename,
            format_type=file_info.format_type,
            account_source=file_info.account_source,
            transaction_count=0,
            duplicate_count=0,
            total_amount=0.0,
            status="in_progress",
            batch_import_id=batch_session.id,
        )
        session.add(import_session)
        await session.flush()

        # Import transactions
        imported_count = 0
        duplicate_count = 0
        file_total_amount = 0.0
        dates = []

        for txn_data in transactions:
            # Check for duplicate against DB
            dup_query = select(Transaction).where(
                Transaction.date == txn_data["date"],
                Transaction.amount == txn_data["amount"],
                Transaction.reference_id == txn_data.get("reference_id"),
            )
            result = await session.execute(dup_query)
            existing = result.scalar_one_or_none()

            if existing:
                duplicate_count += 1
                continue

            # Check for cross-file duplicate within this batch
            is_cross_file_dup = False
            for batch_txn in batch_transactions_to_import:
                if (
                    txn_data["date"] == batch_txn["date"]
                    and txn_data["amount"] == batch_txn["amount"]
                    and txn_data.get("reference_id") == batch_txn.get("reference_id")
                ):
                    duplicate_count += 1
                    is_cross_file_dup = True
                    break

            if is_cross_file_dup:
                continue

            # Add to batch tracking
            batch_transactions_to_import.append(txn_data)

            # Infer bucket tag
            suggestions = infer_bucket_tag(
                txn_data.get("merchant", ""), txn_data.get("description", ""), txn_data.get("amount", 0), user_history
            )

            if suggestions:
                bucket_tag = suggestions[0][0]
                bucket_value = bucket_tag.split(":", 1)[1] if ":" in bucket_tag else "none"
            else:
                bucket_value = "none"

            # Create transaction
            category_display = bucket_value.replace("-", " ").title() if bucket_value != "none" else None

            # Apply merchant alias to normalize merchant name
            merchant_name = txn_data.get("merchant")
            if merchant_aliases:
                aliased_merchant = apply_merchant_alias(txn_data["description"], merchant_aliases)
                if aliased_merchant:
                    merchant_name = aliased_merchant

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
            )

            # Set account_tag_id foreign key
            if txn_data["account_source"]:
                account_tag = await get_or_create_account_tag(session, txn_data["account_source"])
                db_transaction.account_tag_id = account_tag.id

            session.add(db_transaction)
            await session.flush()

            # Apply bucket tag
            await apply_bucket_tag(session, db_transaction.id, bucket_value)

            imported_count += 1
            file_total_amount += txn_data["amount"]
            dates.append(txn_data["date"])

        # Update import session stats
        import_session.transaction_count = imported_count
        import_session.duplicate_count = duplicate_count
        import_session.total_amount = file_total_amount
        import_session.status = "completed"
        if dates:
            import_session.date_range_start = min(dates)
            import_session.date_range_end = max(dates)

        total_imported += imported_count
        total_duplicates += duplicate_count

        results.append(
            {
                "filename": file_info.filename,
                "imported": imported_count,
                "duplicates": duplicate_count,
                "import_session_id": import_session.id,
            }
        )

        # Save format preference if requested
        if request_obj.save_format and file_info.account_source:
            fmt_result = await session.execute(
                select(ImportFormat).where(ImportFormat.account_source == file_info.account_source)
            )
            existing_format = fmt_result.scalar_one_or_none()

            if existing_format:
                existing_format.format_type = file_info.format_type
                existing_format.updated_at = datetime.now(UTC)
            else:
                new_format = ImportFormat(account_source=file_info.account_source, format_type=file_info.format_type)
                session.add(new_format)

    # Update batch session stats
    batch_session.imported_files = len(results)
    batch_session.total_transactions = total_imported
    batch_session.total_duplicates = total_duplicates
    batch_session.status = "completed"

    await session.commit()

    return {
        "batch_id": batch_session.id,
        "total_imported": total_imported,
        "total_duplicates": total_duplicates,
        "files": results,
        "format_saved": request_obj.save_format,
    }


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
        detected_format_str, confidence_str = detect_format(csv_content)
        detected_format = detected_format_str
        format_confidence = float(confidence_str) if confidence_str else None
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
            existing_config.updated_at = datetime.now(UTC)
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

    config.updated_at = datetime.now(UTC)
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


@router.get("/custom/configs/{config_id}/export")
async def export_custom_config(config_id: int, session: AsyncSession = Depends(get_session)):
    """
    Export a custom CSV format configuration as JSON.

    The returned JSON can be imported on another instance using the import endpoint.
    """
    result = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise not_found(ErrorCode.IMPORT_CONFIG_NOT_FOUND, config_id=config_id)

    import json

    return {"name": config.name, "description": config.description, "config": json.loads(config.config_json)}


class ImportConfigRequest(PydanticBaseModel):
    """Request to import a custom format configuration"""

    name: Optional[str] = None  # Override name (optional)
    description: Optional[str] = None  # Override description (optional)
    config: Dict[str, Any]  # The config to import


@router.post("/custom/configs/import")
async def import_custom_config(request: ImportConfigRequest, session: AsyncSession = Depends(get_session)):
    """
    Import a custom CSV format configuration from JSON.

    Optionally override the name and description during import.
    """
    import json

    # Build config object and validate
    config_json = json.dumps(request.config)
    try:
        _parsed_config = CustomCsvConfig.from_json(config_json)  # Validates config structure
    except Exception as e:
        raise bad_request(ErrorCode.IMPORT_PARSE_ERROR, f"Invalid config: {str(e)}")

    # Use provided name or extract from config
    name = request.name or request.config.get("name", "Imported Config")

    # Check for duplicate name
    result = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.name == name))
    if result.scalar_one_or_none():
        # Auto-generate unique name
        base_name = name
        counter = 1
        while True:
            name = f"{base_name} ({counter})"
            result = await session.execute(select(CustomFormatConfig).where(CustomFormatConfig.name == name))
            if not result.scalar_one_or_none():
                break
            counter += 1

    db_config = CustomFormatConfig(
        name=name, description=request.description or request.config.get("description"), config_json=config_json
    )
    session.add(db_config)
    await session.commit()
    await session.refresh(db_config)

    return db_config
