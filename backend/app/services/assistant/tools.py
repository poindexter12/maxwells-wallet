"""Curated tool registry for the AI assistant.

This is the *entire* surface the model can touch — there is no arbitrary SQL or
endpoint access. Tools are classified ``read`` or ``write``:

- ``read`` tools execute automatically during the agent loop. Their results are
  tokenized (account/merchant/person names → stable tokens) before they are
  returned to the model.
- ``write`` tools are NEVER executed by the loop. When the model calls one, the
  loop validates the arguments, records a human-readable proposed action, and
  tells the model it is queued for the user's approval. The executor runs only
  when the user approves via the /execute endpoint.

Write allowlist (intentionally narrow): budgets, categorization (bucket tags),
and dashboards. Nothing here can create/edit/delete transactions, move money,
import, or touch accounts/admin/settings.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Awaitable, Callable, Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ErrorCode, bad_request, not_found
from app.orm import (
    Budget,
    BudgetPeriod,
    Dashboard,
    DashboardWidget,
    DateRangeType,
    Tag,
    Transaction,
    TransactionTag,
)
from app.routers.report_helpers import get_transaction_tags

from .tokenizer import Tokenizer

# Widget types the assistant may add (mirrors the frontend's supported set).
ALLOWED_WIDGET_TYPES = (
    "summary",
    "velocity",
    "anomalies",
    "bucket_pie",
    "top_merchants",
    "trends",
    "sankey",
    "treemap",
    "heatmap",
)
ALLOWED_WIDGET_WIDTHS = ("half", "full")


@dataclass
class AssistantContext:
    """Per-request dependencies handed to every tool handler."""

    session: AsyncSession
    tokenizer: Tokenizer


ReadHandler = Callable[[AssistantContext, dict], Awaitable[Any]]
WriteExecutor = Callable[[AssistantContext, dict], Awaitable[Any]]
WriteSummarizer = Callable[[dict], str]


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict  # JSON schema (object) advertised to the model
    access: Literal["read", "write"]
    handler: Optional[ReadHandler] = None        # read tools
    executor: Optional[WriteExecutor] = None     # write tools
    summarizer: Optional[WriteSummarizer] = None  # write tools: plain-language line

    @property
    def is_write(self) -> bool:
        return self.access == "write"


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        raise bad_request(ErrorCode.VALIDATION_ERROR, f"Invalid date '{value}', expected YYYY-MM-DD.")


def _spending_filters(start: Optional[date], end: Optional[date]):
    """Common WHERE clauses for spending: in range and not a transfer."""
    clauses = [Transaction.is_transfer.is_(False)]
    if start is not None:
        clauses.append(Transaction.date >= start)
    if end is not None:
        clauses.append(Transaction.date <= end)
    return clauses


# ---------------------------------------------------------------------------
# READ handlers (results are tokenized before reaching the model)
# ---------------------------------------------------------------------------


async def _read_list_tags(ctx: AssistantContext, args: dict) -> Any:
    namespace = args.get("namespace")
    stmt = select(Tag)
    if namespace:
        stmt = stmt.where(Tag.namespace == namespace)
    rows = (await ctx.session.execute(stmt.order_by(Tag.namespace, Tag.sort_order, Tag.value))).scalars().all()
    out = []
    for t in rows:
        # Account names are PII; bucket/occasion values are categories (safe).
        value = ctx.tokenizer.tokenize(t.value, "account") if t.namespace == "account" else t.value
        out.append({"id": t.id, "namespace": t.namespace, "value": value})
    return {"tags": out}


async def _read_list_budgets(ctx: AssistantContext, args: dict) -> Any:
    rows = (await ctx.session.execute(select(Budget).order_by(Budget.tag))).scalars().all()
    out = []
    for b in rows:
        tag = b.tag
        # Tags are "namespace:value"; tokenize the value only for account tags.
        if tag and tag.startswith("account:"):
            tag = "account:" + (ctx.tokenizer.tokenize(tag.split(":", 1)[1], "account") or "")
        out.append({
            "id": b.id,
            "tag": tag,
            "amount": b.amount,
            "period": b.period,
            "start_date": b.start_date.isoformat() if b.start_date else None,
            "end_date": b.end_date.isoformat() if b.end_date else None,
            "rollover_enabled": b.rollover_enabled,
        })
    return {"budgets": out}


async def _read_spending_summary(ctx: AssistantContext, args: dict) -> Any:
    start, end = _parse_date(args.get("start_date")), _parse_date(args.get("end_date"))
    rows = (await ctx.session.execute(select(Transaction).where(*_spending_filters(start, end)))).scalars().all()
    income = sum(t.amount for t in rows if t.amount > 0)
    expenses = abs(sum(t.amount for t in rows if t.amount < 0))
    return {
        "start_date": start.isoformat() if start else None,
        "end_date": end.isoformat() if end else None,
        "total_income": round(income, 2),
        "total_expenses": round(expenses, 2),
        "net": round(income - expenses, 2),
        "transaction_count": len(rows),
    }


async def _read_spending_by_bucket(ctx: AssistantContext, args: dict) -> Any:
    start, end = _parse_date(args.get("start_date")), _parse_date(args.get("end_date"))
    rows = (await ctx.session.execute(select(Transaction).where(*_spending_filters(start, end)))).scalars().all()
    txn_tags = await get_transaction_tags(ctx.session, [t.id for t in rows])
    breakdown: dict[str, dict[str, float]] = {}
    for t in rows:
        if t.amount >= 0:
            continue
        bucket = txn_tags.get(t.id, "Untagged")  # bucket values are categories, not PII
        entry = breakdown.setdefault(bucket, {"amount": 0.0, "count": 0})
        entry["amount"] += abs(t.amount)
        entry["count"] += 1
    ranked = sorted(
        ({"bucket": k, "amount": round(v["amount"], 2), "count": int(v["count"])} for k, v in breakdown.items()),
        key=lambda x: x["amount"],
        reverse=True,
    )
    return {"by_bucket": ranked}


async def _read_top_merchants(ctx: AssistantContext, args: dict) -> Any:
    start, end = _parse_date(args.get("start_date")), _parse_date(args.get("end_date"))
    limit = min(int(args.get("limit", 10) or 10), 50)
    rows = (await ctx.session.execute(select(Transaction).where(*_spending_filters(start, end)))).scalars().all()
    totals: dict[str, float] = {}
    for t in rows:
        if t.merchant and t.amount < 0:
            totals[t.merchant] = totals.get(t.merchant, 0.0) + abs(t.amount)
    ranked = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:limit]
    return {
        "top_merchants": [
            {"merchant": ctx.tokenizer.tokenize(m, "merchant"), "amount": round(a, 2)} for m, a in ranked
        ]
    }


async def _read_list_transactions(ctx: AssistantContext, args: dict) -> Any:
    start, end = _parse_date(args.get("start_date")), _parse_date(args.get("end_date"))
    limit = min(int(args.get("limit", 50) or 50), 200)
    clauses = []
    if start is not None:
        clauses.append(Transaction.date >= start)
    if end is not None:
        clauses.append(Transaction.date <= end)
    stmt = select(Transaction).where(*clauses).order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit)
    rows = (await ctx.session.execute(stmt)).scalars().all()
    txn_tags = await get_transaction_tags(ctx.session, [t.id for t in rows])
    # NOTE: raw description/notes are deliberately omitted (max-privacy choice).
    return {
        "transactions": [
            {
                "id": t.id,
                "date": t.date.isoformat(),
                "amount": t.amount,
                "merchant": ctx.tokenizer.tokenize(t.merchant, "merchant"),
                "account": ctx.tokenizer.tokenize(t.account_source, "account"),
                "bucket": txn_tags.get(t.id),
                "is_transfer": t.is_transfer,
            }
            for t in rows
        ]
    }


async def _read_list_dashboards(ctx: AssistantContext, args: dict) -> Any:
    rows = (await ctx.session.execute(select(Dashboard).order_by(Dashboard.position))).scalars().all()
    # Dashboard names/widget types are user-defined labels, not PII.
    return {
        "dashboards": [
            {
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "date_range_type": d.date_range_type,
                "is_default": d.is_default,
                "widgets": [
                    {"id": w.id, "widget_type": w.widget_type, "width": w.width, "is_visible": w.is_visible}
                    for w in d.widgets
                ],
            }
            for d in rows
        ]
    }


# ---------------------------------------------------------------------------
# WRITE executors + summarizers (run only after user approval)
# ---------------------------------------------------------------------------


def _money(value: Any) -> str:
    try:
        return f"${float(value):,.2f}"
    except (TypeError, ValueError):
        return str(value)


async def _exec_create_budget(ctx: AssistantContext, args: dict) -> Any:
    amount = float(args["amount"])
    if amount <= 0:
        raise bad_request(ErrorCode.VALIDATION_ERROR, "Budget amount must be positive.")
    period = (args.get("period") or BudgetPeriod.monthly.value)
    if period not in {p.value for p in BudgetPeriod}:
        raise bad_request(ErrorCode.VALIDATION_ERROR, f"Invalid period '{period}'.")
    budget = Budget(
        tag=str(args["tag"]),
        amount=amount,
        period=period,
        start_date=_parse_date(args.get("start_date")),
        end_date=_parse_date(args.get("end_date")),
        rollover_enabled=bool(args.get("rollover_enabled", False)),
    )
    ctx.session.add(budget)
    await ctx.session.flush()
    return {"created_budget_id": budget.id, "tag": budget.tag, "amount": budget.amount}


def _sum_create_budget(args: dict) -> str:
    period = args.get("period") or "monthly"
    return f"Create a {period} budget of {_money(args.get('amount'))} for “{args.get('tag')}”"


async def _exec_update_budget(ctx: AssistantContext, args: dict) -> Any:
    budget = await ctx.session.get(Budget, int(args["budget_id"]))
    if budget is None:
        raise not_found(ErrorCode.BUDGET_NOT_FOUND, f"Budget {args['budget_id']} not found.")
    for fld in ("tag", "period"):
        if args.get(fld) is not None:
            setattr(budget, fld, str(args[fld]))
    if args.get("amount") is not None:
        amount = float(args["amount"])
        if amount <= 0:
            raise bad_request(ErrorCode.VALIDATION_ERROR, "Budget amount must be positive.")
        budget.amount = amount
    if args.get("rollover_enabled") is not None:
        budget.rollover_enabled = bool(args["rollover_enabled"])
    if args.get("start_date") is not None:
        budget.start_date = _parse_date(args["start_date"])
    if args.get("end_date") is not None:
        budget.end_date = _parse_date(args["end_date"])
    await ctx.session.flush()
    return {"updated_budget_id": budget.id}


def _sum_update_budget(args: dict) -> str:
    changes = []
    if args.get("amount") is not None:
        changes.append(f"amount → {_money(args.get('amount'))}")
    if args.get("period") is not None:
        changes.append(f"period → {args['period']}")
    if args.get("tag") is not None:
        changes.append(f"tag → “{args['tag']}”")
    if args.get("rollover_enabled") is not None:
        changes.append(f"rollover → {bool(args['rollover_enabled'])}")
    detail = ", ".join(changes) if changes else "no changes"
    return f"Update budget #{args.get('budget_id')} ({detail})"


async def _exec_categorize(ctx: AssistantContext, args: dict) -> Any:
    bucket_value = str(args["bucket"]).strip()
    txn_ids = [int(i) for i in args.get("transaction_ids", [])]
    if not bucket_value:
        raise bad_request(ErrorCode.VALIDATION_ERROR, "Bucket name is required.")
    if not txn_ids:
        raise bad_request(ErrorCode.NO_TRANSACTION_IDS, "No transactions specified.")

    # Find or create the bucket tag.
    tag = (
        await ctx.session.execute(
            select(Tag).where(Tag.namespace == "bucket", Tag.value == bucket_value)
        )
    ).scalar_one_or_none()
    if tag is None:
        tag = Tag(namespace="bucket", value=bucket_value)
        ctx.session.add(tag)
        await ctx.session.flush()

    applied = 0
    for txn_id in txn_ids:
        txn = await ctx.session.get(Transaction, txn_id)
        if txn is None:
            continue
        exists = (
            await ctx.session.execute(
                select(TransactionTag).where(
                    TransactionTag.transaction_id == txn_id, TransactionTag.tag_id == tag.id
                )
            )
        ).scalar_one_or_none()
        if exists is None:
            ctx.session.add(TransactionTag(transaction_id=txn_id, tag_id=tag.id))
            applied += 1
    await ctx.session.flush()
    return {"bucket": bucket_value, "tagged_count": applied}


def _sum_categorize(args: dict) -> str:
    n = len(args.get("transaction_ids", []))
    return f"Categorize {n} transaction{'s' if n != 1 else ''} as “{args.get('bucket')}”"


async def _exec_create_dashboard(ctx: AssistantContext, args: dict) -> Any:
    drt = args.get("date_range_type") or DateRangeType.mtd.value
    if drt not in {d.value for d in DateRangeType}:
        raise bad_request(ErrorCode.VALIDATION_ERROR, f"Invalid date_range_type '{drt}'.")
    # Place new dashboards after existing ones.
    max_pos = (await ctx.session.execute(select(func.max(Dashboard.position)))).scalar() or 0
    dashboard = Dashboard(
        name=str(args["name"]),
        description=args.get("description"),
        date_range_type=drt,
        position=int(max_pos) + 1,
    )
    ctx.session.add(dashboard)
    await ctx.session.flush()
    return {"created_dashboard_id": dashboard.id, "name": dashboard.name}


def _sum_create_dashboard(args: dict) -> str:
    return f"Create dashboard “{args.get('name')}”"


async def _exec_update_dashboard(ctx: AssistantContext, args: dict) -> Any:
    dashboard = await ctx.session.get(Dashboard, int(args["dashboard_id"]))
    if dashboard is None:
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, f"Dashboard {args['dashboard_id']} not found.")
    if args.get("name") is not None:
        dashboard.name = str(args["name"])
    if args.get("description") is not None:
        dashboard.description = args["description"]
    if args.get("date_range_type") is not None:
        drt = args["date_range_type"]
        if drt not in {d.value for d in DateRangeType}:
            raise bad_request(ErrorCode.VALIDATION_ERROR, f"Invalid date_range_type '{drt}'.")
        dashboard.date_range_type = drt
    await ctx.session.flush()
    return {"updated_dashboard_id": dashboard.id}


def _sum_update_dashboard(args: dict) -> str:
    return f"Update dashboard #{args.get('dashboard_id')}"


async def _exec_add_widget(ctx: AssistantContext, args: dict) -> Any:
    dashboard_id = int(args["dashboard_id"])
    dashboard = await ctx.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        raise not_found(ErrorCode.DASHBOARD_NOT_FOUND, f"Dashboard {dashboard_id} not found.")
    widget_type = str(args["widget_type"])
    if widget_type not in ALLOWED_WIDGET_TYPES:
        raise bad_request(
            ErrorCode.VALIDATION_ERROR,
            f"Unknown widget_type '{widget_type}'. Allowed: {', '.join(ALLOWED_WIDGET_TYPES)}.",
        )
    width = args.get("width") or "half"
    if width not in ALLOWED_WIDGET_WIDTHS:
        raise bad_request(ErrorCode.VALIDATION_ERROR, f"Invalid width '{width}'.")
    next_pos = len(dashboard.widgets)
    widget = DashboardWidget(
        dashboard_id=dashboard_id,
        widget_type=widget_type,
        width=width,
        position=next_pos,
        config=args.get("config"),
    )
    ctx.session.add(widget)
    await ctx.session.flush()
    return {"created_widget_id": widget.id, "dashboard_id": dashboard_id, "widget_type": widget_type}


def _sum_add_widget(args: dict) -> str:
    return f"Add a “{args.get('widget_type')}” widget to dashboard #{args.get('dashboard_id')}"


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

_DATE_PROP = {"type": "string", "description": "ISO date YYYY-MM-DD"}

_TOOLS: dict[str, Tool] = {}


def _register(tool: Tool) -> None:
    _TOOLS[tool.name] = tool


_register(Tool(
    name="list_tags",
    description="List available tags. Buckets are spending categories; accounts are pseudonymized.",
    parameters={
        "type": "object",
        "properties": {"namespace": {"type": "string", "enum": ["bucket", "occasion", "account"]}},
    },
    access="read",
    handler=_read_list_tags,
))

_register(Tool(
    name="list_budgets",
    description="List all budgets with their tag, amount, period, and date range.",
    parameters={"type": "object", "properties": {}},
    access="read",
    handler=_read_list_budgets,
))

_register(Tool(
    name="get_spending_summary",
    description="Total income, expenses, and net over an optional date range (transfers excluded).",
    parameters={
        "type": "object",
        "properties": {"start_date": _DATE_PROP, "end_date": _DATE_PROP},
    },
    access="read",
    handler=_read_spending_summary,
))

_register(Tool(
    name="get_spending_by_bucket",
    description="Spending grouped by bucket (category) over an optional date range. Transfers excluded.",
    parameters={
        "type": "object",
        "properties": {"start_date": _DATE_PROP, "end_date": _DATE_PROP},
    },
    access="read",
    handler=_read_spending_by_bucket,
))

_register(Tool(
    name="get_top_merchants",
    description="Top merchants by spending over an optional date range. Merchant names are pseudonymized.",
    parameters={
        "type": "object",
        "properties": {
            "start_date": _DATE_PROP,
            "end_date": _DATE_PROP,
            "limit": {"type": "integer", "minimum": 1, "maximum": 50},
        },
    },
    access="read",
    handler=_read_top_merchants,
))

_register(Tool(
    name="list_transactions",
    description=(
        "List transactions (most recent first) over an optional date range. "
        "Returns id, date, amount, pseudonymized merchant/account, and bucket. "
        "Raw descriptions are intentionally not included."
    ),
    parameters={
        "type": "object",
        "properties": {
            "start_date": _DATE_PROP,
            "end_date": _DATE_PROP,
            "limit": {"type": "integer", "minimum": 1, "maximum": 200},
        },
    },
    access="read",
    handler=_read_list_transactions,
))

_register(Tool(
    name="list_dashboards",
    description="List dashboards and their widgets.",
    parameters={"type": "object", "properties": {}},
    access="read",
    handler=_read_list_dashboards,
))

# --- writes (proposable only) ---

_register(Tool(
    name="create_budget",
    description="Propose creating a budget. tag is 'namespace:value' (e.g. 'bucket:Groceries').",
    parameters={
        "type": "object",
        "properties": {
            "tag": {"type": "string", "description": "namespace:value, e.g. bucket:Groceries"},
            "amount": {"type": "number", "exclusiveMinimum": 0},
            "period": {"type": "string", "enum": ["monthly", "yearly"]},
            "start_date": _DATE_PROP,
            "end_date": _DATE_PROP,
            "rollover_enabled": {"type": "boolean"},
        },
        "required": ["tag", "amount"],
    },
    access="write",
    executor=_exec_create_budget,
    summarizer=_sum_create_budget,
))

_register(Tool(
    name="update_budget",
    description="Propose updating an existing budget by id.",
    parameters={
        "type": "object",
        "properties": {
            "budget_id": {"type": "integer"},
            "tag": {"type": "string"},
            "amount": {"type": "number", "exclusiveMinimum": 0},
            "period": {"type": "string", "enum": ["monthly", "yearly"]},
            "start_date": _DATE_PROP,
            "end_date": _DATE_PROP,
            "rollover_enabled": {"type": "boolean"},
        },
        "required": ["budget_id"],
    },
    access="write",
    executor=_exec_update_budget,
    summarizer=_sum_update_budget,
))

_register(Tool(
    name="categorize_transactions",
    description="Propose applying a bucket (category) tag to a set of transactions by id.",
    parameters={
        "type": "object",
        "properties": {
            "transaction_ids": {"type": "array", "items": {"type": "integer"}},
            "bucket": {"type": "string", "description": "Bucket/category name, e.g. Groceries"},
        },
        "required": ["transaction_ids", "bucket"],
    },
    access="write",
    executor=_exec_categorize,
    summarizer=_sum_categorize,
))

_register(Tool(
    name="create_dashboard",
    description="Propose creating a dashboard.",
    parameters={
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "description": {"type": "string"},
            "date_range_type": {
                "type": "string",
                "enum": ["mtd", "qtd", "ytd", "last_30_days", "last_90_days", "last_year"],
            },
        },
        "required": ["name"],
    },
    access="write",
    executor=_exec_create_dashboard,
    summarizer=_sum_create_dashboard,
))

_register(Tool(
    name="update_dashboard",
    description="Propose updating a dashboard by id (name, description, date range).",
    parameters={
        "type": "object",
        "properties": {
            "dashboard_id": {"type": "integer"},
            "name": {"type": "string"},
            "description": {"type": "string"},
            "date_range_type": {
                "type": "string",
                "enum": ["mtd", "qtd", "ytd", "last_30_days", "last_90_days", "last_year"],
            },
        },
        "required": ["dashboard_id"],
    },
    access="write",
    executor=_exec_update_dashboard,
    summarizer=_sum_update_dashboard,
))

_register(Tool(
    name="add_dashboard_widget",
    description=f"Propose adding a widget to a dashboard. widget_type ∈ {list(ALLOWED_WIDGET_TYPES)}.",
    parameters={
        "type": "object",
        "properties": {
            "dashboard_id": {"type": "integer"},
            "widget_type": {"type": "string", "enum": list(ALLOWED_WIDGET_TYPES)},
            "width": {"type": "string", "enum": list(ALLOWED_WIDGET_WIDTHS)},
            "config": {"type": "string", "description": "Optional JSON config string"},
        },
        "required": ["dashboard_id", "widget_type"],
    },
    access="write",
    executor=_exec_add_widget,
    summarizer=_sum_add_widget,
))


# ---------------------------------------------------------------------------
# Public accessors
# ---------------------------------------------------------------------------


def get_tool(name: str) -> Optional[Tool]:
    return _TOOLS.get(name)


def all_tools() -> list[Tool]:
    return list(_TOOLS.values())


def tool_schemas() -> list[dict]:
    """Provider-neutral tool schemas advertised to the model."""
    return [
        {"name": t.name, "description": t.description, "parameters": t.parameters}
        for t in _TOOLS.values()
    ]


def is_write_tool(name: str) -> bool:
    tool = _TOOLS.get(name)
    return bool(tool and tool.is_write)
