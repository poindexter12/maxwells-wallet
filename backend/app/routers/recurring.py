from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Tuple
from datetime import datetime, date, timedelta
from collections import defaultdict
import statistics

from app.database import get_session
from app.orm import RecurringFrequency, RecurringPattern, RecurringStatus, Transaction
from app.schemas import RecurringPatternCreate, RecurringPatternUpdate, RecurringPatternResponse
from app.errors import ErrorCode, not_found

router = APIRouter(prefix="/api/v1/recurring", tags=["recurring"])


def detect_frequency(intervals: List[int]) -> Tuple[Optional[RecurringFrequency], float]:
    """
    Detect frequency from interval days

    Returns (frequency, confidence_score)
    """
    if not intervals:
        return None, 0.0

    avg_interval = statistics.mean(intervals)
    std_dev = statistics.stdev(intervals) if len(intervals) > 1 else 0

    # Define frequency ranges with tolerance
    frequencies = [
        (RecurringFrequency.weekly, 7, 2),
        (RecurringFrequency.biweekly, 14, 3),
        (RecurringFrequency.monthly, 30, 3),
        (RecurringFrequency.quarterly, 90, 7),
        (RecurringFrequency.yearly, 365, 14),
    ]

    for freq, expected_days, tolerance in frequencies:
        if abs(avg_interval - expected_days) <= tolerance:
            # Calculate confidence based on consistency
            variance_penalty = min(std_dev / expected_days, 0.5)  # Cap at 0.5
            occurrence_bonus = min(len(intervals) * 0.1, 0.5)  # More occurrences = more confidence
            confidence = max(0.5, 1.0 - variance_penalty + occurrence_bonus)
            return freq, min(confidence, 1.0)

    return None, 0.0


@router.get("/", response_model=List[RecurringPatternResponse])
async def list_recurring_patterns(
    status: Optional[RecurringStatus] = None, session: AsyncSession = Depends(get_session)
):
    """List all recurring patterns"""
    query = select(RecurringPattern).order_by(RecurringPattern.merchant)

    if status:
        query = query.where(RecurringPattern.status == status)

    result = await session.execute(query)
    patterns = result.scalars().all()
    return patterns


@router.post("/", response_model=RecurringPatternResponse, status_code=201)
async def create_recurring_pattern(pattern: RecurringPatternCreate, session: AsyncSession = Depends(get_session)):
    """Manually create a recurring pattern"""
    db_pattern = RecurringPattern(**pattern.model_dump())
    session.add(db_pattern)
    await session.commit()
    await session.refresh(db_pattern)
    return db_pattern


@router.patch("/{pattern_id}", response_model=RecurringPatternResponse)
async def update_recurring_pattern(
    pattern_id: int, pattern: RecurringPatternUpdate, session: AsyncSession = Depends(get_session)
):
    """Update a recurring pattern"""
    result = await session.execute(select(RecurringPattern).where(RecurringPattern.id == pattern_id))
    db_pattern = result.scalar_one_or_none()
    if not db_pattern:
        raise not_found(ErrorCode.PATTERN_NOT_FOUND, pattern_id=pattern_id)

    for key, value in pattern.model_dump(exclude_unset=True).items():
        setattr(db_pattern, key, value)

    db_pattern.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(db_pattern)
    return db_pattern


