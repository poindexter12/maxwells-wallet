"""
Dashboards API

Manages named dashboards with filters and view settings.
Each dashboard can have its own set of widgets.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime

from app.database import get_session
from app.models import (
    Dashboard, DashboardCreate, DashboardUpdate,
    DashboardWidget, DashboardWidgetCreate
)

router = APIRouter(prefix="/api/v1/dashboards", tags=["dashboards"])

# Default widget configuration - used to initialize new dashboards
DEFAULT_WIDGETS = [
    {"widget_type": "summary", "title": "Summary", "position": 0, "width": "full", "is_visible": True},
    {"widget_type": "velocity", "title": "Spending Velocity", "position": 1, "width": "half", "is_visible": True},
    {"widget_type": "anomalies", "title": "Anomalies", "position": 2, "width": "half", "is_visible": True},
    {"widget_type": "bucket_pie", "title": "Spending by Bucket", "position": 3, "width": "half", "is_visible": True},
    {"widget_type": "top_merchants", "title": "Top Merchants", "position": 4, "width": "half", "is_visible": True},
    {"widget_type": "trends", "title": "Trends", "position": 5, "width": "full", "is_visible": True},
    {"widget_type": "sankey", "title": "Money Flow", "position": 6, "width": "full", "is_visible": False},
    {"widget_type": "treemap", "title": "Spending Breakdown", "position": 7, "width": "full", "is_visible": False},
    {"widget_type": "heatmap", "title": "Spending Calendar", "position": 8, "width": "full", "is_visible": False},
]


async def get_or_create_default_dashboard(session: AsyncSession) -> Dashboard:
    """Get the default dashboard, creating one if none exists."""
    result = await session.execute(
        select(Dashboard).where(Dashboard.is_default == True)
    )
    dashboard = result.scalar_one_or_none()

    if not dashboard:
        # Create default dashboard
        dashboard = Dashboard(
            name="Default",
            description="Default dashboard",
            view_mode="month",
            is_default=True,
            position=0
        )
        session.add(dashboard)
        await session.commit()
        await session.refresh(dashboard)

    return dashboard


@router.get("", response_model=List[Dashboard])
async def list_dashboards(session: AsyncSession = Depends(get_session)):
    """List all dashboards ordered by position."""
    result = await session.execute(
        select(Dashboard).order_by(Dashboard.position)
    )
    dashboards = list(result.scalars().all())

    # Ensure at least one default dashboard exists
    if not dashboards:
        dashboard = await get_or_create_default_dashboard(session)
        dashboards = [dashboard]

    return dashboards


@router.get("/default", response_model=Dashboard)
async def get_default_dashboard(session: AsyncSession = Depends(get_session)):
    """Get the default dashboard."""
    return await get_or_create_default_dashboard(session)


@router.get("/{dashboard_id}", response_model=Dashboard)
async def get_dashboard(dashboard_id: int, session: AsyncSession = Depends(get_session)):
    """Get a dashboard by ID."""
    result = await session.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.post("", response_model=Dashboard, status_code=201)
async def create_dashboard(
    dashboard: DashboardCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new dashboard.

    If is_default is True, clears the default flag from other dashboards.
    Initializes with default widgets.
    """
    # If setting as default, clear other defaults first
    if dashboard.is_default:
        result = await session.execute(
            select(Dashboard).where(Dashboard.is_default == True)
        )
        for existing in result.scalars().all():
            existing.is_default = False

    db_dashboard = Dashboard(**dashboard.model_dump())
    session.add(db_dashboard)
    await session.commit()
    await session.refresh(db_dashboard)

    # Initialize with default widgets
    for widget_data in DEFAULT_WIDGETS:
        widget = DashboardWidget(
            dashboard_id=db_dashboard.id,
            **widget_data
        )
        session.add(widget)
    await session.commit()

    return db_dashboard


@router.patch("/{dashboard_id}", response_model=Dashboard)
async def update_dashboard(
    dashboard_id: int,
    dashboard: DashboardUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a dashboard's settings."""
    result = await session.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id)
    )
    db_dashboard = result.scalar_one_or_none()
    if not db_dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    update_data = dashboard.model_dump(exclude_unset=True)

    # If setting as default, clear other defaults first
    if update_data.get("is_default"):
        existing_result = await session.execute(
            select(Dashboard).where(Dashboard.is_default == True)
        )
        for existing in existing_result.scalars().all():
            if existing.id != dashboard_id:
                existing.is_default = False

    for key, value in update_data.items():
        setattr(db_dashboard, key, value)

    db_dashboard.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(db_dashboard)
    return db_dashboard


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(dashboard_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a dashboard and its widgets.

    Cannot delete the last dashboard or a default dashboard
    (unless it's the only one and you're replacing it).
    """
    result = await session.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Count total dashboards
    count_result = await session.execute(select(Dashboard))
    all_dashboards = list(count_result.scalars().all())
    if len(all_dashboards) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last dashboard")

    # If deleting the default, promote another dashboard
    if dashboard.is_default:
        for other in all_dashboards:
            if other.id != dashboard_id:
                other.is_default = True
                break

    # Delete associated widgets first
    widgets_result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id)
    )
    for widget in widgets_result.scalars().all():
        await session.delete(widget)

    await session.delete(dashboard)
    await session.commit()


@router.post("/{dashboard_id}/clone", response_model=Dashboard, status_code=201)
async def clone_dashboard(
    dashboard_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Clone a dashboard with all its widgets."""
    result = await session.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id)
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Find max position
    max_result = await session.execute(select(Dashboard))
    all_dashboards = list(max_result.scalars().all())
    max_position = max(d.position for d in all_dashboards) if all_dashboards else -1

    # Clone dashboard
    new_dashboard = Dashboard(
        name=f"{original.name} (copy)",
        description=original.description,
        view_mode=original.view_mode,
        pinned_year=original.pinned_year,
        pinned_month=original.pinned_month,
        filter_buckets=original.filter_buckets,
        filter_accounts=original.filter_accounts,
        filter_merchants=original.filter_merchants,
        is_default=False,
        position=max_position + 1
    )
    session.add(new_dashboard)
    await session.commit()
    await session.refresh(new_dashboard)

    # Clone widgets
    widgets_result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id)
    )
    for original_widget in widgets_result.scalars().all():
        new_widget = DashboardWidget(
            dashboard_id=new_dashboard.id,
            widget_type=original_widget.widget_type,
            title=original_widget.title,
            position=original_widget.position,
            width=original_widget.width,
            is_visible=original_widget.is_visible,
            config=original_widget.config
        )
        session.add(new_widget)
    await session.commit()

    return new_dashboard


