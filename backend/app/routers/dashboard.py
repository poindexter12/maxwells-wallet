"""
Dashboard Widget Configuration API

Manages user's dashboard layout and widget settings.
These endpoints work with the default dashboard for backwards compatibility.
For multi-dashboard support, use /api/v1/dashboards/* endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime

from app.database import get_session
from app.orm import Dashboard, DashboardWidget
from app.schemas import DashboardLayoutUpdate, DashboardWidgetCreate, DashboardWidgetUpdate, DashboardWidgetResponse
from app.errors import ErrorCode, not_found, bad_request


async def get_default_dashboard_id(session: AsyncSession) -> int:
    """Get the default dashboard ID, creating one with widgets if needed."""
    result = await session.execute(select(Dashboard).where(Dashboard.is_default.is_(True)))
    dashboard = result.scalar_one_or_none()

    if not dashboard:
        # Create default dashboard
        dashboard = Dashboard(
            name="Default", description="Default dashboard", view_mode="month", is_default=True, position=0
        )
        session.add(dashboard)
        await session.commit()
        await session.refresh(dashboard)

        # Initialize with default widgets
        for widget_data in DEFAULT_WIDGETS:
            widget = DashboardWidget(dashboard_id=dashboard.id, **widget_data)
            session.add(widget)
        await session.commit()

    return dashboard.id


router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

# Default widget configuration - used to initialize dashboard
# Widget names are translated on frontend based on widget_type
DEFAULT_WIDGETS = [
    {"widget_type": "summary", "position": 0, "width": "full", "is_visible": True},
    {"widget_type": "velocity", "position": 1, "width": "half", "is_visible": True},
    {"widget_type": "anomalies", "position": 2, "width": "half", "is_visible": True},
    {"widget_type": "bucket_pie", "position": 3, "width": "half", "is_visible": True},
    {"widget_type": "top_merchants", "position": 4, "width": "half", "is_visible": True},
    {"widget_type": "trends", "position": 5, "width": "full", "is_visible": True},
    {"widget_type": "sankey", "position": 6, "width": "full", "is_visible": False},
    {"widget_type": "treemap", "position": 7, "width": "full", "is_visible": False},
    {"widget_type": "heatmap", "position": 8, "width": "full", "is_visible": False},
]


@router.get("/widgets", response_model=List[DashboardWidgetResponse])
async def list_widgets(session: AsyncSession = Depends(get_session)):
    """Get all dashboard widgets for the default dashboard, ordered by position.

    Widgets are created when the default dashboard is first accessed.
    """
    dashboard_id = await get_default_dashboard_id(session)

    result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id).order_by(DashboardWidget.position)
    )
    widgets = list(result.scalars().all())

    return widgets


@router.get("/widgets/{widget_id}", response_model=DashboardWidgetResponse)
async def get_widget(widget_id: int, session: AsyncSession = Depends(get_session)):
    """Get a single widget by ID."""
    result = await session.execute(select(DashboardWidget).where(DashboardWidget.id == widget_id))
    widget = result.scalar_one_or_none()
    if not widget:
        raise not_found(ErrorCode.WIDGET_NOT_FOUND, widget_id=widget_id)
    return widget


@router.post("/widgets", response_model=DashboardWidgetResponse, status_code=201)
async def create_widget(widget: DashboardWidgetCreate, session: AsyncSession = Depends(get_session)):
    """Create a new dashboard widget on the default dashboard."""
    dashboard_id = widget.dashboard_id or await get_default_dashboard_id(session)
    db_widget = DashboardWidget(dashboard_id=dashboard_id, **widget.model_dump(exclude={"dashboard_id"}))
    session.add(db_widget)
    await session.commit()
    await session.refresh(db_widget)
    return db_widget


@router.patch("/widgets/{widget_id}", response_model=DashboardWidgetResponse)
async def update_widget(widget_id: int, widget: DashboardWidgetUpdate, session: AsyncSession = Depends(get_session)):
    """Update a widget's settings."""
    result = await session.execute(select(DashboardWidget).where(DashboardWidget.id == widget_id))
    db_widget = result.scalar_one_or_none()
    if not db_widget:
        raise not_found(ErrorCode.WIDGET_NOT_FOUND, widget_id=widget_id)

    for key, value in widget.model_dump(exclude_unset=True).items():
        setattr(db_widget, key, value)

    db_widget.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(db_widget)
    return db_widget


