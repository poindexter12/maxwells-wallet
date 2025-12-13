from fastapi import APIRouter, Depends, Query
from sqlmodel import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import date, timedelta
from collections import defaultdict
import calendar
import statistics

from app.database import get_session
from app.models import Transaction, Tag, TransactionTag

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


async def get_transaction_tags(session: AsyncSession, transaction_ids: List[int]) -> dict:
    """Helper to get bucket tags for a list of transaction IDs.
    Returns a dict mapping transaction_id -> bucket tag value (or None)
    """
    if not transaction_ids:
        return {}

    result = await session.execute(
        select(TransactionTag.transaction_id, Tag.value)
        .join(Tag)
        .where(and_(TransactionTag.transaction_id.in_(transaction_ids), Tag.namespace == "bucket"))
    )
    return {row[0]: row[1] for row in result.all()}


async def get_transaction_ids_by_buckets(session: AsyncSession, buckets: List[str]) -> set:
    """Get transaction IDs that have any of the specified bucket tags."""
    if not buckets:
        return set()

    result = await session.execute(
        select(TransactionTag.transaction_id).join(Tag).where(and_(Tag.namespace == "bucket", Tag.value.in_(buckets)))
    )
    return {row[0] for row in result.all()}


def filter_transactions_by_accounts(transactions: List[Transaction], accounts: List[str]) -> List[Transaction]:
    """Filter transactions to only those from specified accounts."""
    if not accounts:
        return transactions
    return [txn for txn in transactions if txn.account_source in accounts]


def filter_transactions_by_merchants(transactions: List[Transaction], merchants: List[str]) -> List[Transaction]:
    """Filter transactions to only those from specified merchants."""
    if not merchants:
        return transactions
    # Case-insensitive match
    merchants_lower = [m.lower() for m in merchants]
    return [txn for txn in transactions if txn.merchant and txn.merchant.lower() in merchants_lower]


def parse_filter_param(param: Optional[str]) -> List[str]:
    """Parse comma-separated filter parameter into a list."""
    if not param:
        return []
    return [v.strip() for v in param.split(",") if v.strip()]


async def apply_transaction_filters(
    transactions: List[Transaction],
    session: AsyncSession,
    buckets: Optional[str] = None,
    accounts: Optional[str] = None,
    merchants: Optional[str] = None,
) -> List[Transaction]:
    """Apply bucket, account, and merchant filters to a list of transactions."""
    # Filter by buckets
    bucket_list = parse_filter_param(buckets)
    if bucket_list:
        valid_txn_ids = await get_transaction_ids_by_buckets(session, bucket_list)
        transactions = [txn for txn in transactions if txn.id in valid_txn_ids]

    # Filter by accounts
    account_list = parse_filter_param(accounts)
    if account_list:
        transactions = filter_transactions_by_accounts(transactions, account_list)

    # Filter by merchants
    merchant_list = parse_filter_param(merchants)
    if merchant_list:
        transactions = filter_transactions_by_merchants(transactions, merchant_list)

    return transactions


@router.get("/filter-options")
async def get_filter_options(session: AsyncSession = Depends(get_session)):
    """Get available filter options for widgets (accounts, merchants)."""
    # Get distinct account sources
    accounts_result = await session.execute(
        select(Transaction.account_source, func.count(Transaction.id).label("count"))
        .group_by(Transaction.account_source)
        .order_by(func.count(Transaction.id).desc())
    )
    accounts = [{"value": row.account_source, "count": row.count} for row in accounts_result.all()]

    # Get top merchants (limit to most used)
    merchants_result = await session.execute(
        select(Transaction.merchant, func.count(Transaction.id).label("count"))
        .where(Transaction.merchant.isnot(None))
        .group_by(Transaction.merchant)
        .order_by(func.count(Transaction.id).desc())
        .limit(100)
    )
    merchants = [{"value": row.merchant, "count": row.count} for row in merchants_result.all()]

    return {"accounts": accounts, "merchants": merchants}


