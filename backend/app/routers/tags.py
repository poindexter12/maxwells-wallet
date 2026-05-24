from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from typing import List, Optional
from datetime import UTC, datetime
from app.database import get_session
from app.orm import Tag, TransactionTag, Transaction
from app.schemas import TagCreate, TagUpdate, TagResponse, TagOrderUpdate
from app.errors import ErrorCode, not_found, bad_request

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])


@router.get("/", response_model=List[TagResponse])
async def list_tags(
    namespace: Optional[str] = Query(None, description="Filter by namespace (e.g., 'bucket', 'occasion')"),
    session: AsyncSession = Depends(get_session),
):
    """List all tags, optionally filtered by namespace"""
    query = select(Tag)
    if namespace:
        query = query.where(Tag.namespace == namespace)
    query = query.order_by(Tag.namespace, Tag.sort_order, Tag.value)

    result = await session.execute(query)
    tags = result.scalars().all()
    return tags


@router.get("/buckets", response_model=List[TagResponse])
async def list_buckets(session: AsyncSession = Depends(get_session)):
    """List all bucket tags (convenience endpoint for UI bucket dropdowns)"""
    result = await session.execute(select(Tag).where(Tag.namespace == "bucket").order_by(Tag.sort_order, Tag.value))
    return result.scalars().all()


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(tag_id: int, session: AsyncSession = Depends(get_session)):
    """Get a single tag by ID"""
    result = await session.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise not_found(ErrorCode.TAG_NOT_FOUND, tag_id=tag_id)
    return tag


@router.get("/by-name/{namespace}/{value}", response_model=TagResponse)
async def get_tag_by_name(namespace: str, value: str, session: AsyncSession = Depends(get_session)):
    """Get a tag by namespace and value"""
    result = await session.execute(select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value)))
    tag = result.scalar_one_or_none()
    if not tag:
        raise not_found(ErrorCode.TAG_NOT_FOUND, namespace=namespace, value=value)
    return tag


