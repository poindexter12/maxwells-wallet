"""Core report endpoints: filter options, monthly/annual summaries, trends, top merchants, account/bucket summaries."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload
from typing import DefaultDict, Dict, Optional, List
from datetime import date
from collections import defaultdict
import calendar

from app.database import get_session
from app.orm import Transaction
from app.routers.report_helpers import (
    get_transaction_tags,
    get_transaction_ids_by_buckets,
    filter_transactions_by_accounts,
    filter_transactions_by_merchants,
    parse_filter_param,
    apply_transaction_filters,
)

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


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
    category_breakdown: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"amount": 0.0, "count": 0.0})
    for txn in transactions:
        cat = txn.category or "Uncategorized"
        category_breakdown[cat]["amount"] += abs(txn.amount) if txn.amount < 0 else 0
        category_breakdown[cat]["count"] += 1

    # Sort by amount
    sorted_category_breakdown = dict(sorted(category_breakdown.items(), key=lambda x: x[1]["amount"], reverse=True))

    # Group by bucket tag (new tag system)
    txn_ids = [txn.id for txn in transactions]
    txn_tags = await get_transaction_tags(session, txn_ids)

    bucket_breakdown: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"amount": 0.0, "count": 0.0})
    for txn in transactions:
        bucket = txn_tags.get(txn.id, "Untagged")
        bucket_breakdown[bucket]["amount"] += abs(txn.amount) if txn.amount < 0 else 0
        bucket_breakdown[bucket]["count"] += 1

    # Sort by amount
    sorted_bucket_breakdown = dict(sorted(bucket_breakdown.items(), key=lambda x: x[1]["amount"], reverse=True))

    # Top merchants
    merchant_totals: DefaultDict[str, float] = defaultdict(float)
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
        "category_breakdown": sorted_category_breakdown,
        "bucket_breakdown": sorted_bucket_breakdown,
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
    # Use noload('*') to skip eager loading of relationships - we fetch tags separately
    result = await session.execute(
        select(Transaction)
        .where(
            Transaction.date >= start_date, Transaction.date < end_date, Transaction.is_transfer.is_(False)
        )
        .options(noload("*"))
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
    monthly_breakdown: Dict[int, Dict[str, float]] = {}
    for month_num in range(1, 13):
        monthly_breakdown[month_num] = {"income": 0.0, "expenses": 0.0, "net": 0.0, "count": 0.0}

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

    bucket_breakdown_dd: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"amount": 0.0, "count": 0.0})
    for txn in transactions:
        bucket = txn_tags.get(txn.id, "Untagged")
        bucket_breakdown_dd[bucket]["amount"] += abs(txn.amount) if txn.amount < 0 else 0
        bucket_breakdown_dd[bucket]["count"] += 1

    bucket_breakdown = dict(sorted(bucket_breakdown_dd.items(), key=lambda x: x[1]["amount"], reverse=True))

    # Top merchants
    merchant_totals: DefaultDict[str, float] = defaultdict(float)
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
    # Use noload('*') to skip eager loading of relationships
    result = await session.execute(
        select(Transaction)
        .where(
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.is_transfer.is_(False),  # Exclude transfers
        )
        .order_by(Transaction.date)
        .options(noload("*"))
    )
    transactions = list(result.scalars().all())

    # Apply filters
    transactions = await apply_transaction_filters(
        transactions, session, buckets=buckets, accounts=accounts, merchants=merchants
    )

    if group_by == "month":
        # Group by month
        monthly_data: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expenses": 0.0, "net": 0.0})

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
        weekly_data: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expenses": 0.0, "net": 0.0})

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
        category_monthly: DefaultDict[str, DefaultDict[str, float]] = defaultdict(lambda: defaultdict(float))

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
        account_monthly: DefaultDict[str, DefaultDict[str, Dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"income": 0.0, "expenses": 0.0}))

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

        tag_monthly: DefaultDict[str, DefaultDict[str, float]] = defaultdict(lambda: defaultdict(float))

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
    # Use noload('*') to skip eager loading of relationships
    query = (
        select(Transaction)
        .where(
            Transaction.date >= start_date,
            Transaction.amount < 0,  # Only expenses
            Transaction.is_transfer.is_(False),  # Exclude transfers
        )
        .options(noload("*"))
    )
    if end_date:
        query = query.where(Transaction.date < end_date)
    result = await session.execute(query)
    transactions = list(result.scalars().all())

    # Apply filters (no merchants filter - this endpoint groups by merchant)
    transactions = await apply_transaction_filters(transactions, session, buckets=buckets, accounts=accounts)

    # Aggregate by merchant
    merchant_totals: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"amount": 0.0, "count": 0.0})
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
    result = await session.execute(
        select(Transaction)
        .where(Transaction.is_transfer.is_(False))
        .options(noload("*"))
    )
    transactions = result.scalars().all()

    account_data: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expenses": 0.0, "net": 0.0, "count": 0.0})

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

    bucket_data: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expenses": 0.0, "net": 0.0, "count": 0.0})

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
