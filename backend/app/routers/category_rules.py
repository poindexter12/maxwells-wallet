from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime
import re

from app.database import get_session
from app.models import (
    CategoryRule, CategoryRuleCreate, CategoryRuleUpdate,
    Transaction, TransactionUpdate
)

router = APIRouter(prefix="/api/v1/category-rules", tags=["category-rules"])


def match_rule(transaction: Transaction, rule: CategoryRule) -> bool:
    """
    Check if a transaction matches a category rule

    Returns True if the transaction matches the rule conditions
    """
    matches = []

    # Check merchant pattern
    if rule.merchant_pattern:
        merchant = transaction.merchant or ""
        # Case-insensitive substring match
        pattern_match = rule.merchant_pattern.lower() in merchant.lower()
        matches.append(pattern_match)

    # Check description pattern
    if rule.description_pattern:
        description = transaction.description or ""
        # Case-insensitive substring match
        pattern_match = rule.description_pattern.lower() in description.lower()
        matches.append(pattern_match)

    # Check amount range
    if rule.amount_min is not None or rule.amount_max is not None:
        amount = abs(transaction.amount)  # Use absolute value for comparison
        if rule.amount_min is not None and rule.amount_max is not None:
            amount_match = rule.amount_min <= amount <= rule.amount_max
        elif rule.amount_min is not None:
            amount_match = amount >= rule.amount_min
        else:  # amount_max is not None
            amount_match = amount <= rule.amount_max
        matches.append(amount_match)

    # Check account source
    if rule.account_source:
        account_match = transaction.account_source == rule.account_source
        matches.append(account_match)

    # If no conditions specified, don't match
    if not matches:
        return False

    # Apply AND/OR logic
    if rule.match_all:
        return all(matches)  # All conditions must match
    else:
        return any(matches)  # Any condition can match


@router.get("/", response_model=List[CategoryRule])
async def list_rules(
    session: AsyncSession = Depends(get_session)
):
    """List all category rules ordered by priority (highest first)"""
    result = await session.execute(
        select(CategoryRule).order_by(CategoryRule.priority.desc(), CategoryRule.created_at)
    )
    rules = result.scalars().all()
    return rules


@router.get("/{rule_id}", response_model=CategoryRule)
async def get_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a single category rule by ID"""
    result = await session.execute(
        select(CategoryRule).where(CategoryRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.post("/", response_model=CategoryRule, status_code=201)
async def create_rule(
    rule: CategoryRuleCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new category rule"""
    # Validate that at least one match condition is specified
    if not any([
        rule.merchant_pattern,
        rule.description_pattern,
        rule.amount_min is not None,
        rule.amount_max is not None,
        rule.account_source
    ]):
        raise HTTPException(
            status_code=400,
            detail="At least one match condition must be specified"
        )

    db_rule = CategoryRule(**rule.model_dump())
    session.add(db_rule)
    await session.commit()
    await session.refresh(db_rule)
    return db_rule


@router.patch("/{rule_id}", response_model=CategoryRule)
async def update_rule(
    rule_id: int,
    rule: CategoryRuleUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a category rule"""
    result = await session.execute(
        select(CategoryRule).where(CategoryRule.id == rule_id)
    )
    db_rule = result.scalar_one_or_none()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Update fields
    for key, value in rule.model_dump(exclude_unset=True).items():
        setattr(db_rule, key, value)

    db_rule.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(db_rule)
    return db_rule


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a category rule"""
    result = await session.execute(
        select(CategoryRule).where(CategoryRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await session.delete(rule)
    await session.commit()


@router.post("/{rule_id}/test")
async def test_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Test a rule against existing transactions

    Returns matching transactions (preview mode)
    """
    # Get the rule
    rule_result = await session.execute(
        select(CategoryRule).where(CategoryRule.id == rule_id)
    )
    rule = rule_result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Get all transactions
    txn_result = await session.execute(select(Transaction))
    transactions = txn_result.scalars().all()

    # Test rule against each transaction
    matching_transactions = []
    for txn in transactions:
        if match_rule(txn, rule):
            matching_transactions.append({
                "id": txn.id,
                "date": txn.date,
                "merchant": txn.merchant,
                "description": txn.description,
                "amount": txn.amount,
                "current_category": txn.category,
                "would_be_category": rule.category
            })

    return {
        "rule_id": rule_id,
        "rule_name": rule.name,
        "target_category": rule.category,
        "match_count": len(matching_transactions),
        "matches": matching_transactions[:50]  # Limit to 50 for preview
    }


@router.post("/apply")
async def apply_rules(
    session: AsyncSession = Depends(get_session)
):
    """
    Apply all enabled rules to uncategorized transactions

    Rules are applied in priority order (highest first)
    """
    # Get all enabled rules ordered by priority
    rules_result = await session.execute(
        select(CategoryRule)
        .where(CategoryRule.enabled == True)
        .order_by(CategoryRule.priority.desc(), CategoryRule.created_at)
    )
    rules = rules_result.scalars().all()

    if not rules:
        return {
            "applied_count": 0,
            "message": "No enabled rules found"
        }

    # Get uncategorized transactions
    txn_result = await session.execute(
        select(Transaction).where(Transaction.category.is_(None))
    )
    transactions = txn_result.scalars().all()

    applied_count = 0
    rule_stats = {}

    for txn in transactions:
        # Try each rule in priority order
        for rule in rules:
            if match_rule(txn, rule):
                # Apply the rule
                txn.category = rule.category
                txn.updated_at = datetime.utcnow()

                # Update rule stats
                rule.match_count += 1
                rule.last_matched_date = datetime.utcnow()

                # Track stats for response
                if rule.id not in rule_stats:
                    rule_stats[rule.id] = {"name": rule.name, "count": 0}
                rule_stats[rule.id]["count"] += 1

                applied_count += 1
                break  # Stop after first match

    await session.commit()

    return {
        "applied_count": applied_count,
        "total_transactions_checked": len(transactions),
        "rules_applied": [
            {"rule_id": rule_id, "rule_name": stats["name"], "matches": stats["count"]}
            for rule_id, stats in rule_stats.items()
        ]
    }


@router.post("/{rule_id}/apply")
async def apply_single_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_session)
):
    """
    Apply a specific rule to all matching transactions

    Overwrites existing categories
    """
    # Get the rule
    rule_result = await session.execute(
        select(CategoryRule).where(CategoryRule.id == rule_id)
    )
    rule = rule_result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if not rule.enabled:
        raise HTTPException(status_code=400, detail="Rule is disabled")

    # Get all transactions
    txn_result = await session.execute(select(Transaction))
    transactions = txn_result.scalars().all()

    applied_count = 0

    for txn in transactions:
        if match_rule(txn, rule):
            txn.category = rule.category
            txn.updated_at = datetime.utcnow()
            applied_count += 1

    # Update rule stats
    if applied_count > 0:
        rule.match_count += applied_count
        rule.last_matched_date = datetime.utcnow()

    await session.commit()

    return {
        "rule_id": rule_id,
        "rule_name": rule.name,
        "applied_count": applied_count,
        "target_category": rule.category
    }
