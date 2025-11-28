from fastapi import APIRouter, Depends, Query
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import date, datetime, timedelta
from collections import defaultdict
import calendar
import statistics

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
    group_by: str = Query("month", pattern="^(month|category|account)$"),
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
    period: str = Query("current_month", pattern="^(current_month|last_month|last_3_months|last_6_months|all_time)$"),
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


@router.get("/month-over-month")
async def month_over_month_comparison(
    current_year: int = Query(...),
    current_month: int = Query(..., ge=1, le=12),
    session: AsyncSession = Depends(get_session)
):
    """
    Compare current month with previous month to identify spending changes.
    Returns absolute and percentage changes to help identify where to save money.
    """
    # Calculate previous month
    if current_month == 1:
        prev_year = current_year - 1
        prev_month = 12
    else:
        prev_year = current_year
        prev_month = current_month - 1

    async def get_month_data(year: int, month: int):
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        result = await session.execute(
            select(Transaction).where(
                Transaction.date >= start_date,
                Transaction.date < end_date
            )
        )
        transactions = result.scalars().all()

        total_income = sum(txn.amount for txn in transactions if txn.amount > 0)
        total_expenses = abs(sum(txn.amount for txn in transactions if txn.amount < 0))

        # Category breakdown
        category_totals = defaultdict(float)
        for txn in transactions:
            if txn.amount < 0 and txn.category:
                category_totals[txn.category] += abs(txn.amount)

        return {
            "income": total_income,
            "expenses": total_expenses,
            "net": total_income - total_expenses,
            "transaction_count": len(transactions),
            "categories": dict(category_totals)
        }

    # Get data for both months
    current = await get_month_data(current_year, current_month)
    previous = await get_month_data(prev_year, prev_month)

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
        category_changes[cat] = {
            "current": curr_amt,
            "previous": prev_amt,
            "change": calc_change(curr_amt, prev_amt)
        }

    # Sort categories by absolute change (biggest increases first)
    category_changes = dict(sorted(
        category_changes.items(),
        key=lambda x: abs(x[1]["change"]["amount"]),
        reverse=True
    ))

    return {
        "current_period": f"{current_year}-{current_month:02d}",
        "previous_period": f"{prev_year}-{prev_month:02d}",
        "current": current,
        "previous": previous,
        "changes": {
            "income": calc_change(current["income"], previous["income"]),
            "expenses": calc_change(current["expenses"], previous["expenses"]),
            "net": calc_change(current["net"], previous["net"])
        },
        "category_changes": category_changes,
        "insights": {
            "spending_trend": "increasing" if current["expenses"] > previous["expenses"] else "decreasing",
            "biggest_increase": max(category_changes.items(), key=lambda x: x[1]["change"]["amount"])[0] if category_changes else None,
            "biggest_decrease": min(category_changes.items(), key=lambda x: x[1]["change"]["amount"])[0] if category_changes else None
        }
    }


