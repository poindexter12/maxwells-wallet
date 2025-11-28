from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, date
from calendar import monthrange

from app.database import get_session
from app.models import Budget, BudgetCreate, BudgetUpdate, BudgetPeriod, Transaction

router = APIRouter(prefix="/api/v1/budgets", tags=["budgets"])

@router.get("/", response_model=List[Budget])
async def list_budgets(
    session: AsyncSession = Depends(get_session)
):
    """List all budgets"""
    result = await session.execute(select(Budget).order_by(Budget.category))
    budgets = result.scalars().all()
    return budgets

@router.get("/{budget_id}", response_model=Budget)
async def get_budget(
    budget_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a single budget by ID"""
    result = await session.execute(
        select(Budget).where(Budget.id == budget_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget

@router.post("/", response_model=Budget, status_code=201)
async def create_budget(
    budget: BudgetCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new budget"""
    # Check if budget already exists for this category and period
    result = await session.execute(
        select(Budget).where(
            Budget.category == budget.category,
            Budget.period == budget.period
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Budget already exists for {budget.category} ({budget.period})"
        )

    db_budget = Budget(**budget.model_dump())
    session.add(db_budget)
    await session.commit()
    await session.refresh(db_budget)
    return db_budget

@router.patch("/{budget_id}", response_model=Budget)
async def update_budget(
    budget_id: int,
    budget: BudgetUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a budget"""
    result = await session.execute(
        select(Budget).where(Budget.id == budget_id)
    )
    db_budget = result.scalar_one_or_none()
    if not db_budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    # Update fields
    for key, value in budget.model_dump(exclude_unset=True).items():
        setattr(db_budget, key, value)

    db_budget.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(db_budget)
    return db_budget

@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a budget"""
    result = await session.execute(
        select(Budget).where(Budget.id == budget_id)
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    await session.delete(budget)
    await session.commit()

@router.get("/status/current")
async def get_budget_status(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    session: AsyncSession = Depends(get_session)
):
    """
    Get budget status for specified or current month

    Returns budget vs actual spending for each category
    """
    # Use current month if not specified
    now = datetime.utcnow()
    year = year or now.year
    month = month or now.month

    # Get all monthly budgets
    result = await session.execute(
        select(Budget).where(Budget.period == BudgetPeriod.monthly)
    )
    budgets = result.scalars().all()

    # Calculate date range for this month
    _, days_in_month = monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, days_in_month)

    # Calculate days elapsed and total days
    today = date.today()
    if year == today.year and month == today.month:
        days_elapsed = today.day
    else:
        days_elapsed = days_in_month  # Full month for past months

    # Get spending by category for this month
    status_list = []

    for budget_item in budgets:
        # Get spending for this category
        spending_result = await session.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.category == budget_item.category,
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                Transaction.amount < 0  # Only expenses
            )
        )
        spent_raw = spending_result.scalar()
        spent_amount = abs(spent_raw) if spent_raw else 0.0

        # Calculate metrics
        budget_amount = budget_item.amount
        remaining = budget_amount - spent_amount
        percentage_used = (spent_amount / budget_amount * 100) if budget_amount > 0 else 0

        # Determine status
        if percentage_used >= 100:
            status = "exceeded"
        elif percentage_used >= 80:
            status = "warning"
        else:
            status = "on_track"

        # Project monthly total based on days elapsed
        if days_elapsed > 0 and year == today.year and month == today.month:
            daily_rate = spent_amount / days_elapsed
            projected_monthly = daily_rate * days_in_month
        else:
            projected_monthly = spent_amount  # Full month data

        status_list.append({
            "category": budget_item.category,
            "budget_id": budget_item.id,
            "budget_amount": budget_amount,
            "spent_amount": spent_amount,
            "remaining": remaining,
            "percentage_used": round(percentage_used, 1),
            "status": status,
            "days_elapsed": days_elapsed,
            "days_in_month": days_in_month,
            "projected_monthly": round(projected_monthly, 2)
        })

    return {
        "year": year,
        "month": month,
        "budgets": status_list,
        "overall_status": "exceeded" if any(b["status"] == "exceeded" for b in status_list) else
                         "warning" if any(b["status"] == "warning" for b in status_list) else
                         "on_track"
    }

@router.get("/alerts/active")
async def get_budget_alerts(
    session: AsyncSession = Depends(get_session)
):
    """
    Get active budget alerts (warning or exceeded)

    Returns categories that are approaching or exceeding budget
    """
    # Get current budget status (pass None for year/month to use current)
    status_response = await get_budget_status(year=None, month=None, session=session)
    budgets = status_response["budgets"]

    # Filter to warning and exceeded only
    alerts = [
        {
            "category": b["category"],
            "budget_amount": b["budget_amount"],
            "spent_amount": b["spent_amount"],
            "percentage_used": b["percentage_used"],
            "status": b["status"],
            "message": f"Budget {b['status']}: {b['spent_amount']:.2f} / {b['budget_amount']:.2f} ({b['percentage_used']:.1f}%)"
        }
        for b in budgets
        if b["status"] in ["warning", "exceeded"]
    ]

    return {
        "alert_count": len(alerts),
        "alerts": alerts
    }
