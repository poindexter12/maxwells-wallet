"""Merchant aliases router for normalizing merchant names"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
import re

from app.database import get_session
from app.models import (
    MerchantAlias, MerchantAliasCreate, MerchantAliasUpdate,
    MerchantAliasMatchType, Transaction
)


router = APIRouter(prefix="/api/v1/merchants", tags=["merchants"])


def apply_alias_to_text(alias: MerchantAlias, text: str) -> bool:
    """Check if an alias matches the given text"""
    if not text:
        return False

    text_lower = text.lower()
    pattern_lower = alias.pattern.lower()

    if alias.match_type == MerchantAliasMatchType.exact:
        return text_lower == pattern_lower
    elif alias.match_type == MerchantAliasMatchType.contains:
        return pattern_lower in text_lower
    elif alias.match_type == MerchantAliasMatchType.regex:
        try:
            return bool(re.search(alias.pattern, text, re.IGNORECASE))
        except re.error:
            return False
    return False


@router.get("/")
async def list_merchants(
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session)
):
    """
    Get distinct merchants from transactions.
    Returns raw merchant names and their transaction counts.
    """
    result = await session.execute(
        select(
            Transaction.merchant,
            func.count(Transaction.id).label("count")
        )
        .where(Transaction.merchant.isnot(None))
        .group_by(Transaction.merchant)
        .order_by(func.count(Transaction.id).desc())
        .limit(limit)
    )
    merchants = result.all()

    return {
        "count": len(merchants),
        "merchants": [
            {"name": m.merchant, "transaction_count": m.count}
            for m in merchants
        ]
    }


@router.get("/aliases", response_model=List[MerchantAlias])
async def list_aliases(
    session: AsyncSession = Depends(get_session)
):
    """List all merchant aliases, ordered by priority (highest first)"""
    result = await session.execute(
        select(MerchantAlias).order_by(MerchantAlias.priority.desc())
    )
    return result.scalars().all()


@router.get("/aliases/{alias_id}", response_model=MerchantAlias)
async def get_alias(
    alias_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a single merchant alias by ID"""
    result = await session.execute(
        select(MerchantAlias).where(MerchantAlias.id == alias_id)
    )
    alias = result.scalar_one_or_none()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")
    return alias


@router.post("/aliases", response_model=MerchantAlias, status_code=201)
async def create_alias(
    alias: MerchantAliasCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new merchant alias"""
    # Validate regex pattern if match_type is regex
    if alias.match_type == MerchantAliasMatchType.regex:
        try:
            re.compile(alias.pattern)
        except re.error as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid regex pattern: {str(e)}"
            )

    # Check for duplicate pattern
    result = await session.execute(
        select(MerchantAlias).where(
            MerchantAlias.pattern == alias.pattern,
            MerchantAlias.match_type == alias.match_type
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Alias with pattern '{alias.pattern}' and match type '{alias.match_type}' already exists"
        )

    db_alias = MerchantAlias(**alias.model_dump())
    session.add(db_alias)
    await session.commit()
    await session.refresh(db_alias)
    return db_alias


@router.patch("/aliases/{alias_id}", response_model=MerchantAlias)
async def update_alias(
    alias_id: int,
    alias: MerchantAliasUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a merchant alias"""
    result = await session.execute(
        select(MerchantAlias).where(MerchantAlias.id == alias_id)
    )
    db_alias = result.scalar_one_or_none()
    if not db_alias:
        raise HTTPException(status_code=404, detail="Alias not found")

    # Validate regex if being updated to regex type
    update_data = alias.model_dump(exclude_unset=True)
    new_match_type = update_data.get("match_type", db_alias.match_type)
    new_pattern = update_data.get("pattern", db_alias.pattern)

    if new_match_type == MerchantAliasMatchType.regex:
        try:
            re.compile(new_pattern)
        except re.error as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid regex pattern: {str(e)}"
            )

    for key, value in update_data.items():
        setattr(db_alias, key, value)

    db_alias.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(db_alias)
    return db_alias