@router.get("/spending-velocity")
async def spending_velocity(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    session: AsyncSession = Depends(get_session)
):
    """
    Calculate daily spending rate and project monthly total.
    Helps answer: Am I on track to overspend this month?
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
        analysis_end_date = end_date
    else:
        # Current month - use days elapsed so far
        days_elapsed = today.day
        analysis_end_date = today

    # Get transactions for the month
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
            Transaction.date < prev_end
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
        "current_totals": {
            "income": total_income,
            "expenses": total_expenses,
            "net": total_income - total_expenses
        },
        "daily_rates": {
            "expenses": round(daily_expense_rate, 2),
            "income": round(daily_income_rate, 2),
            "net": round(daily_income_rate - daily_expense_rate, 2)
        },
        "projected_monthly": {
            "expenses": round(projected_monthly_expenses, 2),
            "income": round(projected_monthly_income, 2),
            "net": round(projected_net, 2)
        },
        "previous_month": {
            "expenses": prev_month_expenses
        },
        "pace": pace,
        "insights": {
            "daily_burn_rate": f"${daily_expense_rate:.2f}",
            "days_remaining": days_in_month - days_elapsed,
            "projected_remaining_spending": round(daily_expense_rate * (days_in_month - days_elapsed), 2)
        }
    }


@router.get("/anomalies")
async def detect_anomalies(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    threshold: float = Query(2.0, ge=1.0, le=5.0, description="Standard deviations from mean"),
    session: AsyncSession = Depends(get_session)
):
    """
    Detect unusual transactions that might indicate waste or errors.
    Helps identify: large unexpected purchases, new merchants, unusual category spending.
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
            Transaction.date < end_date
        )
    )
    current_transactions = result.scalars().all()

    # Get last 6 months for baseline (excluding current month)
    lookback_start = date(year, month, 1) - timedelta(days=180)
    lookback_end = start_date

    baseline_result = await session.execute(
        select(Transaction).where(
            Transaction.date >= lookback_start,
            Transaction.date < lookback_end
        )
    )
    baseline_transactions = baseline_result.scalars().all()

    anomalies = {
        "large_transactions": [],
        "new_merchants": [],
        "unusual_categories": []
    }

    # 1. Detect large transactions (> threshold std devs from mean)
    expense_amounts = [abs(txn.amount) for txn in baseline_transactions if txn.amount < 0]
    if len(expense_amounts) >= 2:
        mean_expense = statistics.mean(expense_amounts)
        std_expense = statistics.stdev(expense_amounts)

        for txn in current_transactions:
            if txn.amount < 0:
                amount = abs(txn.amount)
                if std_expense > 0:
                    z_score = (amount - mean_expense) / std_expense
                    if z_score > threshold:
                        anomalies["large_transactions"].append({
                            "id": txn.id,
                            "date": str(txn.date),
                            "merchant": txn.merchant,
                            "amount": amount,
                            "category": txn.category,
                            "z_score": round(z_score, 2),
                            "reason": f"${amount:.2f} is {z_score:.1f}x above average (${mean_expense:.2f})"
                        })

    # 2. Detect new merchants (not seen in baseline)
    baseline_merchants = set(txn.merchant for txn in baseline_transactions if txn.merchant)
    for txn in current_transactions:
        if txn.merchant and txn.merchant not in baseline_merchants and txn.amount < 0:
            anomalies["new_merchants"].append({
                "id": txn.id,
                "date": str(txn.date),
                "merchant": txn.merchant,
                "amount": abs(txn.amount),
                "category": txn.category,
                "reason": "First transaction with this merchant"
            })

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
                    anomalies["unusual_categories"].append({
                        "category": cat,
                        "current_spending": round(current_amount, 2),
                        "average_spending": round(avg, 2),
                        "z_score": round(z_score, 2),
                        "percent_increase": round(percent_increase, 1),
                        "reason": f"Spending ${current_amount:.2f} vs usual ${avg:.2f} (+{percent_increase:.0f}%)"
                    })

    # Sort each list by severity
    anomalies["large_transactions"].sort(key=lambda x: x["z_score"], reverse=True)
    anomalies["new_merchants"].sort(key=lambda x: x["amount"], reverse=True)
    anomalies["unusual_categories"].sort(key=lambda x: x["z_score"], reverse=True)

    total_anomalies = (
        len(anomalies["large_transactions"]) +
        len(anomalies["new_merchants"]) +
        len(anomalies["unusual_categories"])
    )

    return {
        "year": year,
        "month": month,
        "anomalies": anomalies,
        "summary": {
            "total_anomalies": total_anomalies,
            "large_transaction_count": len(anomalies["large_transactions"]),
            "new_merchant_count": len(anomalies["new_merchants"]),
            "unusual_category_count": len(anomalies["unusual_categories"])
        },
        "baseline_period": {
            "start": str(lookback_start),
            "end": str(lookback_end),
            "transaction_count": len(baseline_transactions)
        }
    }
