from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime

from app.database import get_session
from app.models import Category, CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])

@router.get("/", response_model=List[Category])
async def list_categories(
    session: AsyncSession = Depends(get_session)
):
    """List all categories"""
    result = await session.execute(select(Category).order_by(Category.name))
    categories = result.scalars().all()
    return categories

@router.get("/{category_id}", response_model=Category)
async def get_category(
    category_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a single category by ID"""
    result = await session.execute(
        select(Category).where(Category.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.post("/", response_model=Category, status_code=201)
async def create_category(
    category: CategoryCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new category"""
    # Check if category with this name already exists
    result = await session.execute(
        select(Category).where(Category.name == category.name)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")

    db_category = Category(**category.dict())
    session.add(db_category)
    await session.commit()
    await session.refresh(db_category)
    return db_category

@router.patch("/{category_id}", response_model=Category)
async def update_category(
    category_id: int,
    category: CategoryUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a category"""
    result = await session.execute(
        select(Category).where(Category.id == category_id)
    )
    db_category = result.scalar_one_or_none()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check if new name conflicts
    if category.name:
        name_check = await session.execute(
            select(Category).where(
                Category.name == category.name,
                Category.id != category_id
            )
        )
        if name_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Category with this name already exists")

    # Update fields
    for key, value in category.dict(exclude_unset=True).items():
        setattr(db_category, key, value)

    db_category.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(db_category)
    return db_category

@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a category"""
    result = await session.execute(
        select(Category).where(Category.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await session.delete(category)
    await session.commit()