@router.post("/{dashboard_id}/set-default", response_model=Dashboard)
async def set_default_dashboard(
    dashboard_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Set a dashboard as the default."""
    result = await session.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Clear other defaults
    all_result = await session.execute(
        select(Dashboard).where(Dashboard.is_default == True)
    )
    for existing in all_result.scalars().all():
        existing.is_default = False

    dashboard.is_default = True
    dashboard.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(dashboard)
    return dashboard


@router.put("/reorder", response_model=List[Dashboard])
async def reorder_dashboards(
    order: List[dict],
    session: AsyncSession = Depends(get_session)
):
    """Update dashboard positions for sidebar ordering.

    Expects list of {"id": int, "position": int} objects.
    """
    for item in order:
        dashboard_id = item.get("id")
        new_position = item.get("position")

        if dashboard_id is None or new_position is None:
            raise HTTPException(
                status_code=400,
                detail="Each item must have 'id' and 'position' fields"
            )

        result = await session.execute(
            select(Dashboard).where(Dashboard.id == dashboard_id)
        )
        dashboard = result.scalar_one_or_none()
        if not dashboard:
            raise HTTPException(status_code=404, detail=f"Dashboard {dashboard_id} not found")

        dashboard.position = new_position
        dashboard.updated_at = datetime.utcnow()

    await session.commit()

    # Return updated order
    result = await session.execute(
        select(Dashboard).order_by(Dashboard.position)
    )
    return result.scalars().all()


# Widget endpoints scoped under dashboards

@router.get("/{dashboard_id}/widgets", response_model=List[DashboardWidget])
async def list_dashboard_widgets(
    dashboard_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get all widgets for a dashboard, initializing defaults if needed."""
    # Verify dashboard exists
    dash_result = await session.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id)
    )
    dashboard = dash_result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    result = await session.execute(
        select(DashboardWidget)
        .where(DashboardWidget.dashboard_id == dashboard_id)
        .order_by(DashboardWidget.position)
    )
    widgets = list(result.scalars().all())

    # Initialize with defaults if empty
    if not widgets:
        for widget_data in DEFAULT_WIDGETS:
            widget = DashboardWidget(dashboard_id=dashboard_id, **widget_data)
            session.add(widget)
        await session.commit()

        # Re-fetch
        result = await session.execute(
            select(DashboardWidget)
            .where(DashboardWidget.dashboard_id == dashboard_id)
            .order_by(DashboardWidget.position)
        )
        widgets = list(result.scalars().all())
    else:
        # Check for missing widget types and add them
        existing_types = {w.widget_type for w in widgets}
        max_position = max(w.position for w in widgets) if widgets else -1
        added = False

        for widget_data in DEFAULT_WIDGETS:
            if widget_data["widget_type"] not in existing_types:
                max_position += 1
                widget = DashboardWidget(
                    dashboard_id=dashboard_id,
                    **{**widget_data, "position": max_position}
                )
                session.add(widget)
                added = True

        if added:
            await session.commit()
            result = await session.execute(
                select(DashboardWidget)
                .where(DashboardWidget.dashboard_id == dashboard_id)
                .order_by(DashboardWidget.position)
            )
            widgets = list(result.scalars().all())

    return widgets


@router.post("/{dashboard_id}/widgets", response_model=DashboardWidget, status_code=201)
async def create_dashboard_widget(
    dashboard_id: int,
    widget: DashboardWidgetCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new widget on a dashboard."""
    # Verify dashboard exists
    dash_result = await session.execute(
        select(Dashboard).where(Dashboard.id == dashboard_id)
    )
    if not dash_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Dashboard not found")

    db_widget = DashboardWidget(
        dashboard_id=dashboard_id,
        **widget.model_dump(exclude={"dashboard_id"})
    )
    session.add(db_widget)
    await session.commit()
    await session.refresh(db_widget)
    return db_widget
