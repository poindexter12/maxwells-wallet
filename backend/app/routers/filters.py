"""Saved filters router for managing saved search filters/views."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import UTC, date, datetime, timedelta
import json

from app.database import get_session
from app.orm import ReconciliationStatus, SavedFilter, Transaction
from app.schemas import SavedFilterCreate, SavedFilterUpdate, TransactionResponse
from app.routers.transactions import build_transaction_filter_query
from app.errors import ErrorCode, not_found
from pydantic import BaseModel


router = APIRouter(prefix="/api/v1/filters", tags=["filters"])


class SavedFilterResponse(BaseModel):
    """Response model for saved filter with parsed lists"""

    id: int
    name: str
    description: Optional[str] = None
    accounts: Optional[List[str]] = None
    accounts_exclude: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    tags_exclude: Optional[List[str]] = None
    search: Optional[str] = None
    search_regex: bool = False
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    reconciliation_status: Optional[str] = None
    is_transfer: Optional[bool] = None
    category: Optional[str] = None
    date_range_type: Optional[str] = None
    relative_days: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    use_count: int = 0
    last_used_at: Optional[datetime] = None
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime


def db_to_response(db_filter: SavedFilter) -> SavedFilterResponse:
    """Convert database model to response model with parsed JSON arrays."""
    return SavedFilterResponse(
        id=db_filter.id,
        name=db_filter.name,
        description=db_filter.description,
        accounts=json.loads(db_filter.accounts) if db_filter.accounts else None,
        accounts_exclude=json.loads(db_filter.accounts_exclude) if db_filter.accounts_exclude else None,
        tags=json.loads(db_filter.tags) if db_filter.tags else None,
        tags_exclude=json.loads(db_filter.tags_exclude) if db_filter.tags_exclude else None,
        search=db_filter.search,
        search_regex=db_filter.search_regex,
        amount_min=db_filter.amount_min,
        amount_max=db_filter.amount_max,
        reconciliation_status=db_filter.reconciliation_status,
        is_transfer=db_filter.is_transfer,
        category=db_filter.category,
        date_range_type=db_filter.date_range_type,
        relative_days=db_filter.relative_days,
        start_date=db_filter.start_date,
        end_date=db_filter.end_date,
        use_count=db_filter.use_count,
        last_used_at=db_filter.last_used_at,
        is_pinned=db_filter.is_pinned,
        created_at=db_filter.created_at,
        updated_at=db_filter.updated_at,
    )


@router.get("/", response_model=List[SavedFilterResponse])
async def list_filters(
    pinned_only: bool = Query(False, description="Only return pinned filters"),
    session: AsyncSession = Depends(get_session),
):
    """List all saved filters, ordered by pinned status and use count."""
    query = select(SavedFilter)
    if pinned_only:
        query = query.where(SavedFilter.is_pinned.is_(True))
    query = query.order_by(SavedFilter.is_pinned.desc(), SavedFilter.use_count.desc())

    result = await session.execute(query)
    filters = result.scalars().all()
    return [db_to_response(f) for f in filters]


@router.post("/", response_model=SavedFilterResponse, status_code=201)
async def create_filter(filter_create: SavedFilterCreate, session: AsyncSession = Depends(get_session)):
    """Create a new saved filter."""
    db_filter = SavedFilter(
        name=filter_create.name,
        description=filter_create.description,
        accounts=json.dumps(filter_create.accounts) if filter_create.accounts else None,
        accounts_exclude=json.dumps(filter_create.accounts_exclude) if filter_create.accounts_exclude else None,
        tags=json.dumps(filter_create.tags) if filter_create.tags else None,
        tags_exclude=json.dumps(filter_create.tags_exclude) if filter_create.tags_exclude else None,
        search=filter_create.search,
        search_regex=filter_create.search_regex,
        amount_min=filter_create.amount_min,
        amount_max=filter_create.amount_max,
        reconciliation_status=filter_create.reconciliation_status.value
        if filter_create.reconciliation_status
        else None,
        is_transfer=filter_create.is_transfer,
        category=filter_create.category,
        date_range_type=filter_create.date_range_type,
        relative_days=filter_create.relative_days,
        start_date=filter_create.start_date,
        end_date=filter_create.end_date,
        is_pinned=filter_create.is_pinned,
    )

    session.add(db_filter)
    await session.commit()
    await session.refresh(db_filter)
    return db_to_response(db_filter)


@router.get("/{filter_id}", response_model=SavedFilterResponse)
async def get_filter(filter_id: int, session: AsyncSession = Depends(get_session)):
    """Get a single saved filter by ID."""
    result = await session.execute(select(SavedFilter).where(SavedFilter.id == filter_id))
    db_filter = result.scalar_one_or_none()
    if not db_filter:
        raise not_found(ErrorCode.FILTER_NOT_FOUND, filter_id=filter_id)
    return db_to_response(db_filter)


@router.patch("/{filter_id}", response_model=SavedFilterResponse)
async def update_filter(filter_id: int, filter_update: SavedFilterUpdate, session: AsyncSession = Depends(get_session)):
    """Update a saved filter."""
    result = await session.execute(select(SavedFilter).where(SavedFilter.id == filter_id))
    db_filter = result.scalar_one_or_none()
    if not db_filter:
        raise not_found(ErrorCode.FILTER_NOT_FOUND, filter_id=filter_id)

    update_data = filter_update.model_dump(exclude_unset=True)

    # Convert lists to JSON strings for storage
    for field in ["accounts", "accounts_exclude", "tags", "tags_exclude"]:
        if field in update_data and update_data[field] is not None:
            update_data[field] = json.dumps(update_data[field])

    # Convert enum to string
    if "reconciliation_status" in update_data and update_data["reconciliation_status"] is not None:
        update_data["reconciliation_status"] = update_data["reconciliation_status"].value

    for key, value in update_data.items():
        setattr(db_filter, key, value)

    db_filter.updated_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(db_filter)
    return db_to_response(db_filter)


@router.delete("/{filter_id}", status_code=204)
async def delete_filter(filter_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a saved filter."""
    result = await session.execute(select(SavedFilter).where(SavedFilter.id == filter_id))
    db_filter = result.scalar_one_or_none()
    if not db_filter:
        raise not_found(ErrorCode.FILTER_NOT_FOUND, filter_id=filter_id)

    await session.delete(db_filter)
    await session.commit()


