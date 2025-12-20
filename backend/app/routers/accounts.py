"""
Account management endpoints.

Provides account summary with balances, due dates, and credit limits.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date, timedelta
from pydantic import BaseModel

from app.database import get_session
from app.orm import Tag, Transaction
from app.errors import ErrorCode, not_found, bad_request

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


class AccountSummary(BaseModel):
    """Summary of an account with balance and metadata"""

    account: str  # account_source value (e.g., "AMEX-53004")
    balance: float  # Current balance (negative for credit cards with balance owed)
    transaction_count: int
    due_day: Optional[int] = None  # Day of month payment is due (1-31)
    next_due_date: Optional[date] = None  # Calculated next due date
    credit_limit: Optional[float] = None
    available_credit: Optional[float] = None  # credit_limit - abs(balance)
    description: Optional[str] = None  # Account description/nickname


class AccountUpdate(BaseModel):
    """Update account metadata"""

    due_day: Optional[int] = None
    credit_limit: Optional[float] = None
    description: Optional[str] = None


def calculate_next_due_date(due_day: int) -> date:
    """
    Calculate the next due date given a day of the month.

    If the due day has passed this month, returns next month's due date.
    Handles months with fewer days (e.g., due_day=31 in February -> Feb 28/29).
    """
    today = date.today()

    # Try this month first
    try:
        this_month_due = today.replace(day=due_day)
    except ValueError:
        # Day doesn't exist in this month (e.g., 31 in a 30-day month)
        # Use last day of month
        next_month = today.replace(day=28) + timedelta(days=4)
        this_month_due = next_month.replace(day=1) - timedelta(days=1)

    if this_month_due > today:
        return this_month_due

    # Due date has passed, calculate next month
    if today.month == 12:
        next_month = today.replace(year=today.year + 1, month=1, day=1)
    else:
        next_month = today.replace(month=today.month + 1, day=1)

    try:
        return next_month.replace(day=due_day)
    except ValueError:
        # Day doesn't exist in next month
        following = next_month.replace(day=28) + timedelta(days=4)
        return following.replace(day=1) - timedelta(days=1)


@router.get("/summary", response_model=List[AccountSummary])
async def get_account_summary(session: AsyncSession = Depends(get_session)):
    """
    Get summary of all accounts with balances and metadata.

    Returns accounts sorted by balance (most owed first for credit cards).
    Balance excludes transfer transactions to avoid double-counting.
    """
    # Get all account tags with their metadata
    account_tags_result = await session.execute(select(Tag).where(Tag.namespace == "account"))
    account_tags = {tag.value: tag for tag in account_tags_result.scalars().all()}

    # Calculate balance and count per account_source
    # Exclude transfers (is_transfer=True) to avoid double-counting
    balance_query = (
        select(
            Transaction.account_source,
            func.sum(Transaction.amount).label("balance"),
            func.count(Transaction.id).label("count"),
        )
        .where(
            Transaction.is_transfer == False  # noqa: E712
        )
        .group_by(Transaction.account_source)
    )

    result = await session.execute(balance_query)
    account_balances = result.all()

    summaries = []
    for account_source, balance, count in account_balances:
        # Get tag metadata if exists
        tag = account_tags.get(account_source.lower())

        due_day = tag.due_day if tag else None
        credit_limit = tag.credit_limit if tag else None
        description = tag.description if tag else None

        # Calculate next due date
        next_due = calculate_next_due_date(due_day) if due_day else None

        # Calculate available credit (only if we have a limit and balance is negative)
        available = None
        if credit_limit and balance < 0:
            available = credit_limit + balance  # balance is negative, so this subtracts

        summaries.append(
            AccountSummary(
                account=account_source,
                balance=balance or 0.0,
                transaction_count=count,
                due_day=due_day,
                next_due_date=next_due,
                credit_limit=credit_limit,
                available_credit=available,
                description=description,
            )
        )

    # Sort by balance ascending (most negative/owed first)
    summaries.sort(key=lambda x: x.balance)

    return summaries


@router.get("/{account_source}", response_model=AccountSummary)
async def get_account(account_source: str, session: AsyncSession = Depends(get_session)):
    """Get summary for a specific account."""
    # Get balance for this account
    balance_query = select(
        func.sum(Transaction.amount).label("balance"), func.count(Transaction.id).label("txn_count")
    ).where(
        Transaction.account_source == account_source,
        Transaction.is_transfer == False,  # noqa: E712
    )

    result = await session.execute(balance_query)
    row = result.one_or_none()

    if not row or row.txn_count == 0:
        raise not_found(ErrorCode.ACCOUNT_NOT_FOUND, account_source=account_source)

    balance: float = row.balance or 0.0
    txn_count: int = row.txn_count or 0

    # Get tag metadata
    tag_result = await session.execute(
        select(Tag).where(Tag.namespace == "account", Tag.value == account_source.lower())
    )
    tag = tag_result.scalar_one_or_none()

    due_day = tag.due_day if tag else None
    credit_limit = tag.credit_limit if tag else None
    description = tag.description if tag else None

    next_due = calculate_next_due_date(due_day) if due_day else None

    available = None
    if credit_limit and balance < 0:
        available = credit_limit + balance

    return AccountSummary(
        account=account_source,
        balance=balance,
        transaction_count=txn_count,
        due_day=due_day,
        next_due_date=next_due,
        credit_limit=credit_limit,
        available_credit=available,
        description=description,
    )


@router.patch("/{account_source}", response_model=AccountSummary)
async def update_account(account_source: str, update: AccountUpdate, session: AsyncSession = Depends(get_session)):
    """
    Update account metadata (due date, credit limit, description).

    Creates the account tag if it doesn't exist.
    """
    # Validate due_day
    if update.due_day is not None and (update.due_day < 1 or update.due_day > 31):
        raise bad_request(ErrorCode.ACCOUNT_INVALID_DUE_DAY, due_day=update.due_day)

    # Validate credit_limit
    if update.credit_limit is not None and update.credit_limit < 0:
        raise bad_request(ErrorCode.ACCOUNT_INVALID_CREDIT_LIMIT, credit_limit=update.credit_limit)

    # Check account exists (has transactions)
    count_result = await session.execute(
        select(func.count(Transaction.id)).where(Transaction.account_source == account_source)
    )
    if count_result.scalar() == 0:
        raise not_found(ErrorCode.ACCOUNT_NOT_FOUND, account_source=account_source)

    # Get or create account tag
    tag_result = await session.execute(
        select(Tag).where(Tag.namespace == "account", Tag.value == account_source.lower())
    )
    tag = tag_result.scalar_one_or_none()

    if not tag:
        # Create new account tag
        tag = Tag(
            namespace="account",
            value=account_source.lower(),
            due_day=update.due_day,
            credit_limit=update.credit_limit,
            description=update.description,
        )
        session.add(tag)
    else:
        # Update existing tag
        if update.due_day is not None:
            tag.due_day = update.due_day
        if update.credit_limit is not None:
            tag.credit_limit = update.credit_limit
        if update.description is not None:
            tag.description = update.description

    await session.commit()
    await session.refresh(tag)

    # Return updated account summary
    return await get_account(account_source, session)