@router.delete("/widgets/{widget_id}", status_code=204)
async def delete_widget(widget_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a widget from the dashboard."""
    result = await session.execute(select(DashboardWidget).where(DashboardWidget.id == widget_id))
    widget = result.scalar_one_or_none()
    if not widget:
        raise not_found(ErrorCode.WIDGET_NOT_FOUND, widget_id=widget_id)

    await session.delete(widget)
    await session.commit()


@router.put("/layout", response_model=List[DashboardWidgetResponse])
async def update_layout(layout: DashboardLayoutUpdate, session: AsyncSession = Depends(get_session)):
    """Update widget positions (for drag-and-drop reordering).

    Expects a list of widget IDs with their new positions.
    """
    dashboard_id = await get_default_dashboard_id(session)

    for widget_update in layout.widgets:
        widget_id = widget_update.get("id")
        new_position = widget_update.get("position")

        if widget_id is None or new_position is None:
            raise bad_request(ErrorCode.VALIDATION_ERROR, "Each widget must have 'id' and 'position' fields")

        result = await session.execute(select(DashboardWidget).where(DashboardWidget.id == widget_id))
        widget = result.scalar_one_or_none()
        if not widget:
            raise not_found(ErrorCode.WIDGET_NOT_FOUND, widget_id=widget_id)

        widget.position = new_position
        widget.updated_at = datetime.utcnow()

    await session.commit()

    # Return updated layout
    result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id).order_by(DashboardWidget.position)
    )
    return result.scalars().all()


@router.post("/reset", response_model=List[DashboardWidgetResponse])
async def reset_dashboard(session: AsyncSession = Depends(get_session)):
    """Reset default dashboard to default widget configuration.

    Deletes all existing widgets and recreates defaults.
    """
    dashboard_id = await get_default_dashboard_id(session)

    # Delete all existing widgets for this dashboard
    result = await session.execute(select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id))
    for widget in result.scalars().all():
        await session.delete(widget)

    # Create defaults
    for widget_data in DEFAULT_WIDGETS:
        widget = DashboardWidget(dashboard_id=dashboard_id, **widget_data)
        session.add(widget)

    await session.commit()

    # Return new layout
    result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id).order_by(DashboardWidget.position)
    )
    return result.scalars().all()


@router.patch("/widgets/{widget_id}/visibility")
async def toggle_widget_visibility(widget_id: int, session: AsyncSession = Depends(get_session)):
    """Toggle a widget's visibility."""
    result = await session.execute(select(DashboardWidget).where(DashboardWidget.id == widget_id))
    widget = result.scalar_one_or_none()
    if not widget:
        raise not_found(ErrorCode.WIDGET_NOT_FOUND, widget_id=widget_id)

    widget.is_visible = not widget.is_visible
    widget.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(widget)

    return {"id": widget.id, "is_visible": widget.is_visible}


@router.post("/widgets/{widget_id}/duplicate", response_model=DashboardWidgetResponse, status_code=201)
async def duplicate_widget(widget_id: int, session: AsyncSession = Depends(get_session)):
    """Duplicate a widget with a new position at the end.

    Useful for creating multiple instances of the same widget type
    with different configurations (e.g., filtered views).
    """
    result = await session.execute(select(DashboardWidget).where(DashboardWidget.id == widget_id))
    original = result.scalar_one_or_none()
    if not original:
        raise not_found(ErrorCode.WIDGET_NOT_FOUND, widget_id=widget_id)

    # Find max position for the same dashboard
    dashboard_id = original.dashboard_id or await get_default_dashboard_id(session)
    max_result = await session.execute(select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id))
    all_widgets = list(max_result.scalars().all())
    max_position = max(w.position for w in all_widgets) if all_widgets else -1

    # Create duplicate
    new_widget = DashboardWidget(
        dashboard_id=dashboard_id,
        widget_type=original.widget_type,
        position=max_position + 1,
        width=original.width,
        is_visible=True,
        config=None,  # Start with no config, user will configure
    )
    session.add(new_widget)
    await session.commit()
    await session.refresh(new_widget)

    return new_widget
