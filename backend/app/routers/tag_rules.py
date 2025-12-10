from fastapi import APIRouter, Depends
from sqlmodel import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime

from app.database import get_session
from app.models import (
    TagRule, TagRuleCreate, TagRuleUpdate,
    Transaction, Tag, TransactionTag
)
from app.errors import ErrorCode, not_found, bad_request

router = APIRouter(prefix="/api/v1/tag-rules", tags=["tag-rules"])


def match_rule(transaction: Transaction, rule: TagRule) -> bool:
    """
    Check if a transaction matches a tag rule

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


def parse_tag_string(tag_str: str) -> tuple[str, str]:
    """Parse a tag string like 'bucket:groceries' into (namespace, value)"""
    if ":" not in tag_str:
        raise ValueError(f"Invalid tag format: '{tag_str}'. Expected 'namespace:value'")
    namespace, value = tag_str.split(":", 1)
    return namespace, value


@router.get("/", response_model=List[TagRule])
async def list_rules(
    session: AsyncSession = Depends(get_session)
):
    """List all tag rules ordered by priority (highest first)"""
    result = await session.execute(
        select(TagRule).order_by(TagRule.priority.desc(), TagRule.created_at)
    )
    rules = result.scalars().all()
    return rules


@router.get("/{rule_id}", response_model=TagRule)
async def get_rule(
    rule_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a single tag rule by ID"""
    result = await session.execute(
        select(TagRule).where(TagRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise not_found(ErrorCode.RULE_NOT_FOUND, rule_id=rule_id)
    return rule


@router.post("/", response_model=TagRule, status_code=201)
async def create_rule(
    rule: TagRuleCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new tag rule"""
    # Validate tag format
    try:
        namespace, value = parse_tag_string(rule.tag)
    except ValueError as e:
        raise bad_request(ErrorCode.TAG_INVALID_FORMAT, str(e), tag=rule.tag)

    # Validate that the tag exists
    tag_result = await session.execute(
        select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value))
    )
    if not tag_result.scalar_one_or_none():
        raise bad_request(ErrorCode.TAG_NOT_FOUND, tag=rule.tag)

    # Validate that at least one match condition is specified
    if not any([
        rule.merchant_pattern,
        rule.description_pattern,
        rule.amount_min is not None,
        rule.amount_max is not None,
        rule.account_source
    ]):
        raise bad_request(
            ErrorCode.VALIDATION_ERROR,
            "At least one match condition must be specified"
        )

    db_rule = TagRule(**rule.model_dump())
    session.add(db_rule)
    await session.commit()
    await session.refresh(db_rule)
    return db_rule


@router.patch("/{rule_id}", response_model=TagRule)
async def update_rule(
    rule_id: int,
    rule: TagRuleUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a tag rule"""
    result = await session.execute(
        select(TagRule).where(TagRule.id == rule_id)
    )
    db_rule = result.scalar_one_or_none()
    if not db_rule:
        raise not_found(ErrorCode.RULE_NOT_FOUND, rule_id=rule_id)

    # Validate tag format if being updated
    if rule.tag is not None:
        try:
            namespace, value = parse_tag_string(rule.tag)
        except ValueError as e:
            raise bad_request(ErrorCode.TAG_INVALID_FORMAT, str(e), tag=rule.tag)

        # Validate that the tag exists
        tag_result = await session.execute(
            select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value))
        )
        if not tag_result.scalar_one_or_none():
            raise bad_request(ErrorCode.TAG_NOT_FOUND, tag=rule.tag)

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
    """Delete a tag rule"""
    result = await session.execute(
        select(TagRule).where(TagRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise not_found(ErrorCode.RULE_NOT_FOUND, rule_id=rule_id)

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
        select(TagRule).where(TagRule.id == rule_id)
    )
    rule = rule_result.scalar_one_or_none()
    if not rule:
        raise not_found(ErrorCode.RULE_NOT_FOUND, rule_id=rule_id)

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
                "current_category": txn.category,  # Legacy field
                "would_apply_tag": rule.tag
            })

    return {
        "rule_id": rule_id,
        "rule_name": rule.name,
        "target_tag": rule.tag,
        "match_count": len(matching_transactions),
        "matches": matching_transactions[:50]  # Limit to 50 for preview
    }