@router.get("/monthly-summary")
async def monthly_summary(
    year: int = Query(..., description="Year (e.g., 2024)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    buckets: Optional[str] = Query(None, description="Comma-separated bucket tags to filter by"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get comprehensive spending summary for a specific month.

    Returns:
    - **total_income**: Sum of all positive transactions
    - **total_expenses**: Sum of all negative transactions (as positive number)
    - **net**: Income minus expenses
    - **category_breakdown**: Spending grouped by legacy category
    - **bucket_breakdown**: Spending grouped by bucket tags
    - **top_merchants**: Top 5 merchants by spending
    - **transaction_count**: Total number of transactions

    Note: Transfers are excluded from all calculations.
    """
    # Calculate date range
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    # Get all transactions for the month (excluding transfers)
    result = await session.execute(
        select(Transaction).where(
            Transaction.date >= start_date,
            Transaction.date < end_date,
            Transaction.is_transfer.is_(False),  # Exclude transfers from spending reports
        )
    )
    transactions = list(result.scalars().all())

    # Filter by bucket tags if specified
    if buckets:
        bucket_list = [b.strip() for b in buckets.split(",") if b.strip()]
        if bucket_list:
            valid_txn_ids = await get_transaction_ids_by_buckets(session, bucket_list)
            transactions = [txn for txn in transactions if txn.id in valid_txn_ids]

    # Calculate totals
    total_income = sum(txn.amount for txn in transactions if txn.amount > 0)
    total_expenses = abs(sum(txn.amount for txn in transactions if txn.amount < 0))
    net = total_income - total_expenses

    # Group by legacy category
    category_breakdown = defaultdict(lambda: {"amount": 0, "count": 0})
    for txn in transactions:
        cat = txn.category or "Uncategorized"
        category_breakdown[cat]["amount"] += abs(txn.amount) if txn.amount < 0 else 0
        category_breakdown[cat]["count"] += 1

    # Sort by amount
    category_breakdown = dict(sorted(category_breakdown.items(), key=lambda x: x[1]["amount"], reverse=True))

    # Group by bucket tag (new tag system)
    txn_ids = [txn.id for txn in transactions]
    txn_tags = await get_transaction_tags(session, txn_ids)

    bucket_breakdown = defaultdict(lambda: {"amount": 0, "count": 0})
    for txn in transactions:
        bucket = txn_tags.get(txn.id, "Untagged")
        bucket_breakdown[bucket]["amount"] += abs(txn.amount) if txn.amount < 0 else 0
        bucket_breakdown[bucket]["count"] += 1

    # Sort by amount
    bucket_breakdown = dict(sorted(bucket_breakdown.items(), key=lambda x: x[1]["amount"], reverse=True))

    # Top merchants
    merchant_totals = defaultdict(float)
    for txn in transactions:
        if txn.merchant and txn.amount < 0:
            merchant_totals[txn.merchant] += abs(txn.amount)

    top_merchants = sorted(merchant_totals.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "year": year,
        "month": month,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": net,
        "transaction_count": len(transactions),
        "category_breakdown": category_breakdown,
        "bucket_breakdown": bucket_breakdown,
        "top_merchants": [{"merchant": m, "amount": a} for m, a in top_merchants],
    }


@router.get("/annual-summary")
async def annual_summary(
    year: int = Query(..., description="Year (e.g., 2024)"),
    buckets: Optional[str] = Query(None, description="Comma-separated bucket tags to filter by"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get comprehensive spending summary for a full year.

    Returns:
    - **total_income**: Sum of all positive transactions for the year
    - **total_expenses**: Sum of all negative transactions (as positive number)
    - **net**: Income minus expenses
    - **monthly_breakdown**: Monthly spending totals
    - **bucket_breakdown**: Spending grouped by bucket tags
    - **top_merchants**: Top 10 merchants by spending
    - **transaction_count**: Total number of transactions

    Note: Transfers are excluded from all calculations.
    """
    start_date = date(year, 1, 1)
    end_date = date(year + 1, 1, 1)

    # Get all transactions for the year (excluding transfers)
    result = await session.execute(
        select(Transaction).where(
            Transaction.date >= start_date, Transaction.date < end_date, Transaction.is_transfer.is_(False)
        )
    )
    transactions = list(result.scalars().all())

    # Filter by bucket tags if specified
    if buckets:
        bucket_list = [b.strip() for b in buckets.split(",") if b.strip()]
        if bucket_list:
            valid_txn_ids = await get_transaction_ids_by_buckets(session, bucket_list)
            transactions = [txn for txn in transactions if txn.id in valid_txn_ids]

    # Calculate totals
    total_income = sum(txn.amount for txn in transactions if txn.amount > 0)
    total_expenses = abs(sum(txn.amount for txn in transactions if txn.amount < 0))
    net = total_income - total_expenses

    # Monthly breakdown
    monthly_breakdown = {}
    for month_num in range(1, 13):
        monthly_breakdown[month_num] = {"income": 0, "expenses": 0, "net": 0, "count": 0}

    for txn in transactions:
        month = txn.date.month
        if txn.amount > 0:
            monthly_breakdown[month]["income"] += txn.amount
        else:
            monthly_breakdown[month]["expenses"] += abs(txn.amount)
        monthly_breakdown[month]["count"] += 1

    for month in monthly_breakdown:
        monthly_breakdown[month]["net"] = monthly_breakdown[month]["income"] - monthly_breakdown[month]["expenses"]

    # Group by bucket tag
    txn_ids = [txn.id for txn in transactions]
    txn_tags = await get_transaction_tags(session, txn_ids)

    bucket_breakdown = defaultdict(lambda: {"amount": 0, "count": 0})
    for txn in transactions:
        bucket = txn_tags.get(txn.id, "Untagged")
        bucket_breakdown[bucket]["amount"] += abs(txn.amount) if txn.amount < 0 else 0
        bucket_breakdown[bucket]["count"] += 1

    bucket_breakdown = dict(sorted(bucket_breakdown.items(), key=lambda x: x[1]["amount"], reverse=True))

    # Top merchants
    merchant_totals = defaultdict(float)
    for txn in transactions:
        if txn.merchant and txn.amount < 0:
            merchant_totals[txn.merchant] += abs(txn.amount)

    top_merchants = sorted(merchant_totals.items(), key=lambda x: x[1], reverse=True)[:10]

    # Calculate days in year for velocity
    today = date.today()
    if year == today.year:
        days_elapsed = (today - start_date).days + 1
    else:
        days_elapsed = 366 if calendar.isleap(year) else 365

    return {
        "year": year,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": net,
        "transaction_count": len(transactions),
        "monthly_breakdown": monthly_breakdown,
        "bucket_breakdown": bucket_breakdown,
        "top_merchants": [{"merchant": m, "amount": a} for m, a in top_merchants],
        "daily_average": round(total_expenses / days_elapsed, 2) if days_elapsed > 0 else 0,
        "days_elapsed": days_elapsed,
    }


@router.get("/trends")
async def spending_trends(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    group_by: str = Query(
        "month",
        pattern="^(month|week|category|account|tag)$",
        description="Grouping: month, week, category, account, or tag",
    ),
    buckets: Optional[str] = Query(None, description="Comma-separated bucket tags to filter by"),
    accounts: Optional[str] = Query(None, description="Comma-separated account sources to filter by"),
    merchants: Optional[str] = Query(None, description="Comma-separated merchants to filter by"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get spending trends over a date range.

    Supports multiple grouping modes:
    - **month**: Income, expenses, and net by month (for line charts)
    - **week**: Income, expenses, and net by week (for line charts)
    - **category**: Spending breakdown by category
    - **account**: Spending breakdown by account
    - **tag**: Spending breakdown by bucket tag

    Transfers are excluded from all calculations.
    """
    # Get transactions in date range (excluding transfers)
    result = await session.execute(
        select(Transaction)
        .where(
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.is_transfer.is_(False),  # Exclude transfers
        )
        .order_by(Transaction.date)
    )
    transactions = list(result.scalars().all())

    # Apply filters
    transactions = await apply_transaction_filters(
        transactions, session, buckets=buckets, accounts=accounts, merchants=merchants
    )

    if group_by == "month":
        # Group by month
        monthly_data = defaultdict(lambda: {"income": 0, "expenses": 0, "net": 0})

        for txn in transactions:
            month_key = f"{txn.date.year}-{txn.date.month:02d}"
            if txn.amount > 0:
                monthly_data[month_key]["income"] += txn.amount
            else:
                monthly_data[month_key]["expenses"] += abs(txn.amount)
            monthly_data[month_key]["net"] = monthly_data[month_key]["income"] - monthly_data[month_key]["expenses"]

        return {"group_by": "month", "data": [{"period": k, **v} for k, v in sorted(monthly_data.items())]}

    elif group_by == "week":
        # Group by ISO week
        weekly_data = defaultdict(lambda: {"income": 0, "expenses": 0, "net": 0})

        for txn in transactions:
            # ISO week: YYYY-Www format
            iso_cal = txn.date.isocalendar()
            week_key = f"{iso_cal[0]}-W{iso_cal[1]:02d}"
            if txn.amount > 0:
                weekly_data[week_key]["income"] += txn.amount
            else:
                weekly_data[week_key]["expenses"] += abs(txn.amount)
            weekly_data[week_key]["net"] = weekly_data[week_key]["income"] - weekly_data[week_key]["expenses"]

        return {"group_by": "week", "data": [{"period": k, **v} for k, v in sorted(weekly_data.items())]}

    elif group_by == "category":
        # Group by category over time
        category_monthly = defaultdict(lambda: defaultdict(float))

        for txn in transactions:
            if txn.amount < 0:  # Only expenses
                month_key = f"{txn.date.year}-{txn.date.month:02d}"
                cat = txn.category or "Uncategorized"
                category_monthly[cat][month_key] += abs(txn.amount)

        return {
            "group_by": "category",
            "categories": list(category_monthly.keys()),
            "data": {
                cat: sorted([{"period": k, "amount": v} for k, v in months.items()], key=lambda x: x["period"])
                for cat, months in category_monthly.items()
            },
        }

    elif group_by == "account":
        # Group by account over time
        account_monthly = defaultdict(lambda: defaultdict(lambda: {"income": 0, "expenses": 0}))

        for txn in transactions:
            month_key = f"{txn.date.year}-{txn.date.month:02d}"
            if txn.amount > 0:
                account_monthly[txn.account_source][month_key]["income"] += txn.amount
            else:
                account_monthly[txn.account_source][month_key]["expenses"] += abs(txn.amount)

        return {
            "group_by": "account",
            "accounts": list(account_monthly.keys()),
            "data": {
                acc: sorted([{"period": k, **v} for k, v in months.items()], key=lambda x: x["period"])
                for acc, months in account_monthly.items()
            },
        }

    elif group_by == "tag":
        # Group by bucket tag over time
        txn_ids = [txn.id for txn in transactions]
        txn_tags = await get_transaction_tags(session, txn_ids)

        tag_monthly = defaultdict(lambda: defaultdict(float))

        for txn in transactions:
            if txn.amount < 0:  # Only expenses
                month_key = f"{txn.date.year}-{txn.date.month:02d}"
                bucket = txn_tags.get(txn.id, "Untagged")
                tag_monthly[bucket][month_key] += abs(txn.amount)

        return {
            "group_by": "tag",
            "buckets": list(tag_monthly.keys()),
            "data": {
                bucket: sorted([{"period": k, "amount": v} for k, v in months.items()], key=lambda x: x["period"])
                for bucket, months in tag_monthly.items()
            },
        }


@router.get("/top-merchants")
async def top_merchants(
    limit: int = Query(10, ge=1, le=100),
    period: str = Query("current_month", pattern="^(current_month|last_month|last_3_months|last_6_months|all_time)$"),
    year: Optional[int] = Query(None, description="Specific year (overrides period)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Specific month (overrides period)"),
    buckets: Optional[str] = Query(None, description="Comma-separated bucket tags to filter by"),
    accounts: Optional[str] = Query(None, description="Comma-separated account sources to filter by"),
    session: AsyncSession = Depends(get_session),
):
    """Get top merchants by spending"""
    # Calculate date range
    today = date.today()

    # If year is provided, use it instead of period
    if year is not None:
        if month is not None:
            # Specific month
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1)
            else:
                end_date = date(year, month + 1, 1)
        else:
            # Full year
            start_date = date(year, 1, 1)
            end_date = date(year + 1, 1, 1)
    else:
        end_date = None  # Will be set to None for open-ended queries
        if period == "current_month":
            start_date = date(today.year, today.month, 1)
        elif period == "last_month":
            if today.month == 1:
                start_date = date(today.year - 1, 12, 1)
            else:
                start_date = date(today.year, today.month - 1, 1)
        elif period == "last_3_months":
            start_date = date(today.year, max(1, today.month - 3), 1)
        elif period == "last_6_months":
            start_date = date(today.year, max(1, today.month - 6), 1)
        else:  # all_time
            start_date = date(2000, 1, 1)

    # Get transactions (excluding transfers)
    query = select(Transaction).where(
        Transaction.date >= start_date,
        Transaction.amount < 0,  # Only expenses
        Transaction.is_transfer.is_(False),  # Exclude transfers
    )
    if end_date:
        query = query.where(Transaction.date < end_date)
    result = await session.execute(query)
    transactions = list(result.scalars().all())

    # Apply filters (no merchants filter - this endpoint groups by merchant)
    transactions = await apply_transaction_filters(transactions, session, buckets=buckets, accounts=accounts)

    # Aggregate by merchant
    merchant_totals = defaultdict(lambda: {"amount": 0, "count": 0})
    for txn in transactions:
        if txn.merchant:
            merchant_totals[txn.merchant]["amount"] += abs(txn.amount)
            merchant_totals[txn.merchant]["count"] += 1

    # Sort and limit
    top = sorted(merchant_totals.items(), key=lambda x: x[1]["amount"], reverse=True)[:limit]

    return {
        "period": period,
        "merchants": [{"merchant": m, "amount": data["amount"], "transaction_count": data["count"]} for m, data in top],
    }


@router.get("/account-summary")
async def account_summary(session: AsyncSession = Depends(get_session)):
    """Get summary by account"""
    result = await session.execute(select(Transaction).where(Transaction.is_transfer.is_(False)))
    transactions = result.scalars().all()

    account_data = defaultdict(lambda: {"income": 0, "expenses": 0, "net": 0, "count": 0})

    for txn in transactions:
        if txn.amount > 0:
            account_data[txn.account_source]["income"] += txn.amount
        else:
            account_data[txn.account_source]["expenses"] += abs(txn.amount)

        account_data[txn.account_source]["net"] = (
            account_data[txn.account_source]["income"] - account_data[txn.account_source]["expenses"]
        )
        account_data[txn.account_source]["count"] += 1

    return {"accounts": [{"account": acc, **data} for acc, data in sorted(account_data.items())]}


@router.get("/bucket-summary")
async def bucket_summary(
    start_date: Optional[date] = None, end_date: Optional[date] = None, session: AsyncSession = Depends(get_session)
):
    """Get spending summary by bucket tag"""
    query = select(Transaction).where(Transaction.is_transfer.is_(False))

    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)

    result = await session.execute(query)
    transactions = result.scalars().all()

    # Get bucket tags for all transactions
    txn_ids = [txn.id for txn in transactions]
    txn_tags = await get_transaction_tags(session, txn_ids)

    bucket_data = defaultdict(lambda: {"income": 0, "expenses": 0, "net": 0, "count": 0})

    for txn in transactions:
        bucket = txn_tags.get(txn.id, "Untagged")
        if txn.amount > 0:
            bucket_data[bucket]["income"] += txn.amount
        else:
            bucket_data[bucket]["expenses"] += abs(txn.amount)

        bucket_data[bucket]["net"] = bucket_data[bucket]["income"] - bucket_data[bucket]["expenses"]
        bucket_data[bucket]["count"] += 1

    # Sort by expenses descending
    sorted_buckets = sorted(bucket_data.items(), key=lambda x: x[1]["expenses"], reverse=True)

    return {
        "buckets": [{"bucket": bucket, **data} for bucket, data in sorted_buckets],
        "date_range": {"start": str(start_date) if start_date else None, "end": str(end_date) if end_date else None},
    }


@router.get("/month-over-month")
async def month_over_month_comparison(
    current_year: int = Query(..., description="Year to compare (e.g., 2024)"),
    current_month: int = Query(..., ge=1, le=12, description="Month to compare (1-12)"),
    session: AsyncSession = Depends(get_session),
):
    """
    Compare current month with previous month to identify spending changes.

    Returns:
    - **current/previous**: Totals for income, expenses, net
    - **changes**: Absolute dollar and percentage changes
    - **bucket_changes**: Per-bucket spending comparison
    - **insights**: Biggest increase/decrease categories

    Use this to identify where spending increased or decreased month-over-month.
    """
    # Calculate previous month
    if current_month == 1:
        prev_year = current_year - 1
        prev_month = 12
    else:
        prev_year = current_year
        prev_month = current_month - 1

    async def get_month_transactions(year: int, month: int):
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        result = await session.execute(
            select(Transaction).where(
                Transaction.date >= start_date,
                Transaction.date < end_date,
                Transaction.is_transfer.is_(False),  # Exclude transfers
            )
        )
        return result.scalars().all()

    def summarize_transactions(transactions, txn_tags):
        total_income = sum(txn.amount for txn in transactions if txn.amount > 0)
        total_expenses = abs(sum(txn.amount for txn in transactions if txn.amount < 0))

        # Legacy category breakdown
        category_totals = defaultdict(float)
        for txn in transactions:
            if txn.amount < 0 and txn.category:
                category_totals[txn.category] += abs(txn.amount)

        # Bucket tag breakdown
        bucket_totals = defaultdict(float)
        for txn in transactions:
            if txn.amount < 0:
                bucket = txn_tags.get(txn.id, "Untagged")
                bucket_totals[bucket] += abs(txn.amount)

        return {
            "income": total_income,
            "expenses": total_expenses,
            "net": total_income - total_expenses,
            "transaction_count": len(transactions),
            "categories": dict(category_totals),
            "buckets": dict(bucket_totals),
        }

    # Get transactions for both months
    current_txns = await get_month_transactions(current_year, current_month)
    previous_txns = await get_month_transactions(prev_year, prev_month)

    # Get bucket tags for all transactions
    all_txn_ids = [txn.id for txn in current_txns] + [txn.id for txn in previous_txns]
    all_txn_tags = await get_transaction_tags(session, all_txn_ids)

    # Summarize
    current = summarize_transactions(current_txns, all_txn_tags)
    previous = summarize_transactions(previous_txns, all_txn_tags)

    # Calculate changes
    def calc_change(current_val, prev_val):
        if prev_val == 0:
            return {"amount": current_val, "percent": 100.0 if current_val > 0 else 0}
        change_amount = current_val - prev_val
        change_percent = (change_amount / prev_val) * 100
        return {"amount": change_amount, "percent": change_percent}

    # Category-level changes
    all_categories = set(current["categories"].keys()) | set(previous["categories"].keys())
    category_changes = {}
    for cat in all_categories:
        curr_amt = current["categories"].get(cat, 0)
        prev_amt = previous["categories"].get(cat, 0)
        category_changes[cat] = {"current": curr_amt, "previous": prev_amt, "change": calc_change(curr_amt, prev_amt)}

    # Sort categories by absolute change (biggest increases first)
    category_changes = dict(sorted(category_changes.items(), key=lambda x: abs(x[1]["change"]["amount"]), reverse=True))

    # Bucket-level changes (new tag system)
    all_buckets = set(current["buckets"].keys()) | set(previous["buckets"].keys())
    bucket_changes = {}
    for bucket in all_buckets:
        curr_amt = current["buckets"].get(bucket, 0)
        prev_amt = previous["buckets"].get(bucket, 0)
        bucket_changes[bucket] = {"current": curr_amt, "previous": prev_amt, "change": calc_change(curr_amt, prev_amt)}

    # Sort buckets by absolute change (biggest increases first)
    bucket_changes = dict(sorted(bucket_changes.items(), key=lambda x: abs(x[1]["change"]["amount"]), reverse=True))

    return {
        "current_period": f"{current_year}-{current_month:02d}",
        "previous_period": f"{prev_year}-{prev_month:02d}",
        "current": current,
        "previous": previous,
        "changes": {
            "income": calc_change(current["income"], previous["income"]),
            "expenses": calc_change(current["expenses"], previous["expenses"]),
            "net": calc_change(current["net"], previous["net"]),
        },
        "category_changes": category_changes,
        "bucket_changes": bucket_changes,
        "insights": {
            "spending_trend": "increasing" if current["expenses"] > previous["expenses"] else "decreasing",
            "biggest_category_increase": max(category_changes.items(), key=lambda x: x[1]["change"]["amount"])[0]
            if category_changes
            else None,
            "biggest_category_decrease": min(category_changes.items(), key=lambda x: x[1]["change"]["amount"])[0]
            if category_changes
            else None,
            "biggest_bucket_increase": max(bucket_changes.items(), key=lambda x: x[1]["change"]["amount"])[0]
            if bucket_changes
            else None,
            "biggest_bucket_decrease": min(bucket_changes.items(), key=lambda x: x[1]["change"]["amount"])[0]
            if bucket_changes
            else None,
        },
    }


@router.get("/spending-velocity")
async def spending_velocity(
    year: int = Query(..., description="Year (e.g., 2024)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    session: AsyncSession = Depends(get_session),
):
    """
    Calculate daily spending rate and project monthly total.

    Returns:
    - **daily_burn_rate**: Average spending per day so far
    - **projected_monthly_total**: Estimated month-end total at current pace
    - **days_elapsed / days_remaining**: Progress through the month
    - **pace**: "on_track", "under_budget", or "over_budget" vs previous month
    - **previous_month_total**: Last month's total for comparison

    Use this to catch overspending early in the month.
    """
    # Calculate date range
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    today = date.today()

    # If analyzing past month, use full month; if current month, use today
    if year < today.year or (year == today.year and month < today.month):
        # Past month - use all days
        days_elapsed = calendar.monthrange(year, month)[1]
    else:
        # Current month - use days elapsed so far
        days_elapsed = today.day

    # Get transactions for the month (excluding transfers)
    result = await session.execute(
        select(Transaction).where(
            Transaction.date >= start_date,
            Transaction.date < end_date,
            Transaction.is_transfer.is_(False),  # Exclude transfers
        )
    )
    transactions = result.scalars().all()

    # Calculate totals
    total_income = sum(txn.amount for txn in transactions if txn.amount > 0)
    total_expenses = abs(sum(txn.amount for txn in transactions if txn.amount < 0))

    # Daily rate
    daily_expense_rate = total_expenses / days_elapsed if days_elapsed > 0 else 0
    daily_income_rate = total_income / days_elapsed if days_elapsed > 0 else 0

    # Projections
    days_in_month = calendar.monthrange(year, month)[1]
    projected_monthly_expenses = daily_expense_rate * days_in_month
    projected_monthly_income = daily_income_rate * days_in_month
    projected_net = projected_monthly_income - projected_monthly_expenses

    # Get previous month for comparison
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1

    prev_start = date(prev_year, prev_month, 1)
    if prev_month == 12:
        prev_end = date(prev_year + 1, 1, 1)
    else:
        prev_end = date(prev_year, prev_month + 1, 1)

    prev_result = await session.execute(
        select(Transaction).where(
            Transaction.date >= prev_start,
            Transaction.date < prev_end,
            Transaction.is_transfer.is_(False),  # Exclude transfers
        )
    )
    prev_transactions = prev_result.scalars().all()
    prev_month_expenses = abs(sum(txn.amount for txn in prev_transactions if txn.amount < 0))

    # Determine pace
    if year == today.year and month == today.month:
        # Current month - compare projection to previous month
        if prev_month_expenses == 0:
            pace = "no_baseline"
        elif projected_monthly_expenses > prev_month_expenses * 1.1:
            pace = "over_budget"
        elif projected_monthly_expenses < prev_month_expenses * 0.9:
            pace = "under_budget"
        else:
            pace = "on_track"
    else:
        pace = "completed"

    return {
        "year": year,
        "month": month,
        "days_elapsed": days_elapsed,
        "days_in_month": days_in_month,
        "current_totals": {"income": total_income, "expenses": total_expenses, "net": total_income - total_expenses},
        "daily_rates": {
            "expenses": round(daily_expense_rate, 2),
            "income": round(daily_income_rate, 2),
            "net": round(daily_income_rate - daily_expense_rate, 2),
        },
        "projected_monthly": {
            "expenses": round(projected_monthly_expenses, 2),
            "income": round(projected_monthly_income, 2),
            "net": round(projected_net, 2),
        },
        "previous_month": {"expenses": prev_month_expenses},
        "pace": pace,
        "insights": {
            "daily_burn_rate": f"${daily_expense_rate:.2f}",
            "days_remaining": days_in_month - days_elapsed,
            "projected_remaining_spending": round(daily_expense_rate * (days_in_month - days_elapsed), 2),
        },
    }


@router.get("/anomalies")
async def detect_anomalies(
    year: int = Query(..., description="Year (e.g., 2024)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    threshold: float = Query(
        2.0, ge=1.0, le=5.0, description="Sensitivity: standard deviations from mean (lower = more sensitive)"
    ),
    session: AsyncSession = Depends(get_session),
):
    """
    Detect unusual transactions that might indicate waste or errors.

    Analyzes transactions using a 3-month baseline to identify:
    - **Large transactions**: Spending significantly above your average (z-score > threshold)
    - **New merchants**: First-time purchases at merchants you haven't used before
    - **Unusual categories**: Category spending far above historical average
    - **Unusual buckets**: Bucket spending far above historical average

    Returns:
    - **summary**: Counts of each anomaly type, plus `large_threshold_amount` showing the dollar threshold
    - **anomalies**: Detailed lists of flagged items with amounts and explanations

    The `threshold` parameter controls sensitivity (default 2.0 = ~95th percentile).
    Lower values flag more transactions; higher values only flag extreme outliers.
    """
    # Get current month transactions
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    result = await session.execute(
        select(Transaction).where(
            Transaction.date >= start_date,
            Transaction.date < end_date,
            Transaction.is_transfer.is_(False),  # Exclude transfers
        )
    )
    current_transactions = result.scalars().all()

    # Get last 6 months for baseline (excluding current month)
    lookback_start = date(year, month, 1) - timedelta(days=180)
    lookback_end = start_date

    baseline_result = await session.execute(
        select(Transaction).where(
            Transaction.date >= lookback_start,
            Transaction.date < lookback_end,
            Transaction.is_transfer.is_(False),  # Exclude transfers
        )
    )
    baseline_transactions = baseline_result.scalars().all()

    anomalies = {"large_transactions": [], "new_merchants": [], "unusual_categories": [], "unusual_buckets": []}

    # Get bucket tags for all transactions
    all_txn_ids = [txn.id for txn in current_transactions] + [txn.id for txn in baseline_transactions]
    all_txn_tags = await get_transaction_tags(session, all_txn_ids)

    # 1. Detect large transactions (> threshold std devs from mean)
    expense_amounts = [abs(txn.amount) for txn in baseline_transactions if txn.amount < 0]
    large_threshold_amount = None
    mean_expense = None
    std_expense = None

    if len(expense_amounts) >= 2:
        mean_expense = statistics.mean(expense_amounts)
        std_expense = statistics.stdev(expense_amounts)
        if std_expense > 0:
            large_threshold_amount = mean_expense + (threshold * std_expense)

        for txn in current_transactions:
            if txn.amount < 0:
                amount = abs(txn.amount)
                if std_expense > 0:
                    z_score = (amount - mean_expense) / std_expense
                    if z_score > threshold:
                        anomalies["large_transactions"].append(
                            {
                                "id": txn.id,
                                "date": str(txn.date),
                                "merchant": txn.merchant,
                                "amount": amount,
                                "category": txn.category,
                                "bucket": all_txn_tags.get(txn.id),
                                "z_score": round(z_score, 2),
                                "reason": f"${amount:.2f} is {z_score:.1f}x above average (${mean_expense:.2f})",
                            }
                        )

    # 2. Detect new merchants (not seen in baseline)
    baseline_merchants = set(txn.merchant for txn in baseline_transactions if txn.merchant)
    for txn in current_transactions:
        if txn.merchant and txn.merchant not in baseline_merchants and txn.amount < 0:
            anomalies["new_merchants"].append(
                {
                    "id": txn.id,
                    "date": str(txn.date),
                    "merchant": txn.merchant,
                    "amount": abs(txn.amount),
                    "category": txn.category,
                    "bucket": all_txn_tags.get(txn.id),
                    "reason": "First transaction with this merchant",
                }
            )

    # 3. Detect unusual category spending
    # Calculate average monthly spending per category from baseline
    baseline_months = defaultdict(lambda: defaultdict(float))
    for txn in baseline_transactions:
        if txn.amount < 0 and txn.category:
            month_key = f"{txn.date.year}-{txn.date.month:02d}"
            baseline_months[month_key][txn.category] += abs(txn.amount)

    # Calculate average per category
    category_averages = defaultdict(list)
    for month_data in baseline_months.values():
        for cat, amount in month_data.items():
            category_averages[cat].append(amount)

    # Current month category totals
    current_category_totals = defaultdict(float)
    for txn in current_transactions:
        if txn.amount < 0 and txn.category:
            current_category_totals[txn.category] += abs(txn.amount)

    # Compare current to baseline
    for cat, current_amount in current_category_totals.items():
        if cat in category_averages and len(category_averages[cat]) >= 2:
            avg = statistics.mean(category_averages[cat])
            std = statistics.stdev(category_averages[cat])

            if std > 0:
                z_score = (current_amount - avg) / std
                if z_score > threshold:
                    percent_increase = ((current_amount - avg) / avg) * 100
                    anomalies["unusual_categories"].append(
                        {
                            "category": cat,
                            "current_spending": round(current_amount, 2),
                            "average_spending": round(avg, 2),
                            "z_score": round(z_score, 2),
                            "percent_increase": round(percent_increase, 1),
                            "reason": f"Spending ${current_amount:.2f} vs usual ${avg:.2f} (+{percent_increase:.0f}%)",
                        }
                    )

    # 4. Detect unusual bucket spending
    # Calculate average monthly spending per bucket from baseline
    baseline_bucket_months = defaultdict(lambda: defaultdict(float))
    for txn in baseline_transactions:
        if txn.amount < 0:
            month_key = f"{txn.date.year}-{txn.date.month:02d}"
            bucket = all_txn_tags.get(txn.id, "Untagged")
            baseline_bucket_months[month_key][bucket] += abs(txn.amount)

    # Calculate average per bucket
    bucket_averages = defaultdict(list)
    for month_data in baseline_bucket_months.values():
        for bucket, amount in month_data.items():
            bucket_averages[bucket].append(amount)

    # Current month bucket totals
    current_bucket_totals = defaultdict(float)
    for txn in current_transactions:
        if txn.amount < 0:
            bucket = all_txn_tags.get(txn.id, "Untagged")
            current_bucket_totals[bucket] += abs(txn.amount)

    # Compare current to baseline
    for bucket, current_amount in current_bucket_totals.items():
        if bucket in bucket_averages and len(bucket_averages[bucket]) >= 2:
            avg = statistics.mean(bucket_averages[bucket])
            std = statistics.stdev(bucket_averages[bucket])

            if std > 0:
                z_score = (current_amount - avg) / std
                if z_score > threshold:
                    percent_increase = ((current_amount - avg) / avg) * 100
                    anomalies["unusual_buckets"].append(
                        {
                            "bucket": bucket,
                            "current_spending": round(current_amount, 2),
                            "average_spending": round(avg, 2),
                            "z_score": round(z_score, 2),
                            "percent_increase": round(percent_increase, 1),
                            "reason": f"Spending ${current_amount:.2f} vs usual ${avg:.2f} (+{percent_increase:.0f}%)",
                        }
                    )

    # Sort each list by severity
    anomalies["large_transactions"].sort(key=lambda x: x["z_score"], reverse=True)
    anomalies["new_merchants"].sort(key=lambda x: x["amount"], reverse=True)
    anomalies["unusual_categories"].sort(key=lambda x: x["z_score"], reverse=True)
    anomalies["unusual_buckets"].sort(key=lambda x: x["z_score"], reverse=True)

    total_anomalies = (
        len(anomalies["large_transactions"])
        + len(anomalies["new_merchants"])
        + len(anomalies["unusual_categories"])
        + len(anomalies["unusual_buckets"])
    )

    return {
        "year": year,
        "month": month,
        "anomalies": anomalies,
        "summary": {
            "total_anomalies": total_anomalies,
            "large_transaction_count": len(anomalies["large_transactions"]),
            "new_merchant_count": len(anomalies["new_merchants"]),
            "unusual_category_count": len(anomalies["unusual_categories"]),
            "unusual_bucket_count": len(anomalies["unusual_buckets"]),
            "large_threshold_amount": round(large_threshold_amount, 2) if large_threshold_amount else None,
            "mean_expense": round(mean_expense, 2) if mean_expense else None,
        },
        "baseline_period": {
            "start": str(lookback_start),
            "end": str(lookback_end),
            "transaction_count": len(baseline_transactions),
        },
    }


@router.get("/sankey-flow")
async def sankey_flow(
    year: int = Query(..., description="Year (e.g., 2024)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12), omit for full year"),
    buckets: Optional[str] = Query(None, description="Comma-separated bucket tags to filter by"),
    accounts: Optional[str] = Query(None, description="Comma-separated account sources to filter by"),
    merchants: Optional[str] = Query(None, description="Comma-separated merchants to filter by"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get money flow data for Sankey diagram visualization.

    Shows flow from income sources → accounts → spending buckets.

    Returns nodes and links in Recharts Sankey format.
    If month is omitted, returns data for the full year.
    """
    if month is not None:
        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)
    else:
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)

    # Get all transactions for the period (excluding transfers)
    result = await session.execute(
        select(Transaction).where(
            and_(Transaction.date >= start_date, Transaction.date <= end_date, Transaction.is_transfer.is_(False))
        )
    )
    transactions = list(result.scalars().all())

    # Apply filters
    transactions = await apply_transaction_filters(
        transactions, session, buckets=buckets, accounts=accounts, merchants=merchants
    )

    if not transactions:
        return {"nodes": [], "links": []}

    # Get bucket tags for all transactions
    txn_ids = [t.id for t in transactions]
    txn_tags = await get_transaction_tags(session, txn_ids)

    # Build nodes and links
    nodes = []
    node_index = {}
    links = []

    # Track flows
    income_to_account = defaultdict(float)  # "Income" -> account_source
    account_to_bucket = defaultdict(lambda: defaultdict(float))  # account_source -> bucket

    for txn in transactions:
        account = txn.account_source or "Unknown"
        bucket = txn_tags.get(txn.id, "uncategorized")

        if txn.amount > 0:
            # Income: flows from "Income" node to account
            income_to_account[account] += txn.amount
        else:
            # Expense: flows from account to bucket
            account_to_bucket[account][bucket] += abs(txn.amount)

    # Create nodes
    def get_node_index(name: str, node_type: str) -> int:
        key = f"{node_type}:{name}"
        if key not in node_index:
            node_index[key] = len(nodes)
            nodes.append({"name": name, "type": node_type})
        return node_index[key]

    # Add Income node if we have income
    if income_to_account:
        get_node_index("Income", "income")

    # Add account nodes and income links
    for account, amount in income_to_account.items():
        account_idx = get_node_index(account, "account")
        income_idx = get_node_index("Income", "income")
        links.append({"source": income_idx, "target": account_idx, "value": round(amount, 2)})

    # Add bucket nodes and expense links
    for account, buckets in account_to_bucket.items():
        account_idx = get_node_index(account, "account")
        for bucket, amount in buckets.items():
            bucket_idx = get_node_index(bucket.capitalize(), "bucket")
            links.append({"source": account_idx, "target": bucket_idx, "value": round(amount, 2)})

    return {"year": year, "month": month, "nodes": nodes, "links": links}


@router.get("/treemap")
async def treemap_data(
    year: int = Query(..., description="Year (e.g., 2024)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12), omit for full year"),
    buckets: Optional[str] = Query(None, description="Comma-separated bucket tags to filter by"),
    accounts: Optional[str] = Query(None, description="Comma-separated account sources to filter by"),
    merchants: Optional[str] = Query(None, description="Comma-separated merchants to filter by"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get hierarchical spending data for Treemap visualization.

    Returns spending organized as: Bucket → Merchant hierarchy.
    If month is omitted, returns data for the full year.
    """
    if month is not None:
        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)
    else:
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)

    # Get expense transactions only (excluding transfers)
    result = await session.execute(
        select(Transaction).where(
            and_(
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                Transaction.amount < 0,
                Transaction.is_transfer.is_(False),
            )
        )
    )
    transactions = list(result.scalars().all())

    # Apply filters
    transactions = await apply_transaction_filters(
        transactions, session, buckets=buckets, accounts=accounts, merchants=merchants
    )

    if not transactions:
        return {"year": year, "month": month, "data": {"name": "Spending", "children": []}}

    # Get bucket tags
    txn_ids = [t.id for t in transactions]
    txn_tags = await get_transaction_tags(session, txn_ids)

    # Build hierarchy: bucket -> merchant -> amount
    hierarchy = defaultdict(lambda: defaultdict(float))

    for txn in transactions:
        bucket = txn_tags.get(txn.id, "Uncategorized")
        merchant = txn.merchant or "Unknown"
        hierarchy[bucket][merchant] += abs(txn.amount)

    # Convert to treemap format
    children = []
    for bucket, merchants in hierarchy.items():
        bucket_children = [
            {"name": merchant, "value": round(amount, 2)}
            for merchant, amount in sorted(merchants.items(), key=lambda x: -x[1])
        ]
        bucket_total = sum(m["value"] for m in bucket_children)
        children.append(
            {
                "name": bucket.capitalize(),
                "value": round(bucket_total, 2),
                "children": bucket_children[:10],  # Top 10 merchants per bucket
            }
        )

    # Sort by total value
    children.sort(key=lambda x: -x["value"])

    return {"year": year, "month": month, "data": {"name": "Spending", "children": children}}


@router.get("/spending-heatmap")
async def spending_heatmap(
    year: int = Query(..., description="Year (e.g., 2024)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12), omit for full year"),
    buckets: Optional[str] = Query(None, description="Comma-separated bucket tags to filter by"),
    accounts: Optional[str] = Query(None, description="Comma-separated account sources to filter by"),
    merchants: Optional[str] = Query(None, description="Comma-separated merchants to filter by"),
    session: AsyncSession = Depends(get_session),
):
    """
    Get spending data for calendar heatmap visualization.

    If month is provided, returns daily spending for that month.
    If month is omitted, returns monthly spending for the full year.
    """
    if month is not None:
        # Monthly view: daily breakdown
        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)

        result = await session.execute(
            select(Transaction).where(
                and_(
                    Transaction.date >= start_date,
                    Transaction.date <= end_date,
                    Transaction.amount < 0,
                    Transaction.is_transfer.is_(False),
                )
            )
        )
        transactions = list(result.scalars().all())

        # Apply filters
        transactions = await apply_transaction_filters(
            transactions, session, buckets=buckets, accounts=accounts, merchants=merchants
        )

        daily_spending = defaultdict(float)
        daily_count = defaultdict(int)

        for txn in transactions:
            day = txn.date.day
            daily_spending[day] += abs(txn.amount)
            daily_count[day] += 1

        days = []
        max_spending = max(daily_spending.values()) if daily_spending else 0

        for day in range(1, last_day + 1):
            day_date = date(year, month, day)
            amount = daily_spending.get(day, 0)
            count = daily_count.get(day, 0)

            if max_spending > 0:
                intensity = min(5, int((amount / max_spending) * 5))
            else:
                intensity = 0

            days.append(
                {
                    "date": str(day_date),
                    "day": day,
                    "weekday": day_date.weekday(),
                    "amount": round(amount, 2),
                    "count": count,
                    "intensity": intensity,
                }
            )
    else:
        # Year view: monthly breakdown
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)

        result = await session.execute(
            select(Transaction).where(
                and_(
                    Transaction.date >= start_date,
                    Transaction.date <= end_date,
                    Transaction.amount < 0,
                    Transaction.is_transfer.is_(False),
                )
            )
        )
        transactions = list(result.scalars().all())

        # Apply filters
        transactions = await apply_transaction_filters(
            transactions, session, buckets=buckets, accounts=accounts, merchants=merchants
        )

        monthly_spending = defaultdict(float)
        monthly_count = defaultdict(int)

        for txn in transactions:
            m = txn.date.month
            monthly_spending[m] += abs(txn.amount)
            monthly_count[m] += 1

        days = []  # Using 'days' key for consistency, but contains months
        max_spending = max(monthly_spending.values()) if monthly_spending else 0

        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

        for m in range(1, 13):
            amount = monthly_spending.get(m, 0)
            count = monthly_count.get(m, 0)

            if max_spending > 0:
                intensity = min(5, int((amount / max_spending) * 5))
            else:
                intensity = 0

            days.append(
                {
                    "month": m,
                    "month_name": month_names[m - 1],
                    "amount": round(amount, 2),
                    "count": count,
                    "intensity": intensity,
                }
            )

    total_spending = sum(d["amount"] for d in days)

    if month is not None:
        # Monthly summary
        summary = {
            "total_spending": round(total_spending, 2),
            "max_daily": round(max_spending, 2),
            "avg_daily": round(total_spending / last_day, 2) if days else 0,
            "days_with_spending": len([d for d in days if d["amount"] > 0]),
        }
    else:
        # Yearly summary
        summary = {
            "total_spending": round(total_spending, 2),
            "max_monthly": round(max_spending, 2),
            "avg_monthly": round(total_spending / 12, 2) if days else 0,
            "months_with_spending": len([d for d in days if d["amount"] > 0]),
        }

    return {"year": year, "month": month, "days": days, "summary": summary}
