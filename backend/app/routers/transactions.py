from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from typing import List, Optional, Annotated
from datetime import date, datetime

from app.database import get_session
from app.models import (
    Transaction, TransactionCreate, TransactionUpdate,
    ReconciliationStatus, Tag, TransactionTag,
    SplitItem, TransactionSplits, TransactionSplitResponse
)
from app.utils.hashing import compute_transaction_content_hash
from sqlmodel import and_
from pydantic import BaseModel


class AddTagRequest(BaseModel):
    tag: str  # namespace:value format


class AddTagWithAmountRequest(BaseModel):
    tag: str  # namespace:value format
    amount: Optional[float] = None  # Split amount

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


def build_transaction_filter_query(
    base_query,
    account: Optional[List[str]] = None,
    account_exclude: Optional[List[str]] = None,
    account_source: Optional[str] = None,
    category: Optional[str] = None,
    reconciliation_status: Optional[ReconciliationStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    search_regex: bool = False,
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    tag: Optional[List[str]] = None,
    tag_exclude: Optional[List[str]] = None,
    is_transfer: Optional[bool] = None,
):
    """Build query with filters - shared between list and count endpoints"""
    query = base_query

    # Transfer filter
    if is_transfer is not None:
        query = query.where(Transaction.is_transfer == is_transfer)

    # Account filtering via account_tag_id FK (preferred method)
    if account:
        account_tag_subquery = (
            select(Tag.id)
            .where(and_(Tag.namespace == "account", Tag.value.in_(account)))
        )
        query = query.where(Transaction.account_tag_id.in_(account_tag_subquery))

    if account_exclude:
        exclude_tag_subquery = (
            select(Tag.id)
            .where(and_(Tag.namespace == "account", Tag.value.in_(account_exclude)))
        )
        query = query.where(
            (Transaction.account_tag_id.notin_(exclude_tag_subquery)) |
            (Transaction.account_tag_id.is_(None))
        )

    # Legacy account_source filter (for backward compatibility)
    if account_source:
        query = query.where(Transaction.account_source == account_source)
    if category:
        query = query.where(Transaction.category == category)
    if reconciliation_status:
        query = query.where(Transaction.reconciliation_status == reconciliation_status)
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)
    if search:
        if search_regex:
            # Regex search using SQLite REGEXP or PostgreSQL ~*
            # SQLite requires regexp extension, PostgreSQL has built-in
            # Use op('REGEXP') for SQLite compatibility
            from sqlalchemy import or_
            query = query.where(
                or_(
                    Transaction.merchant.op('REGEXP')(search),
                    Transaction.description.op('REGEXP')(search),
                    Transaction.notes.op('REGEXP')(search)
                )
            )
        else:
            # Standard ILIKE search (case-insensitive substring)
            search_pattern = f"%{search}%"
            query = query.where(
                (Transaction.merchant.ilike(search_pattern)) |
                (Transaction.description.ilike(search_pattern)) |
                (Transaction.notes.ilike(search_pattern))
            )
    if amount_min is not None:
        query = query.where(Transaction.amount >= amount_min)
    if amount_max is not None:
        query = query.where(Transaction.amount <= amount_max)

    # Filter by tags (requires join) - all specified tags must match (AND logic)
    if tag:
        for tag_str in tag:
            parts = tag_str.split(':', 1)
            if len(parts) == 2:
                namespace, value = parts
                tag_subquery = (
                    select(TransactionTag.transaction_id)
                    .join(Tag, TransactionTag.tag_id == Tag.id)
                    .where(and_(Tag.namespace == namespace, Tag.value == value))
                )
                query = query.where(Transaction.id.in_(tag_subquery))

    # Exclude tags
    if tag_exclude:
        for tag_str in tag_exclude:
            parts = tag_str.split(':', 1)
            if len(parts) == 2:
                namespace, value = parts
                exclude_subquery = (
                    select(TransactionTag.transaction_id)
                    .join(Tag, TransactionTag.tag_id == Tag.id)
                    .where(and_(Tag.namespace == namespace, Tag.value == value))
                )
                query = query.where(Transaction.id.notin_(exclude_subquery))

    return query