async def apply_tag_to_transaction(
    session: AsyncSession,
    transaction_id: int,
    tag_str: str
) -> bool:
    """
    Apply a tag to a transaction via the junction table.
    For bucket tags, removes any existing bucket tag first (only one allowed).
    Returns True if tag was applied, False if already present.
    """
    namespace, value = parse_tag_string(tag_str)

    # Get the tag
    tag_result = await session.execute(
        select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value))
    )
    tag = tag_result.scalar_one_or_none()
    if not tag:
        return False

    # For bucket namespace, remove existing bucket tag first
    if namespace == "bucket":
        # Find and remove existing bucket tags
        existing_bucket_result = await session.execute(
            select(TransactionTag)
            .join(Tag)
            .where(
                and_(
                    TransactionTag.transaction_id == transaction_id,
                    Tag.namespace == "bucket"
                )
            )
        )
        existing_buckets = existing_bucket_result.scalars().all()
        for existing in existing_buckets:
            await session.delete(existing)

    # Check if this exact tag is already applied
    existing_result = await session.execute(
        select(TransactionTag).where(
            and_(
                TransactionTag.transaction_id == transaction_id,
                TransactionTag.tag_id == tag.id
            )
        )
    )
    if existing_result.scalar_one_or_none():
        return False  # Already has this tag

    # Apply the tag
    txn_tag = TransactionTag(transaction_id=transaction_id, tag_id=tag.id)
    session.add(txn_tag)
    return True


@router.post("/apply")
async def apply_rules(
    session: AsyncSession = Depends(get_session)
):
    """
    Apply all enabled rules to transactions without bucket tags

    Rules are applied in priority order (highest first)
    """
    # Get all enabled rules ordered by priority
    rules_result = await session.execute(
        select(TagRule)
        .where(TagRule.enabled == True)
        .order_by(TagRule.priority.desc(), TagRule.created_at)
    )
    rules = rules_result.scalars().all()

    if not rules:
        return {
            "applied_count": 0,
            "message": "No enabled rules found"
        }

    # Get transactions without a bucket tag (have bucket:none or no bucket at all)
    # For simplicity, we check all transactions and skip those with non-none bucket tags
    txn_result = await session.execute(select(Transaction))
    transactions = txn_result.scalars().all()

    applied_count = 0
    rule_stats = {}

    for txn in transactions:
        # Check current bucket tag
        current_bucket_result = await session.execute(
            select(Tag)
            .join(TransactionTag)
            .where(
                and_(
                    TransactionTag.transaction_id == txn.id,
                    Tag.namespace == "bucket"
                )
            )
        )
        current_bucket = current_bucket_result.scalar_one_or_none()

        # Skip if already has a non-none bucket
        if current_bucket and current_bucket.value != "none":
            continue

        # Try each rule in priority order
        for rule in rules:
            if match_rule(txn, rule):
                # Apply the tag
                applied = await apply_tag_to_transaction(session, txn.id, rule.tag)

                if applied:
                    # Update rule stats
                    rule.match_count += 1
                    rule.last_matched_date = datetime.utcnow()

                    # Track stats for response
                    if rule.id not in rule_stats:
                        rule_stats[rule.id] = {"name": rule.name, "tag": rule.tag, "count": 0}
                    rule_stats[rule.id]["count"] += 1

                    applied_count += 1

                # For bucket tags, stop after first match
                namespace, _ = parse_tag_string(rule.tag)
                if namespace == "bucket":
                    break

    await session.commit()

    return {
        "applied_count": applied_count,
        "total_transactions_checked": len(transactions),
        "rules_applied": [
            {"rule_id": rule_id, "rule_name": stats["name"], "tag": stats["tag"], "matches": stats["count"]}
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

    For bucket tags, overwrites existing bucket assignments
    """
    # Get the rule
    rule_result = await session.execute(
        select(TagRule).where(TagRule.id == rule_id)
    )
    rule = rule_result.scalar_one_or_none()
    if not rule:
        raise not_found(ErrorCode.RULE_NOT_FOUND, rule_id=rule_id)

    if not rule.enabled:
        raise bad_request(ErrorCode.RULE_DISABLED, rule_id=rule_id)

    # Get all transactions
    txn_result = await session.execute(select(Transaction))
    transactions = txn_result.scalars().all()

    applied_count = 0

    for txn in transactions:
        if match_rule(txn, rule):
            applied = await apply_tag_to_transaction(session, txn.id, rule.tag)
            if applied:
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
        "target_tag": rule.tag
    }
