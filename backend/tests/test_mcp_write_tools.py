"""Contract tests for MCP write tools through the mounted Streamable HTTP endpoint."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import select

from app.config import settings
from app.orm import Tag, Transaction, TransactionTag, User
from app.services.api_tokens import create_api_token
from app.utils.auth import hash_password

READ_TOOL_NAMES = {
    "list_tags", "list_accounts", "search_transactions", "get_transaction", "spending_summary",
    "top_merchants", "list_rules", "preview_rule", "list_dashboards", "get_dashboard",
}
WRITE_TOOL_NAMES = {
    "create_tag", "add_tag_to_transactions", "remove_tag_from_transactions", "set_bucket",
    "create_rule", "update_rule", "delete_rule", "apply_rules", "create_dashboard",
    "add_dashboard_widget",
}


async def _token(async_session, scopes: list[str]) -> str:
    user = User(username=f"mcp-write-{','.join(scopes)}", password_hash=hash_password("password123"))
    async_session.add(user)
    await async_session.commit()
    _, raw = await create_api_token(
        async_session, user_id=user.id, name="MCP write", scopes=scopes, expires_at=None
    )
    return raw


@asynccontextmanager
async def _mcp(client, raw_token: str, mcp_running) -> AsyncIterator[dict[str, str]]:
    headers = {"Authorization": f"Bearer {raw_token}", "Accept": "application/json, text/event-stream"}
    initialize = {
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "pytest", "version": "1"}},
    }
    async with mcp_running():
        response = await client.post("/mcp", headers=headers, json=initialize)
        assert response.status_code == 200
        yield headers


async def _call(client, headers: dict[str, str], request_id: int, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    response = await client.post(
        "/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "id": request_id, "method": "tools/call", "params": {"name": name, "arguments": arguments}},
    )
    assert response.status_code == 200
    return response.json()["result"]


def _content(result: dict[str, Any]) -> str:
    return " ".join(part.get("text", "") for part in result.get("content", []))


async def test_tools_list_includes_exact_write_contract(client, async_session, mcp_running):
    raw = await _token(async_session, ["read", "write"])
    async with _mcp(client, raw, mcp_running) as headers:
        response = await client.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    assert response.status_code == 200
    assert {tool["name"] for tool in response.json()["result"]["tools"]} >= READ_TOOL_NAMES | WRITE_TOOL_NAMES


async def test_read_only_token_is_refused_by_every_write_tool(client, async_session, seed_tags, seed_transactions, mcp_running):
    raw = await _token(async_session, ["read"])
    invocations = {
        "create_tag": {"tag": "custom:one"},
        "add_tag_to_transactions": {"transaction_ids": [seed_transactions[0].id], "tag": "bucket:income"},
        "remove_tag_from_transactions": {"transaction_ids": [seed_transactions[0].id], "tag": "bucket:income"},
        "set_bucket": {"transaction_ids": [seed_transactions[0].id], "bucket": "bucket:income"},
        "create_rule": {"name": "rule", "tag": "bucket:income", "merchant_pattern": "Employer"},
        "update_rule": {"rule_id": 999, "name": "nope"},
        "delete_rule": {"rule_id": 999},
        "apply_rules": {},
        "create_dashboard": {"name": "Dashboard"},
        "add_dashboard_widget": {"dashboard_id": 999, "widget_type": "summary"},
    }
    async with _mcp(client, raw, mcp_running) as headers:
        for request_id, (name, arguments) in enumerate(invocations.items(), start=2):
            result = await _call(client, headers, request_id, name, arguments)
            assert result["isError"] is True, name
            assert "write" in _content(result).lower(), name


async def test_demo_mode_refuses_every_write_tool(client, async_session, seed_tags, seed_transactions, monkeypatch, mcp_running):
    raw = await _token(async_session, ["read", "write"])
    monkeypatch.setattr(settings, "demo_mode", True)
    invocations = {
        "create_tag": {"tag": "custom:one"},
        "add_tag_to_transactions": {"transaction_ids": [seed_transactions[0].id], "tag": "bucket:income"},
        "remove_tag_from_transactions": {"transaction_ids": [seed_transactions[0].id], "tag": "bucket:income"},
        "set_bucket": {"transaction_ids": [seed_transactions[0].id], "bucket": "bucket:income"},
        "create_rule": {"name": "rule", "tag": "bucket:income", "merchant_pattern": "Employer"},
        "update_rule": {"rule_id": 999, "name": "nope"},
        "delete_rule": {"rule_id": 999},
        "apply_rules": {},
        "create_dashboard": {"name": "Dashboard"},
        "add_dashboard_widget": {"dashboard_id": 999, "widget_type": "summary"},
    }
    async with _mcp(client, raw, mcp_running) as headers:
        for request_id, (name, arguments) in enumerate(invocations.items(), start=2):
            result = await _call(client, headers, request_id, name, arguments)
            assert result["isError"] is True, name
            assert "demo mode" in _content(result).lower(), name


async def test_tag_tools_dry_run_unknown_ids_and_bucket_replacement(client, async_session, seed_tags, seed_transactions, mcp_running):
    raw = await _token(async_session, ["read", "write"])
    transaction_id = seed_transactions[0].id
    async with _mcp(client, raw, mcp_running) as headers:
        created = await _call(client, headers, 2, "create_tag", {"tag": "custom:review"})
        assert created["structuredContent"]["counts"]["changed"] == 1
        dry_run = await _call(
            client, headers, 3, "add_tag_to_transactions",
            {"transaction_ids": [transaction_id, 999999], "tag": "custom:review", "dry_run": True},
        )
        assert dry_run["structuredContent"]["counts"] == {"changed": 1, "unchanged": 0, "not_found": 1}
        added = await _call(
            client, headers, 4, "add_tag_to_transactions",
            {"transaction_ids": [transaction_id, transaction_id], "tag": "custom:review"},
        )
        assert added["structuredContent"]["counts"]["changed"] == 1
        removed = await _call(
            client, headers, 5, "remove_tag_from_transactions",
            {"transaction_ids": [transaction_id], "tag": "custom:review", "dry_run": True},
        )
        assert removed["structuredContent"]["counts"]["changed"] == 1
        bucket = await _call(
            client, headers, 6, "set_bucket",
            {"transaction_ids": [transaction_id], "bucket": "bucket:groceries"},
        )
        assert bucket["structuredContent"]["counts"]["changed"] == 1
        repeated = await _call(
            client, headers, 7, "set_bucket",
            {"transaction_ids": [transaction_id], "bucket": "bucket:groceries", "dry_run": True},
        )
    assert repeated["structuredContent"]["counts"] == {"changed": 0, "unchanged": 1, "not_found": 0}


async def test_bulk_input_and_unknown_tag_errors(client, async_session, seed_tags, seed_transactions, mcp_running):
    raw = await _token(async_session, ["read", "write"])
    async with _mcp(client, raw, mcp_running) as headers:
        too_many = await _call(client, headers, 2, "add_tag_to_transactions", {"transaction_ids": list(range(1, 502)), "tag": "bucket:income"})
        missing_tag = await _call(client, headers, 3, "add_tag_to_transactions", {"transaction_ids": [seed_transactions[0].id], "tag": "custom:missing"})
    assert too_many["isError"] is True
    assert "500" in _content(too_many)
    assert missing_tag["isError"] is True
    assert "create_tag" in _content(missing_tag)


async def test_rules_and_dashboards_support_happy_paths_and_dry_runs(client, async_session, seed_tags, seed_transactions, mcp_running):
    raw = await _token(async_session, ["read", "write"])
    async with _mcp(client, raw, mcp_running) as headers:
        await _call(client, headers, 2, "create_tag", {"tag": "custom:coffee"})
        created_rule = await _call(client, headers, 3, "create_rule", {"name": "Coffee", "tag": "custom:coffee", "merchant_pattern": "Starbucks"})
        rule_id = created_rule["structuredContent"]["rule"]["id"]
        updated = await _call(client, headers, 3, "update_rule", {"rule_id": rule_id, "priority": 10})
        assert updated["structuredContent"]["counts"]["changed"] == 1
        applied_dry = await _call(client, headers, 4, "apply_rules", {"rule_id": rule_id, "dry_run": True})
        assert applied_dry["structuredContent"]["rules"][0]["matches"] >= 1
        applied = await _call(client, headers, 5, "apply_rules", {"rule_id": rule_id})
        assert applied["structuredContent"]["counts"]["changed"] >= 1
        dashboard = await _call(client, headers, 6, "create_dashboard", {"name": "MCP dashboard"})
        dashboard_id = dashboard["structuredContent"]["dashboard"]["id"]
        widget = await _call(client, headers, 7, "add_dashboard_widget", {"dashboard_id": dashboard_id, "widget_type": "summary", "width": "half"})
        assert widget["structuredContent"]["counts"]["changed"] == 1
        invalid = await _call(client, headers, 8, "add_dashboard_widget", {"dashboard_id": dashboard_id, "widget_type": "unknown"})
        deleted = await _call(client, headers, 9, "delete_rule", {"rule_id": rule_id})
    assert invalid["isError"] is True
    assert deleted["structuredContent"]["counts"]["changed"] == 1


async def test_global_apply_rules_preserves_existing_bucket_and_applies_to_uncategorized(client, async_session, seed_tags, seed_transactions, mcp_running):
    raw = await _token(async_session, ["read", "write"])
    categorized, uncategorized = seed_transactions[1], seed_transactions[2]
    uncategorized.merchant = categorized.merchant
    await async_session.commit()
    async with _mcp(client, raw, mcp_running) as headers:
        await _call(client, headers, 2, "set_bucket", {"transaction_ids": [uncategorized.id], "bucket": "bucket:none"})
        created = await _call(
            client, headers, 3, "create_rule",
            {"name": "Whole Foods dining", "tag": "bucket:dining", "merchant_pattern": categorized.merchant},
        )
        assert created["structuredContent"]["rule"]["id"]
        dry_run = await _call(client, headers, 4, "apply_rules", {"dry_run": True})
        assert dry_run["structuredContent"]["counts"]["changed"] == 1
        applied = await _call(client, headers, 5, "apply_rules", {})
        assert applied["structuredContent"]["counts"]["changed"] == 1
    buckets = dict(
        (await async_session.execute(
            select(TransactionTag.transaction_id, Tag.value)
            .join(Tag, TransactionTag.tag_id == Tag.id)
            .where(TransactionTag.transaction_id.in_([categorized.id, uncategorized.id]), Tag.namespace == "bucket")
        )).all()
    )
    assert buckets == {categorized.id: "groceries", uncategorized.id: "dining"}


async def test_every_registered_write_tool_preserves_transaction_rows(client, async_session, seed_tags, seed_transactions, mcp_running):
    raw = await _token(async_session, ["read", "write"])
    snapshot = [
        {column.name: getattr(transaction, column.name) for column in Transaction.__table__.columns}
        for transaction in (await async_session.execute(select(Transaction).order_by(Transaction.id))).scalars()
    ]
    invocations = {
        "create_tag": {"tag": "custom:immutable"},
        "add_tag_to_transactions": {"transaction_ids": [seed_transactions[0].id], "tag": "bucket:income"},
        "remove_tag_from_transactions": {"transaction_ids": [seed_transactions[0].id], "tag": "bucket:income"},
        "set_bucket": {"transaction_ids": [seed_transactions[0].id], "bucket": "bucket:groceries"},
        "create_rule": {"name": "immutable", "tag": "bucket:dining", "merchant_pattern": "Starbucks"},
        "update_rule": {"rule_id": 1, "name": "immutable updated"},
        "delete_rule": {"rule_id": 1},
        "apply_rules": {},
        "create_dashboard": {"name": "immutable"},
        "add_dashboard_widget": {"dashboard_id": 1, "widget_type": "summary"},
    }
    async with _mcp(client, raw, mcp_running) as headers:
        response = await client.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        registered = {tool["name"] for tool in response.json()["result"]["tools"]}
        registered_write_tools = registered & WRITE_TOOL_NAMES
        assert registered_write_tools == WRITE_TOOL_NAMES
        assert registered_write_tools == invocations.keys()
        for request_id, name in enumerate(sorted(registered_write_tools), start=3):
            await _call(client, headers, request_id, name, invocations[name])
    after = [
        {column.name: getattr(transaction, column.name) for column in Transaction.__table__.columns}
        for transaction in (await async_session.execute(select(Transaction).order_by(Transaction.id))).scalars()
    ]
    assert after == snapshot