@router.get("/count")
async def count_transactions(
    account_source: Optional[str] = None,
    account: Optional[List[str]] = Query(None, description="Filter by account tag values (can specify multiple, OR logic)"),
    account_exclude: Optional[List[str]] = Query(None, description="Exclude account tag values (can specify multiple)"),
    category: Optional[str] = None,
    reconciliation_status: Optional[ReconciliationStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = Query(None, description="Search in merchant, description, and notes fields"),
    search_regex: bool = Query(False, description="Use regex pattern matching instead of substring search"),
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    tag: Optional[List[str]] = Query(None, description="Filter by tags in namespace:value format (can specify multiple)"),
    tag_exclude: Optional[List[str]] = Query(None, description="Exclude tags in namespace:value format (can specify multiple)"),
    is_transfer: Optional[bool] = Query(None, description="Filter by transfer status (true=transfers only, false=non-transfers only)"),
    session: AsyncSession = Depends(get_session)
):
    """Get total count of transactions matching filters"""
    base_query = select(func.count(Transaction.id))
    query = build_transaction_filter_query(
        base_query,
        account=account,
        account_exclude=account_exclude,
        account_source=account_source,
        category=category,
        reconciliation_status=reconciliation_status,
        start_date=start_date,
        end_date=end_date,
        search=search,
        search_regex=search_regex,
        amount_min=amount_min,
        amount_max=amount_max,
        tag=tag,
        tag_exclude=tag_exclude,
        is_transfer=is_transfer,
    )

    result = await session.execute(query)
    count = result.scalar()
    return {"count": count}


@router.get("/", response_model=List[Transaction])
async def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    account_source: Optional[str] = None,
    account: Optional[List[str]] = Query(None, description="Filter by account tag values (can specify multiple, OR logic)"),
    account_exclude: Optional[List[str]] = Query(None, description="Exclude account tag values (can specify multiple)"),
    category: Optional[str] = None,
    reconciliation_status: Optional[ReconciliationStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = Query(None, description="Search in merchant, description, and notes fields"),
    search_regex: bool = Query(False, description="Use regex pattern matching instead of substring search"),
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    tag: Optional[List[str]] = Query(None, description="Filter by tags in namespace:value format (can specify multiple)"),
    tag_exclude: Optional[List[str]] = Query(None, description="Exclude tags in namespace:value format (can specify multiple)"),
    is_transfer: Optional[bool] = Query(None, description="Filter by transfer status (true=transfers only, false=non-transfers only)"),
    session: AsyncSession = Depends(get_session)
):
    """List transactions with filtering and pagination

    Supports:
    - account: Include transactions from specific accounts (OR logic)
    - account_exclude: Exclude transactions from specific accounts
    - tag: Include transactions with specific tags (AND logic)
    - tag_exclude: Exclude transactions with specific tags
    - is_transfer: Filter by transfer status
    - search: Search in merchant, description, and notes (substring or regex)
    - search_regex: Enable regex pattern matching for search
    """
    base_query = select(Transaction)
    query = build_transaction_filter_query(
        base_query,
        account=account,
        account_exclude=account_exclude,
        account_source=account_source,
        category=category,
        reconciliation_status=reconciliation_status,
        start_date=start_date,
        end_date=end_date,
        search=search,
        search_regex=search_regex,
        amount_min=amount_min,
        amount_max=amount_max,
        tag=tag,
        tag_exclude=tag_exclude,
        is_transfer=is_transfer,
    )

    query = query.order_by(Transaction.date.desc()).offset(skip).limit(limit)

    result = await session.execute(query)
    transactions = result.scalars().all()
    return transactions

@router.get("/{transaction_id}", response_model=Transaction)
async def get_transaction(
    transaction_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a single transaction by ID"""
    result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@router.post("/", response_model=Transaction, status_code=201)
async def create_transaction(
    transaction: TransactionCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new transaction"""
    db_transaction = Transaction(**transaction.model_dump())
    db_transaction.reconciliation_status = ReconciliationStatus.manually_entered

    # Auto-generate content_hash if not provided
    if not db_transaction.content_hash:
        db_transaction.content_hash = compute_transaction_content_hash(
            date=db_transaction.date,
            amount=db_transaction.amount,
            description=db_transaction.description,
            account_source=db_transaction.account_source
        )

    session.add(db_transaction)
    await session.commit()
    await session.refresh(db_transaction)
    return db_transaction

@router.patch("/{transaction_id}", response_model=Transaction)
async def update_transaction(
    transaction_id: int,
    transaction: TransactionUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a transaction"""
    result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    db_transaction = result.scalar_one_or_none()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Update fields
    for key, value in transaction.model_dump(exclude_unset=True).items():
        setattr(db_transaction, key, value)

    db_transaction.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(db_transaction)
    return db_transaction

@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a transaction"""
    result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await session.delete(transaction)
    await session.commit()

@router.post("/bulk-update")
async def bulk_update_transactions(
    transaction_ids: List[int],
    updates: TransactionUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Bulk update multiple transactions"""
    result = await session.execute(
        select(Transaction).where(Transaction.id.in_(transaction_ids))
    )
    transactions = result.scalars().all()

    if not transactions:
        raise HTTPException(status_code=404, detail="No transactions found")

    for txn in transactions:
        for key, value in updates.model_dump(exclude_unset=True).items():
            setattr(txn, key, value)
        txn.updated_at = datetime.utcnow()

    await session.commit()

    return {"updated": len(transactions)}


def parse_tag_string(tag_str: str) -> tuple:
    """Parse a tag string like 'bucket:groceries' into (namespace, value)"""
    if ":" not in tag_str:
        raise ValueError(f"Invalid tag format: '{tag_str}'. Expected 'namespace:value'")
    namespace, value = tag_str.split(":", 1)
    return namespace, value


@router.post("/{transaction_id}/tags")
async def add_tag_to_transaction(
    transaction_id: int,
    request: AddTagRequest,
    session: AsyncSession = Depends(get_session)
):
    """Add a tag to a transaction"""
    # Validate transaction exists
    txn_result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = txn_result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Parse and validate tag
    try:
        namespace, value = parse_tag_string(request.tag)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get the tag
    tag_result = await session.execute(
        select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value))
    )
    tag = tag_result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=400, detail=f"Tag '{request.tag}' does not exist")

    # For bucket namespace, remove existing bucket tag first (only one allowed)
    if namespace == "bucket":
        existing_bucket_result = await session.execute(
            select(TransactionTag)
            .join(Tag)
            .where(
                and_(
                    TransactionTag.transaction_id == transaction_id,
                    Tag.namespace == "bucket"
                )
            )
        )
        for existing in existing_bucket_result.scalars().all():
            await session.delete(existing)

    # Check if this exact tag is already applied
    existing_result = await session.execute(
        select(TransactionTag).where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                TransactionTag.tag_id == tag.id
            )
        )
    )
    if existing_result.scalar_one_or_none():
        return {"message": "Tag already applied", "transaction_id": transaction_id, "tag": request.tag}

    # Add the tag
    txn_tag = TransactionTag(transaction_id=transaction_id, tag_id=tag.id)
    session.add(txn_tag)
    await session.commit()

    return {"message": "Tag added", "transaction_id": transaction_id, "tag": request.tag}


@router.delete("/{transaction_id}/tags/{tag}")
async def remove_tag_from_transaction(
    transaction_id: int,
    tag: str,
    session: AsyncSession = Depends(get_session)
):
    """Remove a tag from a transaction"""
    # Validate transaction exists
    txn_result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = txn_result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Parse tag
    try:
        namespace, value = parse_tag_string(tag)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get the tag
    tag_result = await session.execute(
        select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value))
    )
    tag_obj = tag_result.scalar_one_or_none()
    if not tag_obj:
        raise HTTPException(status_code=400, detail=f"Tag '{tag}' does not exist")

    # Find and remove the link
    link_result = await session.execute(
        select(TransactionTag).where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                TransactionTag.tag_id == tag_obj.id
            )
        )
    )
    link = link_result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Tag not applied to this transaction")

    await session.delete(link)
    await session.commit()

    return {"message": "Tag removed", "transaction_id": transaction_id, "tag": tag}


@router.get("/{transaction_id}/tags")
async def get_transaction_tags(
    transaction_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get all tags for a transaction"""
    # Validate transaction exists
    txn_result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = txn_result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Get tags from junction table (bucket, occasion, etc.)
    result = await session.execute(
        select(Tag)
        .join(TransactionTag)
        .where(TransactionTag.transaction_id == transaction_id)
    )
    tags = result.scalars().all()

    tag_list = [
        {"namespace": t.namespace, "value": t.value, "full": f"{t.namespace}:{t.value}"}
        for t in tags
    ]

    # Also include account tag from direct FK (account_tag_id)
    if transaction.account_tag_id:
        account_result = await session.execute(
            select(Tag).where(Tag.id == transaction.account_tag_id)
        )
        account_tag = account_result.scalar_one_or_none()
        if account_tag:
            tag_list.append({
                "namespace": account_tag.namespace,
                "value": account_tag.value,
                "full": f"{account_tag.namespace}:{account_tag.value}"
            })

    return {
        "transaction_id": transaction_id,
        "tags": tag_list
    }


@router.get("/{transaction_id}/splits", response_model=TransactionSplitResponse)
async def get_transaction_splits(
    transaction_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get split allocations for a transaction.

    Returns the list of bucket splits with their amounts and the unallocated remainder.
    """
    # Validate transaction exists
    txn_result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = txn_result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Get all bucket tags with amounts for this transaction
    result = await session.execute(
        select(Tag, TransactionTag.amount)
        .join(TransactionTag, TransactionTag.tag_id == Tag.id)
        .where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                Tag.namespace == "bucket",
                TransactionTag.amount.isnot(None)
            )
        )
    )
    rows = result.all()

    splits = [
        SplitItem(tag=f"bucket:{row[0].value}", amount=row[1])
        for row in rows
    ]

    total_allocated = sum(s.amount for s in splits)
    unallocated = abs(transaction.amount) - total_allocated

    return TransactionSplitResponse(
        transaction_id=transaction_id,
        total_amount=abs(transaction.amount),
        splits=splits,
        unallocated=max(0, unallocated)  # Don't show negative unallocated
    )


@router.put("/{transaction_id}/splits", response_model=TransactionSplitResponse)
async def set_transaction_splits(
    transaction_id: int,
    splits_data: TransactionSplits,
    session: AsyncSession = Depends(get_session)
):
    """Set split allocations for a transaction.

    Replaces all existing splits. Each split must reference a valid bucket tag.
    Splits don't need to sum to the transaction amount - partial splits are allowed,
    and over-allocation is also permitted (no validation enforcement).
    """
    # Validate transaction exists
    txn_result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = txn_result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Remove existing bucket splits (TransactionTags with amounts)
    existing_result = await session.execute(
        select(TransactionTag)
        .join(Tag, TransactionTag.tag_id == Tag.id)
        .where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                Tag.namespace == "bucket",
                TransactionTag.amount.isnot(None)
            )
        )
    )
    for existing in existing_result.scalars().all():
        await session.delete(existing)

    # Also remove bucket tags without amounts (they'll be replaced by splits)
    existing_bucket_result = await session.execute(
        select(TransactionTag)
        .join(Tag, TransactionTag.tag_id == Tag.id)
        .where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                Tag.namespace == "bucket"
            )
        )
    )
    for existing in existing_bucket_result.scalars().all():
        await session.delete(existing)

    # Add new splits
    for split in splits_data.splits:
        # Parse tag
        try:
            namespace, value = parse_tag_string(split.tag)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        if namespace != "bucket":
            raise HTTPException(
                status_code=400,
                detail=f"Splits must use bucket tags, got '{namespace}'"
            )

        # Get the tag
        tag_result = await session.execute(
            select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value))
        )
        tag = tag_result.scalar_one_or_none()
        if not tag:
            raise HTTPException(status_code=400, detail=f"Tag '{split.tag}' does not exist")

        # Create transaction tag with amount
        txn_tag = TransactionTag(
            transaction_id=transaction_id,
            tag_id=tag.id,
            amount=split.amount
        )
        session.add(txn_tag)

    await session.commit()

    # Return the new splits state
    return await get_transaction_splits(transaction_id, session)


@router.delete("/{transaction_id}/splits")
async def clear_transaction_splits(
    transaction_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Remove all split allocations from a transaction.

    This removes the amount from bucket tags but doesn't remove the tags themselves.
    """
    # Validate transaction exists
    txn_result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = txn_result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Remove all bucket splits
    existing_result = await session.execute(
        select(TransactionTag)
        .join(Tag, TransactionTag.tag_id == Tag.id)
        .where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                Tag.namespace == "bucket"
            )
        )
    )
    deleted_count = 0
    for existing in existing_result.scalars().all():
        await session.delete(existing)
        deleted_count += 1

    await session.commit()

    return {"message": "Splits cleared", "transaction_id": transaction_id, "removed": deleted_count}


@router.get("/export/csv")
async def export_transactions_csv(
    account_source: Optional[str] = None,
    account: Optional[List[str]] = Query(None, description="Filter by account tag values (can specify multiple, OR logic)"),
    account_exclude: Optional[List[str]] = Query(None, description="Exclude account tag values (can specify multiple)"),
    category: Optional[str] = None,
    reconciliation_status: Optional[ReconciliationStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = Query(None, description="Search in merchant, description, and notes fields"),
    search_regex: bool = Query(False, description="Use regex pattern matching instead of substring search"),
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    tag: Optional[List[str]] = Query(None, description="Filter by tags in namespace:value format (can specify multiple)"),
    tag_exclude: Optional[List[str]] = Query(None, description="Exclude tags in namespace:value format (can specify multiple)"),
    is_transfer: Optional[bool] = Query(None, description="Filter by transfer status"),
    session: AsyncSession = Depends(get_session)
):
    """Export transactions matching filters as CSV.

    Returns a streaming CSV response with all matching transactions.
    No pagination limit - exports all matching records.
    """
    from fastapi.responses import StreamingResponse
    import csv
    import io

    # Build query (no limit for export)
    base_query = select(Transaction)
    query = build_transaction_filter_query(
        base_query,
        account=account,
        account_exclude=account_exclude,
        account_source=account_source,
        category=category,
        reconciliation_status=reconciliation_status,
        start_date=start_date,
        end_date=end_date,
        search=search,
        search_regex=search_regex,
        amount_min=amount_min,
        amount_max=amount_max,
        tag=tag,
        tag_exclude=tag_exclude,
        is_transfer=is_transfer,
    )

    query = query.order_by(Transaction.date.desc())

    result = await session.execute(query)
    transactions = result.scalars().all()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        'Date', 'Amount', 'Merchant', 'Description', 'Account',
        'Category', 'Status', 'Notes', 'Is Transfer', 'Reference ID'
    ])

    # Write data
    for txn in transactions:
        writer.writerow([
            txn.date.isoformat() if txn.date else '',
            txn.amount,
            txn.merchant or '',
            txn.description or '',
            txn.account_source or '',
            txn.category or '',
            txn.reconciliation_status.value if txn.reconciliation_status else '',
            txn.notes or '',
            'Yes' if txn.is_transfer else 'No',
            txn.reference_id or ''
        ])

    output.seek(0)

    # Generate filename with date range if provided
    filename_parts = ['transactions']
    if start_date:
        filename_parts.append(f'from_{start_date.isoformat()}')
    if end_date:
        filename_parts.append(f'to_{end_date.isoformat()}')
    filename = '_'.join(filename_parts) + '.csv'

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )
