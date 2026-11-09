"""Contract tests for the authenticated Streamable HTTP MCP mount."""

import pytest

from app.orm import User
from app.services.api_tokens import create_api_token
from app.utils.auth import create_access_token, hash_password


READ_TOOL_NAMES = {
    "list_tags", "list_accounts", "search_transactions", "get_transaction", "spending_summary",
    "top_merchants", "list_rules", "preview_rule", "list_dashboards", "get_dashboard",
}


async def _token(async_session) -> str:
    user = User(username="mcp-user", password_hash=hash_password("password123"))
    async_session.add(user)
    await async_session.commit()
    _, raw = await create_api_token(async_session, user_id=user.id, name="MCP", scopes=["read"], expires_at=None)
    return raw


@pytest.mark.asyncio
async def test_mcp_rejects_missing_login_and_revoked_tokens(client, async_session):
    assert (await client.post("/mcp", json={})).status_code == 401

    user = User(username="jwt-user", password_hash=hash_password("password123"))
    async_session.add(user)
    await async_session.commit()
    jwt = create_access_token(user.id)
    assert (await client.post("/mcp", headers={"Authorization": f"Bearer {jwt}"}, json={})).status_code == 401

    token_row, revoked_raw = await create_api_token(
        async_session, user_id=user.id, name="revoked", scopes=["read"], expires_at=None
    )
    token_row.revoked_at = token_row.created_at
    await async_session.commit()
    assert (await client.post("/mcp", headers={"Authorization": f"Bearer {revoked_raw}"}, json={})).status_code == 401


@pytest.mark.asyncio
async def test_mcp_lists_tools_and_calls_read_tool(client, async_session, seed_tags, mcp_running):
    raw = await _token(async_session)
    headers = {"Authorization": f"Bearer {raw}", "Accept": "application/json, text/event-stream"}
    initialize = {
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "pytest", "version": "1"}},
    }
    async with mcp_running():
        assert (await client.post("/mcp", headers=headers, json=initialize)).status_code == 200
        listed = await client.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        assert listed.status_code == 200
        assert {tool["name"] for tool in listed.json()["result"]["tools"]} == READ_TOOL_NAMES
        called = await client.post(
            "/mcp", headers=headers,
            json={"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "list_tags", "arguments": {"limit": 999}}},
        )
    result = called.json()["result"]["structuredContent"]
    assert len(result["tags"]) == len(seed_tags)
