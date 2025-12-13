"""
Dashboards API

Manages named dashboards with filters and view settings.
Each dashboard can have its own set of widgets.
"""

from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel

from app.database import get_session
from app.models import (
    Dashboard,
    DashboardCreate,
    DashboardUpdate,
    DashboardWidget,
    DashboardWidgetCreate,
    DateRangeType,
)
from app.errors import ErrorCode, not_found, bad_request


# ============================================================================
# Date Range Calculation
# ============================================================================

DATE_RANGE_LABELS = {
    DateRangeType.mtd: "Month to Date",
    DateRangeType.qtd: "Quarter to Date",
    DateRangeType.ytd: "Year to Date",
    DateRangeType.last_30_days: "Last 30 Days",
    DateRangeType.last_90_days: "Last 90 Days",
    DateRangeType.last_year: "Last Year",
}


def calculate_date_range(range_type: DateRangeType) -> Dict[str, Any]:
    """
    Calculate start and end dates for a given date range type.

    Returns dict with:
    - start_date: ISO date string (YYYY-MM-DD)
    - end_date: ISO date string (YYYY-MM-DD)
    - label: Human-readable label
    """
    today = date.today()

    if range_type == DateRangeType.mtd:
        # Month to Date: Start of current month to today
        start_date = today.replace(day=1)
        end_date = today

    elif range_type == DateRangeType.qtd:
        # Quarter to Date: Start of current quarter to today
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        start_date = today.replace(month=quarter_start_month, day=1)
        end_date = today

    elif range_type == DateRangeType.ytd:
        # Year to Date: Jan 1 to today
        start_date = today.replace(month=1, day=1)
        end_date = today

    elif range_type == DateRangeType.last_30_days:
        # Rolling 30 days
        start_date = today - timedelta(days=30)
        end_date = today

    elif range_type == DateRangeType.last_90_days:
        # Rolling 90 days
        start_date = today - timedelta(days=90)
        end_date = today

    elif range_type == DateRangeType.last_year:
        # Previous calendar year
        last_year = today.year - 1
        start_date = date(last_year, 1, 1)
        end_date = date(last_year, 12, 31)

    else:
        # Default to MTD
        start_date = today.replace(day=1)
        end_date = today

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "label": DATE_RANGE_LABELS.get(range_type, "Custom"),
    }


class DateRange(BaseModel):
    """Calculated date range for dashboard"""

    start_date: str
    end_date: str
    label: str


class DashboardResponse(BaseModel):
    """Dashboard with calculated date range"""

    id: int
    name: str
    description: Optional[str]
    date_range_type: DateRangeType
    date_range: DateRange
    is_default: bool
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


def dashboard_to_response(dashboard: Dashboard) -> DashboardResponse:
    """Convert Dashboard model to response with calculated date range."""
    date_range = calculate_date_range(dashboard.date_range_type)
    return DashboardResponse(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description,
        date_range_type=dashboard.date_range_type,
        date_range=DateRange(**date_range),
        is_default=dashboard.is_default,
        position=dashboard.position,
        created_at=dashboard.created_at,
        updated_at=dashboard.updated_at,
    )


router = APIRouter(prefix="/api/v1/dashboards", tags=["dashboards"])

# Default widget configuration - used to initialize new dashboards
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


async def get_or_create_default_dashboard(session: AsyncSession) -> Dashboard:
    """Get the default dashboard, creating one if none exists."""
    result = await session.execute(select(Dashboard).where(Dashboard.is_default.is_(True)))
    dashboard = result.scalar_one_or_none()

    if not dashboard:
        # Create default dashboard with MTD date range
        dashboard = Dashboard(
            name="Default",
            description="Default dashboard",
            date_range_type=DateRangeType.mtd,
            is_default=True,
            position=0,
        )
        session.add(dashboard)
        await session.commit()
        await session.refresh(dashboard)

    return dashboard


@router.get("", response_model=List[DashboardResponse])
async def list_dashboards(session: AsyncSession = Depends(get_session)):
    """List all dashboards ordered by position, with calculated date ranges."""
    result = await session.execute(select(Dashboard).order_by(Dashboard.position))
    dashboards = list(result.scalars().all())

    # Ensure at least one default dashboard exists
    if not dashboards:
        dashboard = await get_or_create_default_dashboard(session)
        dashboards = [dashboard]

    return [dashboard_to_response(d) for d in dashboards]


