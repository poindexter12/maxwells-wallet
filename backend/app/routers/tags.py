from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.database import get_session
from app.models import Tag, TagCreate, TagUpdate, TransactionTag

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])


@router.get("/", response_model=List[Tag])
async def list_tags(
    namespace: Optional[str] = Query(None, description="Filter by namespace (e.g., 'bucket', 'occasion')"),
    session: AsyncSession = Depends(get_session)
):
    """List all tags, optionally filtered by namespace"""
    query = select(Tag)
    if namespace:
        query = query.where(Tag.namespace == namespace)
    query = query.order_by(Tag.namespace, Tag.value)

    result = await session.execute(query)
    tags = result.scalars().all()
    return tags


@router.get("/buckets", response_model=List[Tag])
async def list_buckets(
    session: AsyncSession = Depends(get_session)
):
    """List all bucket tags (convenience endpoint for UI bucket dropdowns)"""
    result = await session.execute(
        select(Tag)
        .where(Tag.namespace == "bucket")
        .order_by(Tag.value)
    )
    return result.scalars().all()


@router.get("/{tag_id}", response_model=Tag)
async def get_tag(
    tag_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a single tag by ID"""
    result = await session.execute(
        select(Tag).where(Tag.id == tag_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.get("/by-name/{namespace}/{value}", response_model=Tag)
async def get_tag_by_name(
    namespace: str,
    value: str,
    session: AsyncSession = Depends(get_session)
):
    """Get a tag by namespace and value"""
    result = await session.execute(
        select(Tag).where(
            and_(Tag.namespace == namespace, Tag.value == value)
        )
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.post("/", response_model=Tag, status_code=201)
async def create_tag(
    tag: TagCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new tag"""
    # Check if tag with this namespace:value already exists
    result = await session.execute(
        select(Tag).where(
            and_(Tag.namespace == tag.namespace, Tag.value == tag.value)
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Tag '{tag.namespace}:{tag.value}' already exists"
        )

    db_tag = Tag(**tag.model_dump())
    session.add(db_tag)
    await session.commit()
    await session.refresh(db_tag)
    return db_tag


@router.patch("/{tag_id}", response_model=Tag)
async def update_tag(
    tag_id: int,
    tag: TagUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a tag (only description can be changed)"""
    result = await session.execute(
        select(Tag).where(Tag.id == tag_id)
    )
    db_tag = result.scalar_one_or_none()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Update fields
    for key, value in tag.model_dump(exclude_unset=True).items():
        setattr(db_tag, key, value)

    db_tag.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(db_tag)
    return db_tag


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a tag (will fail if tag is in use)"""
    result = await session.execute(
        select(Tag).where(Tag.id == tag_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check if tag is in use
    usage_result = await session.execute(
        select(func.count()).select_from(TransactionTag).where(TransactionTag.tag_id == tag_id)
    )
    usage_count = usage_result.scalar()
    if usage_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete tag: it is used by {usage_count} transaction(s)"
        )

    # Warn for bucket tags
    if tag.namespace == "bucket":
        # Allow deletion but this is a soft warning (frontend should confirm)
        pass

    await session.delete(tag)
    await session.commit()


@router.get("/{tag_id}/usage-count")
async def get_tag_usage_count(
    tag_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get the number of transactions using this tag"""
    result = await session.execute(
        select(Tag).where(Tag.id == tag_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    usage_result = await session.execute(
        select(func.count()).select_from(TransactionTag).where(TransactionTag.tag_id == tag_id)
    )
    count = usage_result.scalar()

    return {"tag_id": tag_id, "usage_count": count}
