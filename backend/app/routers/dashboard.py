"""
Dashboard Widget Configuration API

Manages user's dashboard layout and widget settings.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime

from app.database import get_session
from app.models import (
    DashboardWidget, DashboardWidgetCreate, DashboardWidgetUpdate,
    DashboardLayoutUpdate
)

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

# Default widget configuration - used to initialize dashboard
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


@router.get("/widgets", response_model=List[DashboardWidget])
async def list_widgets(session: AsyncSession = Depends(get_session)):
    """Get all dashboard widgets ordered by position.

    If no widgets exist, initializes with default configuration.
    Also adds any new widget types that don't exist yet.
    """
    result = await session.execute(
        select(DashboardWidget).order_by(DashboardWidget.position)
    )
    widgets = list(result.scalars().all())

    # Initialize with defaults if empty
    if not widgets:
        for widget_data in DEFAULT_WIDGETS:
            widget = DashboardWidget(**widget_data)
            session.add(widget)
        await session.commit()

        # Re-fetch after initialization
        result = await session.execute(
            select(DashboardWidget).order_by(DashboardWidget.position)
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
                    **{**widget_data, "position": max_position}
                )
                session.add(widget)
                added = True

        if added:
            await session.commit()
            result = await session.execute(
                select(DashboardWidget).order_by(DashboardWidget.position)
            )
            widgets = list(result.scalars().all())

    return widgets


@router.get("/widgets/{widget_id}", response_model=DashboardWidget)
async def get_widget(widget_id: int, session: AsyncSession = Depends(get_session)):
    """Get a single widget by ID."""
    result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.id == widget_id)
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    return widget


@router.post("/widgets", response_model=DashboardWidget, status_code=201)
async def create_widget(
    widget: DashboardWidgetCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new dashboard widget."""
    db_widget = DashboardWidget(**widget.model_dump())
    session.add(db_widget)
    await session.commit()
    await session.refresh(db_widget)
    return db_widget


@router.patch("/widgets/{widget_id}", response_model=DashboardWidget)
async def update_widget(
    widget_id: int,
    widget: DashboardWidgetUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update a widget's settings."""
    result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.id == widget_id)
    )
    db_widget = result.scalar_one_or_none()
    if not db_widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    for key, value in widget.model_dump(exclude_unset=True).items():
        setattr(db_widget, key, value)

    db_widget.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(db_widget)
    return db_widget


@router.delete("/widgets/{widget_id}", status_code=204)
async def delete_widget(widget_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a widget from the dashboard."""
    result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.id == widget_id)
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    await session.delete(widget)
    await session.commit()


@router.put("/layout", response_model=List[DashboardWidget])
async def update_layout(
    layout: DashboardLayoutUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update widget positions (for drag-and-drop reordering).

    Expects a list of widget IDs with their new positions.
    """
    for widget_update in layout.widgets:
        widget_id = widget_update.get("id")
        new_position = widget_update.get("position")

        if widget_id is None or new_position is None:
            raise HTTPException(
                status_code=400,
                detail="Each widget must have 'id' and 'position' fields"
            )

        result = await session.execute(
            select(DashboardWidget).where(DashboardWidget.id == widget_id)
        )
        widget = result.scalar_one_or_none()
        if not widget:
            raise HTTPException(status_code=404, detail=f"Widget {widget_id} not found")

        widget.position = new_position
        widget.updated_at = datetime.utcnow()

    await session.commit()

    # Return updated layout
    result = await session.execute(
        select(DashboardWidget).order_by(DashboardWidget.position)
    )
    return result.scalars().all()


@router.post("/reset", response_model=List[DashboardWidget])
async def reset_dashboard(session: AsyncSession = Depends(get_session)):
    """Reset dashboard to default widget configuration.

    Deletes all existing widgets and recreates defaults.
    """
    # Delete all existing widgets
    result = await session.execute(select(DashboardWidget))
    for widget in result.scalars().all():
        await session.delete(widget)

    # Create defaults
    for widget_data in DEFAULT_WIDGETS:
        widget = DashboardWidget(**widget_data)
        session.add(widget)

    await session.commit()

    # Return new layout
    result = await session.execute(
        select(DashboardWidget).order_by(DashboardWidget.position)
    )
    return result.scalars().all()


@router.patch("/widgets/{widget_id}/visibility")
async def toggle_widget_visibility(
    widget_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Toggle a widget's visibility."""
    result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.id == widget_id)
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    widget.is_visible = not widget.is_visible
    widget.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(widget)

    return {"id": widget.id, "is_visible": widget.is_visible}