@router.get("/default", response_model=DashboardResponse)
async def get_default_dashboard(session: AsyncSession = Depends(get_session)):
    """Get the default dashboard with calculated date range."""
    dashboard = await get_or_create_default_dashboard(session)
    return dashboard_to_response(dashboard)


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(dashboard_id: int, session: AsyncSession = Depends(get_session)):
    """Get a dashboard by ID with calculated date range."""
    result = await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, dashboard_id=dashboard_id)
    return dashboard_to_response(dashboard)


@router.post("", response_model=DashboardResponse, status_code=201)
async def create_dashboard(dashboard: DashboardCreate, session: AsyncSession = Depends(get_session)):
    """Create a new dashboard.

    If is_default is True, clears the default flag from other dashboards.
    Initializes with default widgets.
    """
    import logging

    logger = logging.getLogger(__name__)

    try:
        # If setting as default, clear other defaults first
        if dashboard.is_default:
            result = await session.execute(select(Dashboard).where(Dashboard.is_default.is_(True)))
            for existing in result.scalars().all():
                existing.is_default = False

        db_dashboard = Dashboard(**dashboard.model_dump())
        session.add(db_dashboard)
        await session.commit()
        await session.refresh(db_dashboard)
        logger.info(f"Created dashboard with id={db_dashboard.id}")

        # Initialize with default widgets using raw SQL to avoid SQLite async RETURNING issues
        from sqlalchemy import text
        from datetime import datetime

        now = datetime.utcnow()
        for widget_data in DEFAULT_WIDGETS:
            await session.execute(
                text("""
                    INSERT INTO dashboard_widgets
                    (created_at, updated_at, dashboard_id, widget_type, position, width, is_visible, config)
                    VALUES (:created_at, :updated_at, :dashboard_id, :widget_type, :position, :width, :is_visible, :config)
                """),
                {
                    "created_at": now,
                    "updated_at": now,
                    "dashboard_id": db_dashboard.id,
                    "widget_type": widget_data["widget_type"],
                    "position": widget_data["position"],
                    "width": widget_data["width"],
                    "is_visible": widget_data["is_visible"],
                    "config": widget_data.get("config"),  # Explicitly handle None
                },
            )
        await session.commit()
        logger.info(f"Created {len(DEFAULT_WIDGETS)} widgets for dashboard {db_dashboard.id}")

        return dashboard_to_response(db_dashboard)
    except Exception as e:
        logger.exception(f"Error creating dashboard: {e}")
        raise


@router.patch("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(dashboard_id: int, dashboard: DashboardUpdate, session: AsyncSession = Depends(get_session)):
    """Update a dashboard's settings."""
    result = await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    db_dashboard = result.scalar_one_or_none()
    if not db_dashboard:
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, dashboard_id=dashboard_id)

    update_data = dashboard.model_dump(exclude_unset=True)

    # If setting as default, clear other defaults first
    if update_data.get("is_default"):
        existing_result = await session.execute(select(Dashboard).where(Dashboard.is_default.is_(True)))
        for existing in existing_result.scalars().all():
            if existing.id != dashboard_id:
                existing.is_default = False

    for key, value in update_data.items():
        setattr(db_dashboard, key, value)

    db_dashboard.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(db_dashboard)
    return dashboard_to_response(db_dashboard)


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(dashboard_id: int, session: AsyncSession = Depends(get_session)):
    """Delete a dashboard and its widgets.

    Cannot delete the last dashboard or a default dashboard
    (unless it's the only one and you're replacing it).
    """
    result = await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, dashboard_id=dashboard_id)

    # Count total dashboards
    count_result = await session.execute(select(Dashboard))
    all_dashboards = list(count_result.scalars().all())
    if len(all_dashboards) <= 1:
        raise bad_request(ErrorCode.CANNOT_DELETE_LAST_DASHBOARD)

    # If deleting the default, promote another dashboard
    if dashboard.is_default:
        for other in all_dashboards:
            if other.id != dashboard_id:
                other.is_default = True
                break

    # Delete associated widgets first
    widgets_result = await session.execute(select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id))
    for widget in widgets_result.scalars().all():
        await session.delete(widget)

    await session.delete(dashboard)
    await session.commit()