@router.post("/{filter_id}/apply", response_model=List[TransactionResponse])
async def apply_filter(
    filter_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    """Apply a saved filter and return matching transactions.

    Also updates the filter's use_count and last_used_at.
    """
    result = await session.execute(select(SavedFilter).where(SavedFilter.id == filter_id))
    db_filter = result.scalar_one_or_none()
    if not db_filter:
        raise not_found(ErrorCode.FILTER_NOT_FOUND, filter_id=filter_id)

    # Update usage stats
    db_filter.use_count += 1
    db_filter.last_used_at = datetime.now(UTC)

    # Calculate actual dates if using relative date range
    start_date = db_filter.start_date
    end_date = db_filter.end_date
    if db_filter.date_range_type == "relative" and db_filter.relative_days:
        end_date = date.today()
        start_date = end_date - timedelta(days=db_filter.relative_days)

    # Parse JSON arrays
    accounts = json.loads(db_filter.accounts) if db_filter.accounts else None
    accounts_exclude = json.loads(db_filter.accounts_exclude) if db_filter.accounts_exclude else None
    tags = json.loads(db_filter.tags) if db_filter.tags else None
    tags_exclude = json.loads(db_filter.tags_exclude) if db_filter.tags_exclude else None

    # Parse reconciliation status
    reconciliation_status = None
    if db_filter.reconciliation_status:
        reconciliation_status = ReconciliationStatus(db_filter.reconciliation_status)

    # Build and execute query
    base_query = select(Transaction)
    query = build_transaction_filter_query(
        base_query,
        account=accounts,
        account_exclude=accounts_exclude,
        category=db_filter.category,
        reconciliation_status=reconciliation_status,
        start_date=start_date,
        end_date=end_date,
        search=db_filter.search,
        search_regex=db_filter.search_regex,
        amount_min=db_filter.amount_min,
        amount_max=db_filter.amount_max,
        tag=tags,
        tag_exclude=tags_exclude,
        is_transfer=db_filter.is_transfer,
    )

    query = query.order_by(Transaction.date.desc()).offset(skip).limit(limit)

    txn_result = await session.execute(query)
    transactions = txn_result.scalars().all()

    await session.commit()

    return transactions


@router.post("/{filter_id}/toggle-pin", response_model=SavedFilterResponse)
async def toggle_pin(filter_id: int, session: AsyncSession = Depends(get_session)):
    """Toggle the pinned status of a filter."""
    result = await session.execute(select(SavedFilter).where(SavedFilter.id == filter_id))
    db_filter = result.scalar_one_or_none()
    if not db_filter:
        raise not_found(ErrorCode.FILTER_NOT_FOUND, filter_id=filter_id)

    db_filter.is_pinned = not db_filter.is_pinned
    db_filter.updated_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(db_filter)
    return db_to_response(db_filter)
