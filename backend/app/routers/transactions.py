from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date, datetime

from app.database import get_session
from app.models import (
    Transaction, TransactionCreate, TransactionUpdate,
    ReconciliationStatus
)
from app.category_inference import infer_category, build_user_history

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
