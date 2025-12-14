from fastapi import APIRouter, Depends, Query, Body
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal
from datetime import datetime
from pydantic import BaseModel

from app.database import get_session
from app.models import (
    Transaction,
    ImportSession,
    BatchImportSession,
    Tag,
    TransactionTag,
    Budget,
    TagRule,
    RecurringPattern,
    MerchantAlias,
    SavedFilter,
    Dashboard,
    DashboardWidget,
    ImportFormat,
    CustomFormatConfig,
    AppSettings,
)
from app.errors import ErrorCode, not_found, bad_request
from app.services.backup import backup_service, BackupMetadata


class CreateBackupRequest(BaseModel):
    """Request body for creating a backup."""

    description: str = ""
    source: Literal["manual", "scheduled", "pre_import", "demo_seed"] = "manual"
    is_demo_backup: bool = False


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/import-sessions")
async def list_import_sessions(session: AsyncSession = Depends(get_session)):
    """List all import sessions with stats"""
    result = await session.execute(select(ImportSession).order_by(ImportSession.created_at.desc()))
    sessions = result.scalars().all()
    return sessions


@router.get("/import-sessions/{session_id}")
async def get_import_session(session_id: int, session: AsyncSession = Depends(get_session)):
    """Get details of a specific import session"""
    result = await session.execute(select(ImportSession).where(ImportSession.id == session_id))
    import_session = result.scalar_one_or_none()
    if not import_session:
        raise not_found(ErrorCode.IMPORT_SESSION_NOT_FOUND, session_id=session_id)

    # Get associated transactions
    txn_result = await session.execute(select(Transaction).where(Transaction.import_session_id == session_id))
    transactions = txn_result.scalars().all()

    return {"session": import_session, "transactions": transactions}


@router.delete("/import-sessions/{session_id}")
async def delete_import_session(
    session_id: int,
    confirm: str = Query(..., description="Must be 'DELETE' to confirm"),
    session: AsyncSession = Depends(get_session),
):
    """
    Delete an import session and all its transactions.

    ⚠️ WARNING: This permanently deletes all transactions from this import.
    This action cannot be undone.

    Pass confirm='DELETE' to confirm deletion.
    """
    if confirm != "DELETE":
        raise bad_request(
            ErrorCode.CONFIRMATION_REQUIRED, "Must pass confirm='DELETE' to confirm deletion", expected="DELETE"
        )

    result = await session.execute(select(ImportSession).where(ImportSession.id == session_id))
    import_session = result.scalar_one_or_none()
    if not import_session:
        raise not_found(ErrorCode.IMPORT_SESSION_NOT_FOUND, session_id=session_id)

    # Count transactions that will be deleted
    count_result = await session.execute(select(func.count()).where(Transaction.import_session_id == session_id))
    txn_count = count_result.scalar()

    # Delete transactions first
    txn_result = await session.execute(select(Transaction).where(Transaction.import_session_id == session_id))
    transactions = txn_result.scalars().all()
    for txn in transactions:
        await session.delete(txn)

    # Mark session as rolled back (keep for audit)
    import_session.status = "rolled_back"
    import_session.updated_at = datetime.utcnow()

    await session.commit()

    return {"deleted_transactions": txn_count, "session_status": "rolled_back"}