@router.delete("/aliases/{alias_id}", status_code=204)
async def delete_alias(
    alias_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a merchant alias"""
    result = await session.execute(
        select(MerchantAlias).where(MerchantAlias.id == alias_id)
    )
    alias = result.scalar_one_or_none()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")

    await session.delete(alias)
    await session.commit()


@router.post("/aliases/apply")
async def apply_aliases(
    dry_run: bool = Query(False, description="Preview changes without applying"),
    session: AsyncSession = Depends(get_session)
):
    """
    Apply all aliases to transactions.
    Updates the merchant field on matching transactions.
    """
    # Get all aliases ordered by priority
    result = await session.execute(
        select(MerchantAlias).order_by(MerchantAlias.priority.desc())
    )
    aliases = result.scalars().all()

    if not aliases:
        return {"message": "No aliases defined", "updated_count": 0, "updates": []}

    # Get transactions with descriptions or merchants that might need aliasing
    result = await session.execute(
        select(Transaction).where(Transaction.description.isnot(None))
    )
    transactions = result.scalars().all()

    updates = []
    alias_match_counts = {a.id: 0 for a in aliases}

    for txn in transactions:
        # Check description against aliases (highest priority first)
        for alias in aliases:
            # Check both description and current merchant
            text_to_check = txn.description
            if apply_alias_to_text(alias, text_to_check):
                old_merchant = txn.merchant
                new_merchant = alias.canonical_name

                if old_merchant != new_merchant:
                    updates.append({
                        "transaction_id": txn.id,
                        "description": txn.description,
                        "old_merchant": old_merchant,
                        "new_merchant": new_merchant,
                        "matched_alias_id": alias.id,
                        "matched_pattern": alias.pattern
                    })

                    if not dry_run:
                        txn.merchant = new_merchant
                        txn.updated_at = datetime.utcnow()

                    alias_match_counts[alias.id] += 1
                break  # Stop at first matching alias

    # Update alias match counts
    if not dry_run:
        for alias in aliases:
            if alias_match_counts[alias.id] > 0:
                alias.match_count += alias_match_counts[alias.id]
                alias.last_matched_date = datetime.utcnow()

        await session.commit()

    return {
        "dry_run": dry_run,
        "updated_count": len(updates),
        "updates": updates[:100]  # Limit response size
    }


@router.get("/aliases/suggestions")
async def get_alias_suggestions(
    min_count: int = Query(3, ge=1, description="Minimum occurrences to suggest"),
    session: AsyncSession = Depends(get_session)
):
    """
    Suggest potential merchant aliases based on similar transaction descriptions.
    Groups similar merchants and suggests canonical names.
    """
    # Get merchants with counts
    result = await session.execute(
        select(
            Transaction.merchant,
            Transaction.description,
            func.count(Transaction.id).label("count")
        )
        .where(Transaction.merchant.isnot(None))
        .group_by(Transaction.merchant)
        .having(func.count(Transaction.id) >= min_count)
        .order_by(func.count(Transaction.id).desc())
        .limit(100)
    )
    merchants = result.all()

    # Get existing aliases to exclude
    alias_result = await session.execute(
        select(MerchantAlias.pattern, MerchantAlias.canonical_name)
    )
    existing_aliases = {row.pattern.lower(): row.canonical_name for row in alias_result.all()}

    suggestions = []
    for m in merchants:
        merchant_lower = m.merchant.lower() if m.merchant else ""

        # Skip if already has an alias
        if merchant_lower in existing_aliases:
            continue

        # Look for common patterns that could be cleaned up
        suggestion = {
            "raw_merchant": m.merchant,
            "transaction_count": m.count,
            "suggested_canonical": None,
            "reason": None
        }

        # Simple heuristics for suggestions
        if m.merchant:
            # Remove common suffixes/prefixes
            cleaned = m.merchant

            # Remove location info (often after * or #)
            if "*" in cleaned:
                cleaned = cleaned.split("*")[0].strip()
            if "#" in cleaned:
                cleaned = cleaned.split("#")[0].strip()

            # Remove card number suffixes
            cleaned = re.sub(r'\d{4,}$', '', cleaned).strip()

            # Clean up excessive spaces
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()

            if cleaned != m.merchant and len(cleaned) > 2:
                suggestion["suggested_canonical"] = cleaned.title()
                suggestion["reason"] = "Cleaned location/number info"
                suggestions.append(suggestion)

    return {
        "count": len(suggestions),
        "suggestions": suggestions
    }
