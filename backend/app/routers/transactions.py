from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date, datetime

from app.database import get_session
from app.models import (
    Transaction, TransactionCreate, TransactionUpdate,
    ReconciliationStatus, Tag, TransactionTag
)
from app.category_inference import infer_category, build_user_history
from sqlmodel import and_
from pydantic import BaseModel


class AddTagRequest(BaseModel):
    tag: str  # namespace:value format

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])

@router.get("/", response_model=List[Transaction])
async def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    account_source: Optional[str] = None,
    category: Optional[str] = None,
    reconciliation_status: Optional[ReconciliationStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """List transactions with filtering and pagination"""
    query = select(Transaction)

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
        search_pattern = f"%{search}%"
        query = query.where(
            (Transaction.merchant.ilike(search_pattern)) |
            (Transaction.description.ilike(search_pattern))
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
    db_transaction = Transaction(**transaction.dict())
    db_transaction.reconciliation_status = ReconciliationStatus.manually_entered

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
    for key, value in transaction.dict(exclude_unset=True).items():
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

@router.post("/{transaction_id}/suggest-category")
async def suggest_category(
    transaction_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Suggest categories for a transaction based on inference"""
    # Get the transaction
    result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Build user history from past categorized transactions
    all_txns_result = await session.execute(
        select(Transaction).where(Transaction.category.isnot(None))
    )
    all_txns = all_txns_result.scalars().all()
    user_history = build_user_history(all_txns)

    # Infer categories
    suggestions = infer_category(
        transaction.merchant or "",
        transaction.description,
        transaction.amount,
        user_history
    )

    return {
        "transaction_id": transaction_id,
        "suggestions": [
            {"category": cat, "confidence": conf}
            for cat, conf in suggestions
        ]
    }

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
        for key, value in updates.dict(exclude_unset=True).items():
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

    # Get tags
    result = await session.execute(
        select(Tag)
        .join(TransactionTag)
        .where(TransactionTag.transaction_id == transaction_id)
    )
    tags = result.scalars().all()

    return {
        "transaction_id": transaction_id,
        "tags": [
            {"namespace": t.namespace, "value": t.value, "full": f"{t.namespace}:{t.value}"}
            for t in tags
        ]
    }
