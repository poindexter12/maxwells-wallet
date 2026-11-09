"""Write-scoped MCP tools.  They deliberately never mutate Transaction rows."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import structlog
from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy import and_, select

from app.config import settings
from app.mcp.context import current_principal, require_scope, tool_session
from app.mcp.server import mcp_server
from app.orm import Dashboard, DashboardWidget, Tag, TagRule, Transaction, TransactionTag
from app.routers.tag_rules import apply_tag_to_transaction, match_rule, parse_tag_string
from app.services.assistant.tools import ALLOWED_WIDGET_TYPES, ALLOWED_WIDGET_WIDTHS

log = structlog.get_logger(__name__)


def _guard() -> Any:
    require_scope("write")
    if settings.demo_mode:
        raise ToolError("Write tools are unavailable while demo mode is enabled.")
    return current_principal()


def _audit(name: str, principal: Any, counts: dict[str, int], dry_run: bool) -> None:
    log.info(
        "mcp_write_tool",
        tool=name,
        token_id=principal.token_id,
        user_id=principal.user_id,
        counts=counts,
        dry_run=dry_run,
    )


def _tag_parts(tag: str) -> tuple[str, str]:
    try:
        namespace, value = parse_tag_string(tag)
    except ValueError as exc:
        raise ToolError(str(exc)) from exc
    if not namespace or not value:
        raise ToolError("Tag must have non-empty namespace:value form.")
    return namespace, value


def _ids(transaction_ids: list[int]) -> list[int]:
    ids = list(dict.fromkeys(transaction_ids))
    if not ids or len(ids) > 500:
        raise ToolError("transaction_ids must contain between 1 and 500 unique IDs.")
    return ids


async def _tag(session: Any, tag_string: str) -> Tag:
    namespace, value = _tag_parts(tag_string)
    tag = (
        await session.execute(select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value)))
    ).scalar_one_or_none()
    if tag is None:
        raise ToolError(f"Tag '{tag_string}' does not exist; use create_tag first.")
    return cast(Tag, tag)


async def _transactions(session: Any, ids: list[int]) -> tuple[dict[int, Transaction], list[int]]:
    rows = (await session.execute(select(Transaction).where(Transaction.id.in_(ids)))).scalars().all()
    found = {row.id: row for row in rows}
    return found, [item for item in ids if item not in found]


async def _has_link(session: Any, transaction_id: int, tag_id: int) -> bool:
    return (
        await session.execute(
            select(TransactionTag).where(
                and_(TransactionTag.transaction_id == transaction_id, TransactionTag.tag_id == tag_id)
            )
        )
    ).scalar_one_or_none() is not None


@mcp_server.tool()
async def create_tag(
    tag: str, description: str | None = None, color: str | None = None, sort_order: int = 0
) -> dict[str, Any]:
    """Create one namespaced tag."""
    principal = _guard()
    namespace, value = _tag_parts(tag)
    async with tool_session() as session:
        existing = (
            await session.execute(select(Tag).where(and_(Tag.namespace == namespace, Tag.value == value)))
        ).scalar_one_or_none()
        if existing is not None:
            raise ToolError(f"Tag '{tag}' already exists.")
        item = Tag(namespace=namespace, value=value, description=description, color=color, sort_order=sort_order)
        session.add(item)
        await session.commit()
        await session.refresh(item)
    counts = {"changed": 1, "unchanged": 0, "not_found": 0}
    _audit("create_tag", principal, counts, False)
    return {"tag": {"id": item.id, "namespace": item.namespace, "value": item.value}, "counts": counts}


async def _bulk(tag: str, transaction_ids: list[int], dry_run: bool, remove: bool) -> dict[str, Any]:
    name = "remove_tag_from_transactions" if remove else "add_tag_to_transactions"
    principal = _guard()
    ids = _ids(transaction_ids)
    async with tool_session() as session:
        item = await _tag(session, tag)
        found, missing = await _transactions(session, ids)
        changed = unchanged = 0
        for transaction_id in found:
            link = (
                await session.execute(
                    select(TransactionTag).where(
                        and_(TransactionTag.transaction_id == transaction_id, TransactionTag.tag_id == item.id)
                    )
                )
            ).scalar_one_or_none()
            if (link is None) == remove:
                unchanged += 1
                continue
            changed += 1
            if not dry_run:
                if remove:
                    await session.delete(link)
                else:
                    session.add(TransactionTag(transaction_id=transaction_id, tag_id=item.id))
        if not dry_run:
            await session.commit()
    counts = {"changed": changed, "unchanged": unchanged, "not_found": len(missing)}
    _audit(name, principal, counts, dry_run)
    return {"counts": counts, "not_found_ids": missing, "dry_run": dry_run}


@mcp_server.tool()
async def add_tag_to_transactions(transaction_ids: list[int], tag: str, dry_run: bool = False) -> dict[str, Any]:
    """Link an existing tag to up to 500 transactions."""
    return await _bulk(tag, transaction_ids, dry_run, False)


@mcp_server.tool()
async def remove_tag_from_transactions(transaction_ids: list[int], tag: str, dry_run: bool = False) -> dict[str, Any]:
    """Remove one tag link from up to 500 transactions."""
    return await _bulk(tag, transaction_ids, dry_run, True)


@mcp_server.tool()
async def set_bucket(transaction_ids: list[int], bucket: str, dry_run: bool = False) -> dict[str, Any]:
    """Set the sole bucket tag for up to 500 transactions."""
    principal = _guard()
    ids = _ids(transaction_ids)
    namespace, _ = _tag_parts(bucket)
    if namespace != "bucket":
        raise ToolError("bucket must use the bucket:value namespace.")
    async with tool_session() as session:
        target = await _tag(session, bucket)
        found, missing = await _transactions(session, ids)
        changed = unchanged = 0
        for transaction_id in found:
            links = (
                (
                    await session.execute(
                        select(TransactionTag)
                        .join(Tag)
                        .where(and_(TransactionTag.transaction_id == transaction_id, Tag.namespace == "bucket"))
                    )
                )
                .scalars()
                .all()
            )
            if len(links) == 1 and links[0].tag_id == target.id:
                unchanged += 1
                continue
            changed += 1
            if not dry_run:
                for link in links:
                    await session.delete(link)
                session.add(TransactionTag(transaction_id=transaction_id, tag_id=target.id))
        if not dry_run:
            await session.commit()
    counts = {"changed": changed, "unchanged": unchanged, "not_found": len(missing)}
    _audit("set_bucket", principal, counts, dry_run)
    return {"counts": counts, "not_found_ids": missing, "dry_run": dry_run}


def _conditions(values: dict[str, Any]) -> None:
    if not any(
        (
            values.get("merchant_pattern"),
            values.get("description_pattern"),
            values.get("amount_min") is not None,
            values.get("amount_max") is not None,
            values.get("account_source"),
        )
    ):
        raise ToolError("At least one rule condition is required.")


async def _validate_rule_tag(session: Any, tag: str) -> None:
    await _tag(session, tag)


@mcp_server.tool()
async def create_rule(
    name: str,
    tag: str,
    merchant_pattern: str | None = None,
    description_pattern: str | None = None,
    amount_min: float | None = None,
    amount_max: float | None = None,
    account_source: str | None = None,
    match_all: bool = False,
    priority: int = 0,
    enabled: bool = True,
) -> dict[str, Any]:
    """Create a validated tag rule."""
    principal = _guard()
    values = locals().copy()
    _conditions(values)
    async with tool_session() as session:
        await _validate_rule_tag(session, tag)
        rule = TagRule(
            name=name,
            tag=tag,
            merchant_pattern=merchant_pattern,
            description_pattern=description_pattern,
            amount_min=amount_min,
            amount_max=amount_max,
            account_source=account_source,
            match_all=match_all,
            priority=priority,
            enabled=enabled,
        )
        session.add(rule)
        await session.commit()
        await session.refresh(rule)
    counts = {"changed": 1, "unchanged": 0, "not_found": 0}
    _audit("create_rule", principal, counts, False)
    return {"rule": {"id": rule.id, "name": rule.name, "tag": rule.tag}, "counts": counts}


@mcp_server.tool()
async def update_rule(
    rule_id: int,
    name: str | None = None,
    tag: str | None = None,
    merchant_pattern: str | None = None,
    description_pattern: str | None = None,
    amount_min: float | None = None,
    amount_max: float | None = None,
    account_source: str | None = None,
    match_all: bool | None = None,
    priority: int | None = None,
    enabled: bool | None = None,
) -> dict[str, Any]:
    """Update a tag rule, retaining REST validation semantics."""
    principal = _guard()
    async with tool_session() as session:
        rule = (await session.execute(select(TagRule).where(TagRule.id == rule_id))).scalar_one_or_none()
        if rule is None:
            raise ToolError(f"Rule {rule_id} was not found.")
        if tag is not None:
            await _validate_rule_tag(session, tag)
        changes = {
            key: value
            for key, value in {
                "name": name,
                "tag": tag,
                "merchant_pattern": merchant_pattern,
                "description_pattern": description_pattern,
                "amount_min": amount_min,
                "amount_max": amount_max,
                "account_source": account_source,
                "match_all": match_all,
                "priority": priority,
                "enabled": enabled,
            }.items()
            if value is not None
        }
        merged = {
            field: changes.get(field, getattr(rule, field))
            for field in ("merchant_pattern", "description_pattern", "amount_min", "amount_max", "account_source")
        }
        _conditions(merged)
        for key, value in changes.items():
            setattr(rule, key, value)
        rule.updated_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(rule)
    counts = {"changed": 1, "unchanged": 0, "not_found": 0}
    _audit("update_rule", principal, counts, False)
    return {"rule": {"id": rule.id, "name": rule.name, "tag": rule.tag}, "counts": counts}


@mcp_server.tool()
async def delete_rule(rule_id: int) -> dict[str, Any]:
    """Delete one TagRule row only."""
    principal = _guard()
    async with tool_session() as session:
        rule = (await session.execute(select(TagRule).where(TagRule.id == rule_id))).scalar_one_or_none()
        if rule is None:
            raise ToolError(f"Rule {rule_id} was not found.")
        await session.delete(rule)
        await session.commit()
    counts = {"changed": 1, "unchanged": 0, "not_found": 0}
    _audit("delete_rule", principal, counts, False)
    return {"counts": counts}


@mcp_server.tool()
async def apply_rules(rule_id: int | None = None, dry_run: bool = False) -> dict[str, Any]:
    """Apply enabled rules; global application skips categorised transactions."""
    principal = _guard()
    async with tool_session() as session:
        stmt = select(TagRule).where(TagRule.enabled.is_(True)).order_by(TagRule.priority.desc(), TagRule.created_at)
        if rule_id is not None:
            stmt = stmt.where(TagRule.id == rule_id)
        rules = (await session.execute(stmt)).scalars().all()
        if rule_id is not None and not rules:
            raise ToolError(f"Enabled rule {rule_id} was not found.")
        txns = (await session.execute(select(Transaction))).scalars().all()
        stats: list[dict[str, Any]] = []
        changed = unchanged = 0
        for txn in txns:
            if rule_id is None:
                current_bucket = (
                    await session.execute(
                        select(Tag)
                        .join(TransactionTag)
                        .where(and_(TransactionTag.transaction_id == txn.id, Tag.namespace == "bucket"))
                    )
                ).scalar_one_or_none()
                if current_bucket and current_bucket.value != "none":
                    continue
            for rule in rules:
                if not match_rule(txn, rule):
                    continue
                tag = await _tag(session, rule.tag)
                namespace, _ = parse_tag_string(rule.tag)
                exists = await _has_link(session, txn.id, tag.id)
                would_apply = not exists or (rule_id is not None and namespace == "bucket")
                if not would_apply:
                    unchanged += 1
                else:
                    applied = True if dry_run else await apply_tag_to_transaction(session, txn.id, rule.tag)
                    if applied:
                        changed += 1
                        stat = next((item for item in stats if item["rule_id"] == rule.id), None)
                        if stat is None:
                            stat = {"rule_id": rule.id, "rule_name": rule.name, "matches": 0}
                            stats.append(stat)
                        stat["matches"] += 1
                        if not dry_run:
                            rule.match_count += 1
                            rule.last_matched_date = datetime.now(UTC)
                    else:
                        unchanged += 1
                if rule_id is None and namespace == "bucket":
                    break
        if not dry_run:
            await session.commit()
    counts = {"changed": changed, "unchanged": unchanged, "not_found": 0}
    _audit("apply_rules", principal, counts, dry_run)
    return {"rules": stats[:200], "truncated": len(stats) > 200, "counts": counts, "dry_run": dry_run}


@mcp_server.tool()
async def create_dashboard(
    name: str, description: str | None = None, date_range_type: str = "mtd", is_default: bool = False, position: int = 0
) -> dict[str, Any]:
    """Create a dashboard; MCP never edits or deletes dashboards."""
    principal = _guard()
    async with tool_session() as session:
        dashboard = Dashboard(
            name=name,
            description=description,
            date_range_type=date_range_type,
            is_default=is_default,
            position=position,
        )
        session.add(dashboard)
        await session.commit()
        await session.refresh(dashboard)
    counts = {"changed": 1, "unchanged": 0, "not_found": 0}
    _audit("create_dashboard", principal, counts, False)
    return {"dashboard": {"id": dashboard.id, "name": dashboard.name}, "counts": counts}


@mcp_server.tool()
async def add_dashboard_widget(
    dashboard_id: int,
    widget_type: str,
    width: str = "half",
    position: int = 0,
    config: str | None = None,
    is_visible: bool = True,
) -> dict[str, Any]:
    """Add a validated widget to a dashboard."""
    principal = _guard()
    if widget_type not in ALLOWED_WIDGET_TYPES:
        raise ToolError(f"Unknown widget_type '{widget_type}'. Allowed: {', '.join(ALLOWED_WIDGET_TYPES)}.")
    if width not in ALLOWED_WIDGET_WIDTHS:
        raise ToolError(f"Unknown width '{width}'. Allowed: {', '.join(ALLOWED_WIDGET_WIDTHS)}.")
    async with tool_session() as session:
        dashboard = (await session.execute(select(Dashboard).where(Dashboard.id == dashboard_id))).scalar_one_or_none()
        if dashboard is None:
            raise ToolError(f"Dashboard {dashboard_id} was not found.")
        widget = DashboardWidget(
            dashboard_id=dashboard.id,
            widget_type=widget_type,
            width=width,
            position=position,
            config=config,
            is_visible=is_visible,
        )
        session.add(widget)
        await session.commit()
        await session.refresh(widget)
    counts = {"changed": 1, "unchanged": 0, "not_found": 0}
    _audit("add_dashboard_widget", principal, counts, False)
    return {
        "widget": {"id": widget.id, "dashboard_id": widget.dashboard_id, "widget_type": widget.widget_type},
        "counts": counts,
    }
