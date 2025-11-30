"""Transfer detection and management router"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import re

from app.database import get_session
from app.models import Transaction


router = APIRouter(prefix="/api/v1/transfers", tags=["transfers"])


# Patterns that indicate a transaction is likely a transfer
TRANSFER_PATTERNS = [
    r"(?i)payment.*thank",
    r"(?i)autopay",
    r"(?i)auto\s*pay",
    r"(?i)online\s*(pmt|payment)",
    r"(?i)transfer\s*(from|to)",
    r"(?i)xfer",
    r"(?i)ach.*payment",
    r"(?i)bill\s*pay",
    r"(?i)electronic\s*payment",
    r"(?i)payment\s*received",
    r"(?i)credit\s*card\s*payment",
    r"(?i)bank\s*transfer",
    r"(?i)wire\s*transfer",
    r"(?i)internal\s*transfer",
    r"(?i)funds\s*transfer",
    r"(?i)mobile\s*deposit",  # Could be transfer from another account
]

# Compiled patterns for efficiency
COMPILED_PATTERNS = [re.compile(p) for p in TRANSFER_PATTERNS]


def is_likely_transfer(description: str, merchant: Optional[str] = None) -> bool:
    """Check if a transaction looks like a transfer based on patterns"""
    text_to_check = f"{description} {merchant or ''}"
    return any(pattern.search(text_to_check) for pattern in COMPILED_PATTERNS)


class MarkTransferRequest(BaseModel):
    transaction_ids: List[int]
    is_transfer: bool


class LinkTransactionRequest(BaseModel):
    linked_transaction_id: int


class TransferSuggestion(BaseModel):
    id: int
    date: str
    amount: float
    description: str
    merchant: Optional[str]
    account_source: str
    match_reason: str


@router.get("/suggestions")
async def get_transfer_suggestions(
    limit: int = 50,
    session: AsyncSession = Depends(get_session)
):
    """
    Get transactions that look like transfers but aren't marked as such.
    Useful for reviewing and confirming suggested transfers.
    """
    # Get transactions not already marked as transfer
    result = await session.execute(
        select(Transaction)
        .where(Transaction.is_transfer == False)
        .order_by(Transaction.date.desc())
        .limit(500)  # Check more than we return to find matches
    )
    transactions = result.scalars().all()

    suggestions = []
    for txn in transactions:
        if is_likely_transfer(txn.description, txn.merchant):
            # Determine which pattern matched
            text = f"{txn.description} {txn.merchant or ''}"
            match_reason = "Pattern match"
            for i, pattern in enumerate(COMPILED_PATTERNS):
                if pattern.search(text):
                    match_reason = f"Matches: {TRANSFER_PATTERNS[i]}"
                    break

            suggestions.append({
                "id": txn.id,
                "date": txn.date.isoformat(),
                "amount": txn.amount,
                "description": txn.description,
                "merchant": txn.merchant,
                "account_source": txn.account_source,
                "match_reason": match_reason
            })

            if len(suggestions) >= limit:
                break

    return {
        "count": len(suggestions),
        "suggestions": suggestions
    }


@router.post("/mark")
async def mark_as_transfer(
    request: MarkTransferRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Mark one or more transactions as transfers (or unmark them).
    Transfers are excluded from spending calculations.
    """
    if not request.transaction_ids:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")

    # Fetch all transactions
    result = await session.execute(
        select(Transaction).where(Transaction.id.in_(request.transaction_ids))
    )
    transactions = result.scalars().all()

    if len(transactions) != len(request.transaction_ids):
        found_ids = {t.id for t in transactions}
        missing_ids = set(request.transaction_ids) - found_ids
        raise HTTPException(
            status_code=404,
            detail=f"Transactions not found: {list(missing_ids)}"
        )

    # Update all transactions
    updated_count = 0
    for txn in transactions:
        if txn.is_transfer != request.is_transfer:
            txn.is_transfer = request.is_transfer
            txn.updated_at = datetime.utcnow()
            updated_count += 1

    await session.commit()

    return {
        "updated_count": updated_count,
        "is_transfer": request.is_transfer,
        "transaction_ids": request.transaction_ids
    }


@router.post("/{transaction_id}/link")
async def link_transaction(
    transaction_id: int,
    request: LinkTransactionRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Link two transactions as a transfer pair (e.g., payment from checking
    linked to payment received on credit card).
    """
    # Fetch both transactions
    result = await session.execute(
        select(Transaction).where(
            Transaction.id.in_([transaction_id, request.linked_transaction_id])
        )
    )
    transactions = {t.id: t for t in result.scalars().all()}

    if transaction_id not in transactions:
        raise HTTPException(status_code=404, detail=f"Transaction {transaction_id} not found")
    if request.linked_transaction_id not in transactions:
        raise HTTPException(
            status_code=404,
            detail=f"Linked transaction {request.linked_transaction_id} not found"
        )

    txn1 = transactions[transaction_id]
    txn2 = transactions[request.linked_transaction_id]

    # Link them bidirectionally
    txn1.linked_transaction_id = request.linked_transaction_id
    txn2.linked_transaction_id = transaction_id

    # Mark both as transfers
    txn1.is_transfer = True
    txn2.is_transfer = True

    txn1.updated_at = datetime.utcnow()
    txn2.updated_at = datetime.utcnow()

    await session.commit()

    return {
        "message": "Transactions linked successfully",
        "transaction_id": transaction_id,
        "linked_transaction_id": request.linked_transaction_id
    }


@router.delete("/{transaction_id}/link")
async def unlink_transaction(
    transaction_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Unlink a transaction from its paired transfer.
    Does not change the is_transfer flag.
    """
    result = await session.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    txn = result.scalar_one_or_none()

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not txn.linked_transaction_id:
        raise HTTPException(status_code=400, detail="Transaction is not linked")

    # Get the linked transaction and unlink it too
    linked_id = txn.linked_transaction_id
    result = await session.execute(
        select(Transaction).where(Transaction.id == linked_id)
    )
    linked_txn = result.scalar_one_or_none()

    # Unlink both
    txn.linked_transaction_id = None
    txn.updated_at = datetime.utcnow()

    if linked_txn and linked_txn.linked_transaction_id == transaction_id:
        linked_txn.linked_transaction_id = None
        linked_txn.updated_at = datetime.utcnow()

    await session.commit()

    return {
        "message": "Transaction unlinked",
        "transaction_id": transaction_id,
        "previously_linked_to": linked_id
    }


@router.get("/stats")
async def get_transfer_stats(
    session: AsyncSession = Depends(get_session)
):
    """Get statistics about transfers"""
    from sqlalchemy import func

    # Count transfers
    result = await session.execute(
        select(func.count(Transaction.id)).where(Transaction.is_transfer == True)
    )
    transfer_count = result.scalar() or 0

    # Sum transfer amounts (absolute value)
    result = await session.execute(
        select(func.sum(func.abs(Transaction.amount)))
        .where(Transaction.is_transfer == True)
    )
    transfer_total = result.scalar() or 0.0

    # Count linked pairs
    result = await session.execute(
        select(func.count(Transaction.id))
        .where(Transaction.linked_transaction_id.isnot(None))
    )
    linked_count = result.scalar() or 0

    return {
        "transfer_count": transfer_count,
        "transfer_total": round(transfer_total, 2),
        "linked_pairs": linked_count // 2  # Divide by 2 since links are bidirectional
    }