@router.delete("/purge-all")
async def purge_all_data(
    confirm: str = Query(..., description="Must be 'PURGE_ALL' to confirm"),
    session: AsyncSession = Depends(get_session),
):
    """
    ⚠️ DANGER: Reset the entire application to a clean state.

    This deletes:
    - All transactions and import sessions
    - All budgets
    - All tag rules
    - All recurring patterns
    - All merchant aliases
    - All saved filters
    - All dashboards (except default)
    - All bucket/occasion tags (keeps account tags, bucket:none)
    - All custom format configs
    - Resets app settings to defaults

    Returns clear_browser_storage=true to signal frontend to clear localStorage.

    This is a destructive operation that cannot be undone.
    Pass confirm='PURGE_ALL' to confirm.
    """
    if confirm != "PURGE_ALL":
        raise bad_request(
            ErrorCode.CONFIRMATION_REQUIRED, "Must pass confirm='PURGE_ALL' to confirm purge", expected="PURGE_ALL"
        )

    counts = {}

    # 1. Delete all transaction tags (junction table)
    txn_tags_result = await session.execute(select(TransactionTag))
    txn_tags = txn_tags_result.scalars().all()
    counts["transaction_tags"] = len(txn_tags)
    for tt in txn_tags:
        await session.delete(tt)

    # 2. Delete all transactions
    txn_result = await session.execute(select(Transaction))
    transactions = txn_result.scalars().all()
    counts["transactions"] = len(transactions)
    for txn in transactions:
        await session.delete(txn)

    # 3. Delete all import sessions
    import_result = await session.execute(select(ImportSession))
    import_sessions = import_result.scalars().all()
    counts["import_sessions"] = len(import_sessions)
    for imp in import_sessions:
        await session.delete(imp)

    # 4. Delete all batch import sessions
    batch_result = await session.execute(select(BatchImportSession))
    batch_sessions = batch_result.scalars().all()
    counts["batch_import_sessions"] = len(batch_sessions)
    for batch in batch_sessions:
        await session.delete(batch)

    # 5. Delete all budgets
    budget_result = await session.execute(select(Budget))
    budgets = budget_result.scalars().all()
    counts["budgets"] = len(budgets)
    for budget in budgets:
        await session.delete(budget)

    # 6. Delete all tag rules
    rule_result = await session.execute(select(TagRule))
    rules = rule_result.scalars().all()
    counts["tag_rules"] = len(rules)
    for rule in rules:
        await session.delete(rule)

    # 7. Delete all recurring patterns
    pattern_result = await session.execute(select(RecurringPattern))
    patterns = pattern_result.scalars().all()
    counts["recurring_patterns"] = len(patterns)
    for pattern in patterns:
        await session.delete(pattern)

    # 8. Delete all merchant aliases
    alias_result = await session.execute(select(MerchantAlias))
    aliases = alias_result.scalars().all()
    counts["merchant_aliases"] = len(aliases)
    for alias in aliases:
        await session.delete(alias)

    # 9. Delete all saved filters
    filter_result = await session.execute(select(SavedFilter))
    filters = filter_result.scalars().all()
    counts["saved_filters"] = len(filters)
    for f in filters:
        await session.delete(f)

    # 10. Delete dashboard widgets (must be before dashboards)
    widget_result = await session.execute(select(DashboardWidget))
    widgets = widget_result.scalars().all()
    counts["dashboard_widgets"] = len(widgets)
    for widget in widgets:
        await session.delete(widget)

    # 11. Delete non-default dashboards, reset default dashboard
    dashboard_result = await session.execute(select(Dashboard))
    dashboards = dashboard_result.scalars().all()
    counts["dashboards_deleted"] = 0
    for dashboard in dashboards:
        if dashboard.is_default:
            # Reset default dashboard to clean state
            dashboard.name = "Dashboard"
            dashboard.description = None
        else:
            await session.delete(dashboard)
            counts["dashboards_deleted"] += 1

    # 12. Delete bucket and occasion tags (keep account tags and bucket:none)
    tag_result = await session.execute(select(Tag))
    tags = tag_result.scalars().all()
    counts["tags_deleted"] = 0
    for tag in tags:
        # Keep account tags (they're tied to account metadata)
        if tag.namespace == "account":
            continue
        # Keep bucket:none (system default)
        if tag.namespace == "bucket" and tag.value == "none":
            continue
        await session.delete(tag)
        counts["tags_deleted"] += 1

    # 13. Delete import formats
    format_result = await session.execute(select(ImportFormat))
    formats = format_result.scalars().all()
    counts["import_formats"] = len(formats)
    for fmt in formats:
        await session.delete(fmt)

    # 14. Delete custom format configs
    config_result = await session.execute(select(CustomFormatConfig))
    configs = config_result.scalars().all()
    counts["custom_format_configs"] = len(configs)
    for config in configs:
        await session.delete(config)

    # 15. Reset app settings to defaults
    settings_result = await session.execute(select(AppSettings))
    settings = settings_result.scalar_one_or_none()
    if settings:
        await session.delete(settings)
        counts["app_settings_reset"] = True
    else:
        counts["app_settings_reset"] = False

    await session.commit()

    return {
        "success": True,
        "counts": counts,
        "clear_browser_storage": True,  # Signal frontend to clear localStorage
        "message": "All data has been purged. Application reset to clean state.",
    }


