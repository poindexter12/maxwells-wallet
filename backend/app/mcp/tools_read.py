"""Read-only MCP tools for wallet data and spending analysis."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload

from app.mcp.context import require_scope, tool_session
from app.mcp.server import mcp_server
from app.orm import Dashboard, Tag, TagRule, Transaction
from app.routers.tag_rules import match_rule
from app.services.assistant.tools import _spending_filters


def _date(value: str | None, name: str) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ToolError(f"{name} must be an ISO date (YYYY-MM-DD).") from exc


def _limit(value: int, default: int = 50) -> int:
    return max(1, min(value if value > 0 else default, 200))


def _transaction_data(transaction: Transaction) -> dict[str, Any]:
    return {
        "id": transaction.id,
        "date": transaction.date.isoformat(),
        "amount": transaction.amount,
        "description": transaction.description,
        "merchant": transaction.merchant,
        "account_source": transaction.account_source,
        "is_transfer": transaction.is_transfer,
        "tags": [f"{tag.namespace}:{tag.value}" for tag in transaction.tags],
    }


@mcp_server.tool()
async def list_tags(namespace: str | None = None, limit: int = 200) -> dict[str, Any]:
    """List tags, optionally in one namespace. Results are capped at 200 rows."""
    require_scope("read")
    async with tool_session() as session:
        stmt = select(Tag).order_by(Tag.namespace, Tag.sort_order, Tag.value).limit(_limit(limit, 200))
        if namespace:
            stmt = stmt.where(Tag.namespace == namespace)
        tags = (await session.execute(stmt)).scalars().all()
    return {"tags": [{"id": tag.id, "namespace": tag.namespace, "value": tag.value} for tag in tags]}


@mcp_server.tool()
async def list_accounts(limit: int = 200) -> dict[str, Any]:
    """List distinct transaction account sources. Results are capped at 200 rows."""
    require_scope("read")
    async with tool_session() as session:
        rows = (await session.execute(
            select(Transaction.account_source).distinct().order_by(Transaction.account_source).limit(_limit(limit, 200))
        )).scalars().all()
    return {"accounts": [{"account_source": account} for account in rows]}


@mcp_server.tool()
async def search_transactions(
    text: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    tags: list[str] | None = None,
    account_source: str | None = None,
    amount_min: float | None = None,
    amount_max: float | None = None,
    uncategorized_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Search transactions. Amounts use the database sign convention: negative means spending; results cap at 200."""
    require_scope("read")
    start, end = _date(start_date, "start_date"), _date(end_date, "end_date")
    clauses: list[Any] = []
    if start:
        clauses.append(Transaction.date >= start)
    if end:
        clauses.append(Transaction.date <= end)
    if text:
        pattern = f"%{text}%"
        clauses.append(or_(Transaction.description.ilike(pattern), Transaction.merchant.ilike(pattern)))
    if account_source:
        clauses.append(Transaction.account_source == account_source)
    if amount_min is not None:
        clauses.append(Transaction.amount >= amount_min)
    if amount_max is not None:
        clauses.append(Transaction.amount <= amount_max)
    for tag_value in tags or []:
        namespace, separator, value = tag_value.partition(":")
        if not separator:
            raise ToolError("tags entries must have namespace:value form.")
        clauses.append(Transaction.tags.any(and_(Tag.namespace == namespace, Tag.value == value)))
    if uncategorized_only:
        clauses.append(~Transaction.tags.any(Tag.namespace == "bucket"))
    async with tool_session() as session:
        stmt = (
            select(Transaction)
            .options(selectinload(Transaction.tags))
            .where(*clauses)
            .order_by(Transaction.date.desc(), Transaction.id.desc())
            .offset(max(offset, 0))
            .limit(_limit(limit))
        )
        transactions = (await session.execute(stmt)).scalars().all()
    return {"transactions": [_transaction_data(transaction) for transaction in transactions]}


@mcp_server.tool()
async def get_transaction(transaction_id: int) -> dict[str, Any]:
    """Get one transaction by ID. Its negative amount denotes spending in the database convention."""
    require_scope("read")
    async with tool_session() as session:
        transaction = (await session.execute(
            select(Transaction).options(selectinload(Transaction.tags)).where(Transaction.id == transaction_id)
        )).scalar_one_or_none()
    if transaction is None:
        raise ToolError(f"Transaction {transaction_id} was not found.")
    return {"transaction": _transaction_data(transaction)}