@router.post("/{dashboard_id}/clone", response_model=DashboardResponse, status_code=201)
async def clone_dashboard(dashboard_id: int, session: AsyncSession = Depends(get_session)):
    """Clone a dashboard with all its widgets."""
    result = await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    original = result.scalar_one_or_none()
    if not original:
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, dashboard_id=dashboard_id)

    # Find max position
    max_result = await session.execute(select(Dashboard))
    all_dashboards = list(max_result.scalars().all())
    max_position = max(d.position for d in all_dashboards) if all_dashboards else -1

    # Clone dashboard - use numeric suffix (language-neutral)
    # Find existing names with same base to avoid duplicates
    base_name = original.name
    existing_names_result = await session.execute(select(Dashboard.name).where(Dashboard.name.like(f"{base_name}%")))
    existing_names = {r[0] for r in existing_names_result.all()}

    # Try "Name 2", "Name 3", etc.
    new_name = f"{base_name} 2"
    counter = 2
    while new_name in existing_names:
        counter += 1
        new_name = f"{base_name} {counter}"

    new_dashboard = Dashboard(
        name=new_name,
        description=original.description,
        date_range_type=original.date_range_type,
        is_default=False,
        position=max_position + 1,
    )
    session.add(new_dashboard)
    await session.commit()
    await session.refresh(new_dashboard)

    # Clone widgets
    widgets_result = await session.execute(select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id))
    for original_widget in widgets_result.scalars().all():
        new_widget = DashboardWidget(
            dashboard_id=new_dashboard.id,
            widget_type=original_widget.widget_type,
            position=original_widget.position,
            width=original_widget.width,
            is_visible=original_widget.is_visible,
            config=original_widget.config,
        )
        session.add(new_widget)
    await session.commit()

    return dashboard_to_response(new_dashboard)


@router.post("/{dashboard_id}/set-default", response_model=DashboardResponse)
async def set_default_dashboard(dashboard_id: int, session: AsyncSession = Depends(get_session)):
    """Set a dashboard as the default."""
    result = await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, dashboard_id=dashboard_id)

    # Clear other defaults
    all_result = await session.execute(select(Dashboard).where(Dashboard.is_default.is_(True)))
    for existing in all_result.scalars().all():
        existing.is_default = False

    dashboard.is_default = True
    dashboard.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(dashboard)
    return dashboard_to_response(dashboard)


@router.put("/reorder", response_model=List[DashboardResponse])
async def reorder_dashboards(order: List[dict], session: AsyncSession = Depends(get_session)):
    """Update dashboard positions for tab ordering.

    Expects list of {"id": int, "position": int} objects.
    """
    for item in order:
        dashboard_id = item.get("id")
        new_position = item.get("position")

        if dashboard_id is None or new_position is None:
            raise bad_request(ErrorCode.VALIDATION_ERROR, "Each item must have 'id' and 'position' fields")

        result = await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
        dashboard = result.scalar_one_or_none()
        if not dashboard:
            raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, dashboard_id=dashboard_id)

        dashboard.position = new_position
        dashboard.updated_at = datetime.utcnow()

    await session.commit()

    # Return updated order
    result = await session.execute(select(Dashboard).order_by(Dashboard.position))
    dashboards = list(result.scalars().all())
    return [dashboard_to_response(d) for d in dashboards]


# Widget endpoints scoped under dashboards


@router.get("/{dashboard_id}/widgets", response_model=List[DashboardWidget])
async def list_dashboard_widgets(dashboard_id: int, session: AsyncSession = Depends(get_session)):
    """Get all widgets for a dashboard, initializing defaults if needed."""
    # Verify dashboard exists
    dash_result = await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = dash_result.scalar_one_or_none()
    if not dashboard:
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, dashboard_id=dashboard_id)

    result = await session.execute(
        select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id).order_by(DashboardWidget.position)
    )
    widgets = list(result.scalars().all())

    return widgets


@router.post("/{dashboard_id}/widgets", response_model=DashboardWidget, status_code=201)
async def create_dashboard_widget(
    dashboard_id: int, widget: DashboardWidgetCreate, session: AsyncSession = Depends(get_session)
):
    """Create a new widget on a dashboard."""
    # Verify dashboard exists
    dash_result = await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    if not dash_result.scalar_one_or_none():
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, dashboard_id=dashboard_id)

    db_widget = DashboardWidget(dashboard_id=dashboard_id, **widget.model_dump(exclude={"dashboard_id"}))
    session.add(db_widget)
    await session.commit()
    await session.refresh(db_widget)
    return db_widget