@router.post("/", response_model=TagResponse, status_code=201)
async def create_tag(tag: TagCreate, session: AsyncSession = Depends(get_session)):
    """Create a new tag"""
    # Check if tag with this namespace:value already exists
    result = await session.execute(select(Tag).where(and_(Tag.namespace == tag.namespace, Tag.value == tag.value)))
    existing = result.scalar_one_or_none()
    if existing:
        raise bad_request(ErrorCode.TAG_ALREADY_EXISTS, namespace=tag.namespace, value=tag.value)

    db_tag = Tag(**tag.model_dump())
    session.add(db_tag)
    await session.commit()
    await session.refresh(db_tag)
    return db_tag


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(tag_id: int, tag: TagUpdate, session: AsyncSession = Depends(get_session)):
    """Update a tag's value and/or description"""
    result = await session.execute(select(Tag).where(Tag.id == tag_id))
    db_tag = result.scalar_one_or_none()
    if not db_tag:
        raise not_found(ErrorCode.TAG_NOT_FOUND, tag_id=tag_id)

    # If changing value, check for uniqueness within namespace
    if tag.value is not None and tag.value != db_tag.value:
        existing = await session.execute(
            select(Tag).where(and_(Tag.namespace == db_tag.namespace, Tag.value == tag.value))
        )
        if existing.scalar_one_or_none():
            raise bad_request(ErrorCode.TAG_ALREADY_EXISTS, namespace=db_tag.namespace, value=tag.value)

    # Update fields
    for key, value in tag.model_dump(exclude_unset=True).items():
        setattr(db_tag, key, value)

    db_tag.updated_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(db_tag)
    return db_tag


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a tag (will fail if tag is in use)"""
    result = await session.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise not_found(ErrorCode.TAG_NOT_FOUND, tag_id=tag_id)

    # Check if tag is in use
    usage_result = await session.execute(
        select(func.count()).select_from(TransactionTag).where(TransactionTag.tag_id == tag_id)
    )
    usage_count = usage_result.scalar() or 0
    if usage_count > 0:
        raise bad_request(ErrorCode.TAG_IN_USE, count=usage_count)

    # Warn for bucket tags
    if tag.namespace == "bucket":
        # Allow deletion but this is a soft warning (frontend should confirm)
        pass

    await session.delete(tag)
    await session.commit()


@router.get("/{tag_id}/usage-count")
async def get_tag_usage_count(tag_id: int, session: AsyncSession = Depends(get_session)):
    """Get the number of transactions using this tag"""
    result = await session.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise not_found(ErrorCode.TAG_NOT_FOUND, tag_id=tag_id)

    usage_result = await session.execute(
        select(func.count()).select_from(TransactionTag).where(TransactionTag.tag_id == tag_id)
    )
    count = usage_result.scalar()

    return {"tag_id": tag_id, "usage_count": count}


@router.post("/reorder")
async def reorder_tags(order: TagOrderUpdate, session: AsyncSession = Depends(get_session)):
    """Update sort_order for multiple tags at once (for drag-and-drop)"""
    for item in order.tags:
        result = await session.execute(select(Tag).where(Tag.id == item.id))
        tag = result.scalar_one_or_none()
        if tag:
            tag.sort_order = item.sort_order
            tag.updated_at = datetime.now(UTC)

    await session.commit()
    return {"success": True, "updated": len(order.tags)}


@router.get("/accounts/stats")
async def get_account_stats(session: AsyncSession = Depends(get_session)):
    """Get account statistics using account_tag_id foreign key for reliable counts"""
    # Get account tags with aggregated transaction stats via account_tag_id FK
    result = await session.execute(
        select(
            Tag,
            func.count(Transaction.id).label("count"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        )
        .outerjoin(Transaction, Transaction.account_tag_id == Tag.id)
        .where(Tag.namespace == "account")
        .group_by(Tag.id)
        .order_by(Tag.sort_order, Tag.value)
    )

    accounts = []
    for row in result.fetchall():
        tag = row[0]
        accounts.append(
            {
                "id": tag.id,
                "value": tag.value,
                "description": tag.description,
                "color": tag.color,
                "sort_order": tag.sort_order,
                "transaction_count": row[1],
                "total_amount": float(row[2]),
            }
        )

    return {"accounts": accounts}


@router.get("/buckets/stats")
async def get_bucket_stats(session: AsyncSession = Depends(get_session)):
    """Get bucket statistics including transaction counts and totals"""
    # Get bucket tags
    tags_result = await session.execute(
        select(Tag).where(Tag.namespace == "bucket").order_by(Tag.sort_order, Tag.value)
    )
    bucket_tags = tags_result.scalars().all()

    # Get usage counts for each bucket via transaction_tags
    buckets = []
    for tag in bucket_tags:
        # Count transactions with this tag
        count_result = await session.execute(
            select(func.count()).select_from(TransactionTag).where(TransactionTag.tag_id == tag.id)
        )
        txn_count = count_result.scalar() or 0

        # Get total amount for transactions with this tag
        amount_result = await session.execute(
            select(func.sum(Transaction.amount))
            .select_from(Transaction)
            .join(TransactionTag, Transaction.id == TransactionTag.transaction_id)
            .where(TransactionTag.tag_id == tag.id)
        )
        total_amount = amount_result.scalar() or 0

        buckets.append(
            {
                "id": tag.id,
                "value": tag.value,
                "description": tag.description,
                "color": tag.color,
                "sort_order": tag.sort_order,
                "transaction_count": txn_count,
                "total_amount": total_amount,
            }
        )

    return {"buckets": buckets}


@router.get("/occasions/stats")
async def get_occasion_stats(session: AsyncSession = Depends(get_session)):
    """Get occasion statistics including transaction counts and totals"""
    # Get occasion tags
    tags_result = await session.execute(
        select(Tag).where(Tag.namespace == "occasion").order_by(Tag.sort_order, Tag.value)
    )
    occasion_tags = tags_result.scalars().all()

    # Get usage counts for each occasion via transaction_tags
    occasions = []
    for tag in occasion_tags:
        # Count transactions with this tag
        count_result = await session.execute(
            select(func.count()).select_from(TransactionTag).where(TransactionTag.tag_id == tag.id)
        )
        txn_count = count_result.scalar() or 0

        # Get total amount for transactions with this tag
        amount_result = await session.execute(
            select(func.sum(Transaction.amount))
            .select_from(Transaction)
            .join(TransactionTag, Transaction.id == TransactionTag.transaction_id)
            .where(TransactionTag.tag_id == tag.id)
        )
        total_amount = amount_result.scalar() or 0

        occasions.append(
            {
                "id": tag.id,
                "value": tag.value,
                "description": tag.description,
                "color": tag.color,
                "sort_order": tag.sort_order,
                "transaction_count": txn_count,
                "total_amount": total_amount,
            }
        )

    return {"occasions": occasions}
