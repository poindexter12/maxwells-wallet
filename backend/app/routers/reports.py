from fastapi import APIRouter, Depends, Query
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date, datetime
from collections import defaultdict

from app.database import get_session
from app.models import Transaction

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])

@router.get("/monthly-summary")
async def monthly_summary(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    session: AsyncSession = Depends(get_session)
):
    """Get spending summary for a specific month"""
    # Calculate date range
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    # Get all transactions for the month
    result = await session.execute(
        select(Transaction).where(
            Transaction.date >= start_date,
            Transaction.date < end_date
        )
    )
    transactions = result.scalars().all()

    # Calculate totals
    total_income = sum(txn.amount for txn in transactions if txn.amount > 0)
    total_expenses = abs(sum(txn.amount for txn in transactions if txn.amount < 0))
    net = total_income - total_expenses

    # Group by category
    category_breakdown = defaultdict(lambda: {'amount': 0, 'count': 0})
    for txn in transactions:
        cat = txn.category or 'Uncategorized'
        category_breakdown[cat]['amount'] += abs(txn.amount) if txn.amount < 0 else 0
        category_breakdown[cat]['count'] += 1

    # Sort by amount
    category_breakdown = dict(sorted(
        category_breakdown.items(),
        key=lambda x: x[1]['amount'],
        reverse=True
    ))

    # Top merchants
    merchant_totals = defaultdict(float)
    for txn in transactions:
        if txn.merchant and txn.amount < 0:
            merchant_totals[txn.merchant] += abs(txn.amount)

    top_merchants = sorted(
        merchant_totals.items(),
        key=lambda x: x[1],
        reverse=True
    )[:10]

    return {
        "year": year,
        "month": month,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": net,
        "transaction_count": len(transactions),
        "category_breakdown": category_breakdown,
        "top_merchants": [
            {"merchant": m, "amount": a}
            for m, a in top_merchants
        ]
    }

@router.get("/trends")
async def spending_trends(
    start_date: date = Query(...),
    end_date: date = Query(...),
    group_by: str = Query("month", regex="^(month|category|account)$"),
    session: AsyncSession = Depends(get_session)
):
    """Get spending trends over time"""
    # Get transactions in date range
    result = await session.execute(
        select(Transaction).where(
            Transaction.date >= start_date,
            Transaction.date <= end_date
        ).order_by(Transaction.date)
    )
    transactions = result.scalars().all()

    if group_by == "month":
        # Group by month
        monthly_data = defaultdict(lambda: {'income': 0, 'expenses': 0, 'net': 0})

        for txn in transactions:
            month_key = f"{txn.date.year}-{txn.date.month:02d}"
            if txn.amount > 0:
                monthly_data[month_key]['income'] += txn.amount
            else:
                monthly_data[month_key]['expenses'] += abs(txn.amount)
            monthly_data[month_key]['net'] = (
                monthly_data[month_key]['income'] - monthly_data[month_key]['expenses']
            )

        return {
            "group_by": "month",
            "data": [
                {"period": k, **v}
                for k, v in sorted(monthly_data.items())
            ]
        }

    elif group_by == "category":
        # Group by category over time
        category_monthly = defaultdict(lambda: defaultdict(float))

        for txn in transactions:
            if txn.amount < 0:  # Only expenses
                month_key = f"{txn.date.year}-{txn.date.month:02d}"
                cat = txn.category or 'Uncategorized'
                category_monthly[cat][month_key] += abs(txn.amount)

        return {
            "group_by": "category",
            "categories": list(category_monthly.keys()),
            "data": {
                cat: sorted([{"period": k, "amount": v} for k, v in months.items()], key=lambda x: x['period'])
                for cat, months in category_monthly.items()
            }
        }

    elif group_by == "account":
        # Group by account over time
        account_monthly = defaultdict(lambda: defaultdict(lambda: {'income': 0, 'expenses': 0}))

        for txn in transactions:
            month_key = f"{txn.date.year}-{txn.date.month:02d}"
            if txn.amount > 0:
                account_monthly[txn.account_source][month_key]['income'] += txn.amount
            else:
                account_monthly[txn.account_source][month_key]['expenses'] += abs(txn.amount)

        return {
            "group_by": "account",
            "accounts": list(account_monthly.keys()),
            "data": {
                acc: sorted([{"period": k, **v} for k, v in months.items()], key=lambda x: x['period'])
                for acc, months in account_monthly.items()
            }
        }

@router.get("/top-merchants")
async def top_merchants(
    limit: int = Query(10, ge=1, le=100),
    period: str = Query("current_month", regex="^(current_month|last_month|last_3_months|last_6_months|all_time)$"),
    session: AsyncSession = Depends(get_session)
):
    """Get top merchants by spending"""
    # Calculate date range
    today = date.today()
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

    # Get transactions
    query = select(Transaction).where(
        Transaction.date >= start_date,
        Transaction.amount < 0  # Only expenses
    )
    result = await session.execute(query)
    transactions = result.scalars().all()

    # Aggregate by merchant
    merchant_totals = defaultdict(lambda: {'amount': 0, 'count': 0})
    for txn in transactions:
        if txn.merchant:
            merchant_totals[txn.merchant]['amount'] += abs(txn.amount)
            merchant_totals[txn.merchant]['count'] += 1

    # Sort and limit
    top = sorted(
        merchant_totals.items(),
        key=lambda x: x[1]['amount'],
        reverse=True
    )[:limit]

    return {
        "period": period,
        "merchants": [
            {"merchant": m, "amount": data['amount'], "transaction_count": data['count']}
            for m, data in top
        ]
    }

@router.get("/account-summary")
async def account_summary(
    session: AsyncSession = Depends(get_session)
):
    """Get summary by account"""
    result = await session.execute(select(Transaction))
    transactions = result.scalars().all()

    account_data = defaultdict(lambda: {'income': 0, 'expenses': 0, 'net': 0, 'count': 0})

    for txn in transactions:
        if txn.amount > 0:
            account_data[txn.account_source]['income'] += txn.amount
        else:
            account_data[txn.account_source]['expenses'] += abs(txn.amount)

        account_data[txn.account_source]['net'] = (
            account_data[txn.account_source]['income'] -
            account_data[txn.account_source]['expenses']
        )
        account_data[txn.account_source]['count'] += 1

    return {
        "accounts": [
            {"account": acc, **data}
            for acc, data in sorted(account_data.items())
        ]
    }
