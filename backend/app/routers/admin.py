from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime

from app.database import get_session
from app.models import Transaction, ImportSession

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/import-sessions")
async def list_import_sessions(
    session: AsyncSession = Depends(get_session)
):
    """List all import sessions with stats"""
    result = await session.execute(
        select(ImportSession).order_by(ImportSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return sessions


@router.get("/import-sessions/{session_id}")
async def get_import_session(
    session_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get details of a specific import session"""
    result = await session.execute(
        select(ImportSession).where(ImportSession.id == session_id)
    )
    import_session = result.scalar_one_or_none()
    if not import_session:
        raise HTTPException(status_code=404, detail="Import session not found")

    # Get associated transactions
    txn_result = await session.execute(
        select(Transaction).where(Transaction.import_session_id == session_id)
    )
    transactions = txn_result.scalars().all()

    return {
        "session": import_session,
        "transactions": transactions
    }


@router.delete("/import-sessions/{session_id}")
async def delete_import_session(
    session_id: int,
    confirm: str = Query(..., description="Must be 'DELETE' to confirm"),
    session: AsyncSession = Depends(get_session)
):
    """
    Delete an import session and all its transactions.

    ⚠️ WARNING: This permanently deletes all transactions from this import.
    This action cannot be undone.

    Pass confirm='DELETE' to confirm deletion.
    """
    if confirm != "DELETE":
        raise HTTPException(
            status_code=400,
            detail="Must pass confirm='DELETE' to confirm deletion"
        )

    result = await session.execute(
        select(ImportSession).where(ImportSession.id == session_id)
    )
    import_session = result.scalar_one_or_none()
    if not import_session:
        raise HTTPException(status_code=404, detail="Import session not found")

    # Count transactions that will be deleted
    count_result = await session.execute(
        select(func.count()).where(Transaction.import_session_id == session_id)
    )
    txn_count = count_result.scalar()

    # Delete transactions first
    txn_result = await session.execute(
        select(Transaction).where(Transaction.import_session_id == session_id)
    )
    transactions = txn_result.scalars().all()
    for txn in transactions:
        await session.delete(txn)

    # Mark session as rolled back (keep for audit)
    import_session.status = "rolled_back"
    import_session.updated_at = datetime.utcnow()

    await session.commit()

    return {
        "deleted_transactions": txn_count,
        "session_status": "rolled_back"
    }


@router.delete("/transactions/purge-all")
async def purge_all_transactions(
    confirm: str = Query(..., description="Must be 'PURGE_ALL' to confirm"),
    session: AsyncSession = Depends(get_session)
):
    """
    ⚠️ DANGER: Delete ALL transactions from the database.

    This is a destructive operation that cannot be undone.
    Use with extreme caution.

    Pass confirm='PURGE_ALL' to confirm deletion.
    """
    if confirm != "PURGE_ALL":
        raise HTTPException(
            status_code=400,
            detail="Must pass confirm='PURGE_ALL' to confirm purge"
        )

    # Count transactions
    count_result = await session.execute(select(func.count()).select_from(Transaction))
    total_count = count_result.scalar()

    # Delete all transactions
    result = await session.execute(select(Transaction))
    transactions = result.scalars().all()
    for txn in transactions:
        await session.delete(txn)

    # Mark all import sessions as rolled back
    sessions_result = await session.execute(select(ImportSession))
    import_sessions = sessions_result.scalars().all()
    for imp_session in import_sessions:
        imp_session.status = "rolled_back"
        imp_session.updated_at = datetime.utcnow()

    await session.commit()

    return {
        "deleted_transactions": total_count,
        "message": "All transactions have been purged"
    }


@router.get("/stats")
async def get_admin_stats(
    session: AsyncSession = Depends(get_session)
):
    """Get database statistics for admin dashboard"""
    # Total transactions
    txn_count_result = await session.execute(
        select(func.count()).select_from(Transaction)
    )
    total_transactions = txn_count_result.scalar()

    # Transactions by account source
    account_stats_result = await session.execute(
        select(
            Transaction.account_source,
            func.count().label('count'),
            func.sum(Transaction.amount).label('total')
        ).group_by(Transaction.account_source)
    )
    account_stats = [
        {"account": row[0], "count": row[1], "total": row[2]}
        for row in account_stats_result.fetchall()
    ]

    # Import sessions
    session_count_result = await session.execute(
        select(func.count()).select_from(ImportSession)
    )
    total_sessions = session_count_result.scalar()

    # Sessions by status
    status_result = await session.execute(
        select(
            ImportSession.status,
            func.count().label('count')
        ).group_by(ImportSession.status)
    )
    session_status = {row[0]: row[1] for row in status_result.fetchall()}

    return {
        "total_transactions": total_transactions,
        "account_stats": account_stats,
        "total_import_sessions": total_sessions,
        "import_session_status": session_status
    }