@mcp_server.tool()
async def spending_summary(
    start_date: str | None = None,
    end_date: str | None = None,
    group_by: Literal["bucket", "merchant", "month", "account", "tag"] = "bucket",
) -> dict[str, Any]:
    """Summarize non-transfer spending. Negative transaction amounts mean spending; grouped amounts are positive magnitudes."""
    require_scope("read")
    start, end = _date(start_date, "start_date"), _date(end_date, "end_date")
    async with tool_session() as session:
        transactions = (await session.execute(
            select(Transaction).options(selectinload(Transaction.tags)).where(*_spending_filters(start, end))
        )).scalars().all()
    totals: dict[str, float] = {}
    for transaction in transactions:
        if transaction.amount >= 0:
            continue
        if group_by == "bucket":
            keys = [next((tag.value for tag in transaction.tags if tag.namespace == "bucket"), "Untagged")]
        elif group_by == "merchant":
            keys = [transaction.merchant or "Unknown"]
        elif group_by == "month":
            keys = [transaction.date.strftime("%Y-%m")]
        elif group_by == "account":
            keys = [transaction.account_source]
        else:
            keys = [f"{tag.namespace}:{tag.value}" for tag in transaction.tags] or ["Untagged"]
        for key in keys:
            totals[key] = totals.get(key, 0.0) + abs(transaction.amount)
    all_groups = [{"group": key, "amount": round(amount, 2)} for key, amount in sorted(totals.items(), key=lambda item: -item[1])]
    groups = all_groups[:200]
    return {
        "start_date": start_date,
        "end_date": end_date,
        "group_by": group_by,
        "groups": groups,
        "total_groups": len(all_groups),
        "truncated": len(all_groups) > len(groups),
    }


@mcp_server.tool()
async def top_merchants(start_date: str | None = None, end_date: str | None = None, limit: int = 10) -> dict[str, Any]:
    """Return merchants by spending magnitude. Negative transaction amounts mean spending; results cap at 200."""
    require_scope("read")
    start, end = _date(start_date, "start_date"), _date(end_date, "end_date")
    async with tool_session() as session:
        transactions = (await session.execute(select(Transaction).where(*_spending_filters(start, end)))).scalars().all()
    totals: dict[str, float] = {}
    for transaction in transactions:
        if transaction.amount < 0 and transaction.merchant:
            totals[transaction.merchant] = totals.get(transaction.merchant, 0.0) + abs(transaction.amount)
    merchants = sorted(totals.items(), key=lambda item: -item[1])[:_limit(limit, 10)]
    return {"top_merchants": [{"merchant": merchant, "amount": round(amount, 2)} for merchant, amount in merchants]}


@mcp_server.tool()
async def list_rules(limit: int = 200) -> dict[str, Any]:
    """List enabled and disabled tag rules by priority. Results are capped at 200 rows."""
    require_scope("read")
    async with tool_session() as session:
        rules = (await session.execute(
            select(TagRule).order_by(TagRule.priority.desc(), TagRule.created_at).limit(_limit(limit, 200))
        )).scalars().all()
    fields = ("id", "name", "tag", "priority", "enabled", "merchant_pattern", "description_pattern", "amount_min", "amount_max", "account_source", "match_all")
    return {"rules": [{field: getattr(rule, field) for field in fields} for rule in rules]}


@mcp_server.tool()
async def preview_rule(
    merchant_pattern: str | None = None,
    description_pattern: str | None = None,
    amount_min: float | None = None,
    amount_max: float | None = None,
    account_source: str | None = None,
    match_all: bool = False,
    limit: int = 20,
) -> dict[str, Any]:
    """Preview an unsaved rule using existing match_rule semantics. Sample transactions cap at 200 rows; negative amounts mean spending."""
    require_scope("read")
    if not any((merchant_pattern, description_pattern, amount_min is not None, amount_max is not None, account_source)):
        raise ToolError("At least one rule condition is required.")
    rule = TagRule(
        name="MCP preview", tag="preview:preview", merchant_pattern=merchant_pattern,
        description_pattern=description_pattern, amount_min=amount_min, amount_max=amount_max,
        account_source=account_source, match_all=match_all,
    )
    async with tool_session() as session:
        transactions = (await session.execute(
            select(Transaction).options(selectinload(Transaction.tags)).order_by(Transaction.date.desc(), Transaction.id.desc())
        )).scalars().all()
    matches = [transaction for transaction in transactions if match_rule(transaction, rule)]
    sample = [_transaction_data(transaction) for transaction in matches[:_limit(limit, 20)]]
    return {
        "match_count": len(matches),
        "sample": sample,
        "truncated": len(matches) > len(sample),
    }


@mcp_server.tool()
async def list_dashboards(limit: int = 200) -> dict[str, Any]:
    """List dashboards and their widgets. Results are capped at 200 rows."""
    require_scope("read")
    async with tool_session() as session:
        dashboards = (await session.execute(
            select(Dashboard).options(selectinload(Dashboard.widgets)).order_by(Dashboard.position).limit(_limit(limit, 200))
        )).scalars().all()
    return {"dashboards": [_dashboard_data(dashboard) for dashboard in dashboards]}


@mcp_server.tool()
async def get_dashboard(dashboard_id: int) -> dict[str, Any]:
    """Get a dashboard and its widget configuration by ID."""
    require_scope("read")
    async with tool_session() as session:
        dashboard = (await session.execute(
            select(Dashboard).options(selectinload(Dashboard.widgets)).where(Dashboard.id == dashboard_id)
        )).scalar_one_or_none()
    if dashboard is None:
        raise ToolError(f"Dashboard {dashboard_id} was not found.")
    return {"dashboard": _dashboard_data(dashboard)}


def _dashboard_data(dashboard: Dashboard) -> dict[str, Any]:
    return {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "date_range_type": dashboard.date_range_type,
        "is_default": dashboard.is_default,
        "widgets": [
            {"id": widget.id, "widget_type": widget.widget_type, "position": widget.position, "width": widget.width,
             "is_visible": widget.is_visible, "config": widget.config}
            for widget in dashboard.widgets
        ],
    }