@router.delete("/{pattern_id}", status_code=204)
async def delete_recurring_pattern(pattern_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a recurring pattern"""
    result = await session.execute(select(RecurringPattern).where(RecurringPattern.id == pattern_id))
    pattern = result.scalar_one_or_none()
    if not pattern:
        raise not_found(ErrorCode.PATTERN_NOT_FOUND, pattern_id=pattern_id)

    await session.delete(pattern)
    await session.commit()


@router.post("/detect")
async def detect_recurring_patterns(
    min_occurrences: int = Query(3, ge=2, le=10),
    min_confidence: float = Query(0.7, ge=0.5, le=1.0),
    session: AsyncSession = Depends(get_session),
):
    """
    Detect recurring transaction patterns

    Analyzes transaction history to find subscriptions and recurring bills
    """
    # Get all transactions
    result = await session.execute(select(Transaction).order_by(Transaction.date))
    all_transactions = result.scalars().all()

    # Group transactions by merchant
    merchant_transactions = defaultdict(list)
    for txn in all_transactions:
        if txn.merchant:
            merchant_transactions[txn.merchant.lower()].append(txn)

    detected_patterns = []

    for merchant, transactions in merchant_transactions.items():
        if len(transactions) < min_occurrences:
            continue

        # Sort by date
        transactions.sort(key=lambda t: t.date)

        # Calculate intervals between transactions
        intervals = []
        for i in range(1, len(transactions)):
            days_diff = (transactions[i].date - transactions[i - 1].date).days
            intervals.append(days_diff)

        # Detect frequency
        frequency, confidence = detect_frequency(intervals)

        if not frequency or confidence < min_confidence:
            continue

        # Calculate amount range (allow 10% variance)
        amounts = [abs(txn.amount) for txn in transactions]
        avg_amount = statistics.mean(amounts)
        amount_min = avg_amount * 0.9
        amount_max = avg_amount * 1.1

        # Get category (most common)
        categories = [txn.category for txn in transactions if txn.category]
        category = max(set(categories), key=categories.count) if categories else None

        # Calculate next expected date
        last_date = transactions[-1].date
        if frequency == RecurringFrequency.weekly:
            next_date = last_date + timedelta(days=7)
        elif frequency == RecurringFrequency.biweekly:
            next_date = last_date + timedelta(days=14)
        elif frequency == RecurringFrequency.monthly:
            next_date = last_date + timedelta(days=30)
        elif frequency == RecurringFrequency.quarterly:
            next_date = last_date + timedelta(days=90)
        else:  # yearly
            next_date = last_date + timedelta(days=365)

        # Check if pattern already exists
        existing = await session.execute(
            select(RecurringPattern).where(
                RecurringPattern.merchant == merchant, RecurringPattern.frequency == frequency
            )
        )
        if existing.scalar_one_or_none():
            continue  # Skip if already exists

        # Create pattern
        pattern = RecurringPattern(
            merchant=merchant,
            category=category,
            amount_min=amount_min,
            amount_max=amount_max,
            frequency=frequency,
            last_seen_date=last_date,
            next_expected_date=next_date,
            confidence_score=confidence,
            status=RecurringStatus.active,
        )

        session.add(pattern)
        detected_patterns.append(
            {
                "merchant": merchant,
                "frequency": frequency,
                "confidence": round(confidence, 2),
                "occurrences": len(transactions),
                "average_amount": round(avg_amount, 2),
                "next_expected": next_date.isoformat(),
            }
        )

    await session.commit()

    return {"detected_count": len(detected_patterns), "patterns": detected_patterns}


@router.get("/predictions/upcoming")
async def get_upcoming_recurring(
    days_ahead: int = Query(30, ge=1, le=365), session: AsyncSession = Depends(get_session)
):
    """
    Get predicted upcoming recurring transactions

    Returns transactions expected in the next N days
    """
    result = await session.execute(select(RecurringPattern).where(RecurringPattern.status == RecurringStatus.active))
    patterns = result.scalars().all()

    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    upcoming = []
    for pattern in patterns:
        if pattern.next_expected_date and today <= pattern.next_expected_date <= end_date:
            days_until = (pattern.next_expected_date - today).days
            upcoming.append(
                {
                    "merchant": pattern.merchant,
                    "category": pattern.category,
                    "expected_date": pattern.next_expected_date.isoformat(),
                    "days_until": days_until,
                    "frequency": pattern.frequency,
                    "estimated_amount": round((pattern.amount_min + pattern.amount_max) / 2, 2),
                    "confidence": round(pattern.confidence_score, 2),
                }
            )

    # Sort by expected date
    upcoming.sort(key=lambda x: x["expected_date"])

    return {"count": len(upcoming), "upcoming": upcoming}


@router.get("/missing")
async def get_missing_recurring(
    days_overdue: int = Query(7, ge=1, le=90), session: AsyncSession = Depends(get_session)
):
    """
    Get expected recurring transactions that haven't appeared

    Returns patterns where next_expected_date has passed but no matching transaction found
    """
    result = await session.execute(select(RecurringPattern).where(RecurringPattern.status == RecurringStatus.active))
    patterns = result.scalars().all()

    today = date.today()
    cutoff_date = today - timedelta(days=days_overdue)

    missing = []
    for pattern in patterns:
        if pattern.next_expected_date and pattern.next_expected_date <= cutoff_date:
            days_overdue_count = (today - pattern.next_expected_date).days
            missing.append(
                {
                    "merchant": pattern.merchant,
                    "category": pattern.category,
                    "expected_date": pattern.next_expected_date.isoformat(),
                    "days_overdue": days_overdue_count,
                    "frequency": pattern.frequency,
                    "estimated_amount": round((pattern.amount_min + pattern.amount_max) / 2, 2),
                }
            )

    # Sort by days overdue (most overdue first)
    missing.sort(key=lambda x: x["days_overdue"], reverse=True)

    return {"count": len(missing), "missing": missing}


@router.get("/{pattern_id}", response_model=RecurringPatternResponse)
async def get_recurring_pattern(pattern_id: int, session: AsyncSession = Depends(get_session)):
    """Get a single recurring pattern by ID"""
    result = await session.execute(select(RecurringPattern).where(RecurringPattern.id == pattern_id))
    pattern = result.scalar_one_or_none()
    if not pattern:
        raise not_found(ErrorCode.PATTERN_NOT_FOUND, pattern_id=pattern_id)
    return pattern