@router.get("/stats")
async def get_admin_stats(session: AsyncSession = Depends(get_session)):
    """Get database statistics for admin dashboard"""
    # Total transactions
    txn_count_result = await session.execute(select(func.count()).select_from(Transaction))
    total_transactions = txn_count_result.scalar()

    # Transactions by account source
    account_stats_result = await session.execute(
        select(
            Transaction.account_source, func.count().label("count"), func.sum(Transaction.amount).label("total")
        ).group_by(Transaction.account_source)
    )
    account_stats = [{"account": row[0], "count": row[1], "total": row[2]} for row in account_stats_result.fetchall()]

    # Import sessions
    session_count_result = await session.execute(select(func.count()).select_from(ImportSession))
    total_sessions = session_count_result.scalar()

    # Sessions by status
    status_result = await session.execute(
        select(ImportSession.status, func.count().label("count")).group_by(ImportSession.status)
    )
    session_status = {row[0]: row[1] for row in status_result.fetchall()}

    return {
        "total_transactions": total_transactions,
        "account_stats": account_stats,
        "total_import_sessions": total_sessions,
        "import_session_status": session_status,
    }


# ============================================================================
# Backup Management Endpoints
# ============================================================================


@router.get("/backups", response_model=list[BackupMetadata])
async def list_backups():
    """List all available database backups."""
    return backup_service.list_backups()


@router.post("/backup", response_model=BackupMetadata)
async def create_backup(request: CreateBackupRequest = Body(default=CreateBackupRequest())):
    """
    Create a new database backup.

    The backup will be stored as a gzip-compressed copy of the SQLite database.
    GFS retention policy automatically manages backup cleanup.
    """
    return backup_service.create_backup(
        description=request.description,
        source=request.source,
        is_demo_backup=request.is_demo_backup,
    )


@router.get("/backup/{backup_id}", response_model=BackupMetadata)
async def get_backup(backup_id: str):
    """Get metadata for a specific backup."""
    backup = backup_service.get_backup(backup_id)
    if backup is None:
        raise not_found(ErrorCode.BACKUP_NOT_FOUND, backup_id=backup_id)
    return backup


@router.post("/restore/{backup_id}")
async def restore_backup(
    backup_id: str,
    confirm: str = Query(..., description="Must be 'RESTORE' to confirm"),
):
    """
    Restore the database from a backup.

    WARNING: This will replace the current database with the backup.
    All changes since the backup was created will be lost.

    Pass confirm='RESTORE' to confirm the restore operation.
    """
    if confirm != "RESTORE":
        raise bad_request(
            ErrorCode.CONFIRMATION_REQUIRED, "Must pass confirm='RESTORE' to confirm restore", expected="RESTORE"
        )

    backup = backup_service.get_backup(backup_id)
    if backup is None:
        raise not_found(ErrorCode.BACKUP_NOT_FOUND, backup_id=backup_id)

    backup_service.restore_backup(backup_id)

    return {
        "success": True,
        "message": f"Database restored from backup {backup_id}",
        "backup": backup,
        "clear_browser_storage": True,  # Signal frontend to refresh
    }


@router.delete("/backup/{backup_id}")
async def delete_backup(
    backup_id: str,
    confirm: str = Query(..., description="Must be 'DELETE' to confirm"),
):
    """
    Delete a backup.

    Cannot delete the demo backup. Pass confirm='DELETE' to confirm.
    """
    if confirm != "DELETE":
        raise bad_request(
            ErrorCode.CONFIRMATION_REQUIRED, "Must pass confirm='DELETE' to confirm deletion", expected="DELETE"
        )

    backup = backup_service.get_backup(backup_id)
    if backup is None:
        raise not_found(ErrorCode.BACKUP_NOT_FOUND, backup_id=backup_id)

    if backup.is_demo_backup:
        raise bad_request(ErrorCode.CANNOT_DELETE_DEMO_BACKUP, "Cannot delete the demo backup")

    backup_service.delete_backup(backup_id)

    return {
        "success": True,
        "message": f"Backup {backup_id} deleted",
    }


@router.post("/backup/{backup_id}/set-demo")
async def set_demo_backup(backup_id: str):
    """
    Mark a backup as the demo backup.

    The demo backup is used for automatic resets in demo mode.
    Only one backup can be the demo backup at a time.
    """
    backup = backup_service.get_backup(backup_id)
    if backup is None:
        raise not_found(ErrorCode.BACKUP_NOT_FOUND, backup_id=backup_id)

    backup_service.set_demo_backup(backup_id)

    return {
        "success": True,
        "message": f"Backup {backup_id} is now the demo backup",
    }
