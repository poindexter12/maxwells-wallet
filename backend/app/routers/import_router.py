from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime

from app.database import get_session
from app.models import (
    Transaction, ImportFormat, ImportFormatCreate,
    ImportFormatType, ReconciliationStatus, ImportSession,
    Tag, TransactionTag
)
from app.csv_parser import parse_csv, detect_format
from app.tag_inference import infer_bucket_tag, build_user_history

router = APIRouter(prefix="/api/v1/import", tags=["import"])


async def get_or_create_bucket_tag(session: AsyncSession, bucket_value: str) -> Tag:
    """Get bucket tag by value, creating if needed"""
    result = await session.execute(
        select(Tag).where(and_(Tag.namespace == "bucket", Tag.value == bucket_value))
    )
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
    tag_value = account_source.lower().replace(' ', '-')

    result = await session.execute(
        select(Tag).where(and_(Tag.namespace == "account", Tag.value == tag_value))
    )
    tag = result.scalar_one_or_none()
    if not tag:
        # Create the account tag with original name as description (display name)
        tag = Tag(
            namespace="account",
            value=tag_value,
            description=account_source  # Use original as default display name
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
        .where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                Tag.namespace == "bucket"
            )
        )
    )
    for existing in existing_result.scalars().all():
        await session.delete(existing)

    # Add the new bucket tag
    txn_tag = TransactionTag(transaction_id=transaction_id, tag_id=tag.id)
    session.add(txn_tag)


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    account_source: Optional[str] = Form(None),
    format_hint: Optional[ImportFormatType] = Form(None),
    session: AsyncSession = Depends(get_session)
):
    """
    Preview CSV import without saving to database

    Returns parsed transactions and detected format
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    # Read file content
    content = await file.read()
    csv_content = content.decode('utf-8')

    # Check for saved import format preference
    if not format_hint and account_source:
        result = await session.execute(
            select(ImportFormat).where(ImportFormat.account_source == account_source)
        )
        saved_format = result.scalar_one_or_none()
        if saved_format:
            format_hint = saved_format.format_type

    # Parse CSV
    transactions, detected_format = parse_csv(csv_content, account_source, format_hint)

    # Build user history for bucket tag suggestions
    # Note: This uses the old category field for now during transition
    all_txns_result = await session.execute(
        select(Transaction).where(Transaction.category.isnot(None))
    )
    all_txns = all_txns_result.scalars().all()
    # Convert old category format to bucket tag format for user history
    user_history = {}
    for txn in all_txns:
        if txn.merchant and txn.category:
            merchant = txn.merchant.lower()
            bucket_value = txn.category.lower().replace(' ', '-').replace('&', 'and')
            user_history[merchant] = f"bucket:{bucket_value}"

    # Add bucket tag suggestions to each transaction
    for txn in transactions:
        suggestions = infer_bucket_tag(
            txn.get('merchant', ''),
            txn.get('description', ''),
            txn.get('amount', 0),
            user_history
        )
        # Get bucket value from tag
        if suggestions:
            tag = suggestions[0][0]  # e.g., "bucket:groceries"
            bucket_value = tag.split(':', 1)[1] if ':' in tag else tag
            txn['bucket'] = bucket_value
            txn['bucket_tag'] = tag
            # Keep category for backwards compatibility
            txn['category'] = bucket_value.replace('-', ' ').title()

    return {
        "detected_format": detected_format,
        "transaction_count": len(transactions),
        "transactions": transactions[:100],  # Limit preview to 100 transactions
        "total_amount": sum(txn['amount'] for txn in transactions)
    }


@router.post("/confirm")
async def confirm_import(
    file: UploadFile = File(...),
    account_source: Optional[str] = Form(None),
    format_type: ImportFormatType = Form(...),
    save_format: bool = Form(False),
    session: AsyncSession = Depends(get_session)
):
    """
    Confirm and save imported transactions

    Args:
        file: CSV file
        account_source: Account source identifier
        format_type: Confirmed format type
        save_format: Whether to save this format preference
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    # Read file content
    content = await file.read()
    csv_content = content.decode('utf-8')

    # Parse CSV with confirmed format
    transactions, _ = parse_csv(csv_content, account_source, format_type)

    if not transactions:
        raise HTTPException(status_code=400, detail="No transactions found in CSV")

    # Build user history for bucket tag suggestions
    all_txns_result = await session.execute(
        select(Transaction).where(Transaction.category.isnot(None))
    )
    all_txns = all_txns_result.scalars().all()
    user_history = {}
    for txn in all_txns:
        if txn.merchant and txn.category:
            merchant = txn.merchant.lower()
            bucket_value = txn.category.lower().replace(' ', '-').replace('&', 'and')
            user_history[merchant] = f"bucket:{bucket_value}"

    # Create import session to track this batch
    import_session = ImportSession(
        filename=file.filename,
        format_type=format_type,
        account_source=account_source,
        transaction_count=0,
        duplicate_count=0,
        total_amount=0.0,
        status="in_progress"
    )
    session.add(import_session)
    await session.flush()  # Get the ID

    # Check for duplicates and save
    imported_count = 0
    duplicate_count = 0
    skipped_count = 0
    total_amount = 0.0
    dates = []

    for txn_data in transactions:
        # Check for duplicate (date + amount + reference_id)
        dup_query = select(Transaction).where(
            Transaction.date == txn_data['date'],
            Transaction.amount == txn_data['amount'],
            Transaction.reference_id == txn_data.get('reference_id')
        )
        result = await session.execute(dup_query)
        existing = result.scalar_one_or_none()

        if existing:
            duplicate_count += 1
            continue

        # Infer bucket tag
        suggestions = infer_bucket_tag(
            txn_data.get('merchant', ''),
            txn_data.get('description', ''),
            txn_data.get('amount', 0),
            user_history
        )

        # Determine bucket value
        if suggestions:
            bucket_tag = suggestions[0][0]  # e.g., "bucket:groceries"
            bucket_value = bucket_tag.split(':', 1)[1] if ':' in bucket_tag else 'none'
        else:
            bucket_value = 'none'

        # Create transaction linked to import session
        # Keep category field for backwards compatibility during migration
        category_display = bucket_value.replace('-', ' ').title() if bucket_value != 'none' else None

        db_transaction = Transaction(
            date=txn_data['date'],
            amount=txn_data['amount'],
            description=txn_data['description'],
            merchant=txn_data.get('merchant'),
            account_source=txn_data['account_source'],
            card_member=txn_data.get('card_member'),
            category=category_display,  # Legacy field
            reconciliation_status=ReconciliationStatus.unreconciled,
            reference_id=txn_data.get('reference_id'),
            import_session_id=import_session.id
        )

        session.add(db_transaction)
        await session.flush()  # Get the transaction ID

        # Apply bucket tag via junction table
        await apply_bucket_tag(session, db_transaction.id, bucket_value)

        # Auto-create account tag if needed
        if txn_data['account_source']:
            await get_or_create_account_tag(session, txn_data['account_source'])

        imported_count += 1
        total_amount += txn_data['amount']
        dates.append(txn_data['date'])

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
        result = await session.execute(
            select(ImportFormat).where(ImportFormat.account_source == account_source)
        )
        existing_format = result.scalar_one_or_none()

        if existing_format:
            existing_format.format_type = format_type
            existing_format.updated_at = datetime.utcnow()
        else:
            new_format = ImportFormat(
                account_source=account_source,
                format_type=format_type
            )
            session.add(new_format)

    await session.commit()

    return {
        "imported": imported_count,
        "duplicates": duplicate_count,
        "skipped": skipped_count,
        "format_saved": save_format,
        "import_session_id": import_session.id
    }


@router.get("/formats")
async def list_saved_formats(
    session: AsyncSession = Depends(get_session)
):
    """List saved import format preferences"""
    result = await session.execute(select(ImportFormat))
    formats = result.scalars().all()
    return formats


@router.delete("/formats/{format_id}")
async def delete_saved_format(
    format_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a saved import format"""
    result = await session.execute(
        select(ImportFormat).where(ImportFormat.id == format_id)
    )
    format_pref = result.scalar_one_or_none()
    if not format_pref:
        raise HTTPException(status_code=404, detail="Format not found")

    await session.delete(format_pref)
    await session.commit()
    return {"deleted": True}
