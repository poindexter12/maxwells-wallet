"""Tests for personal API token service and REST endpoints."""

from datetime import datetime, timedelta, timezone

import pytest

from app.orm import User
from app.services.api_tokens import authenticate_api_token, create_api_token
from app.utils.auth import hash_password, create_access_token


@pytest.fixture
async def user(async_session):
    account = User(username="token-user", password_hash=hash_password("password123"))
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)
    return account


@pytest.fixture
def user_headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.mark.asyncio
async def test_create_returns_raw_token_once_and_list_hides_secrets(client, user_headers):
    created = await client.post(
        "/api/v1/auth/tokens",
        headers=user_headers,
        json={"name": "MCP", "scopes": ["read", "write"], "expires_in_days": 30},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["token"].startswith("mw_pat_")
    assert len(body["token_prefix"]) == 16
    assert body["scopes"] == ["read", "write"]

    listed = await client.get("/api/v1/auth/tokens", headers=user_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["name"] == "MCP"
    assert "token" not in listed.json()[0]
    assert "token_hash" not in listed.json()[0]


@pytest.mark.asyncio
async def test_authenticate_accepts_active_token_and_rejects_invalid_states(async_session, user):
    token, raw = await create_api_token(
        async_session, user_id=user.id, name="active", scopes=["read"], expires_at=None
    )
    principal = await authenticate_api_token(async_session, raw)
    assert principal is not None
    assert principal.user_id == user.id
    assert principal.token_id == token.id
    assert principal.scopes == frozenset({"read"})
    assert await authenticate_api_token(async_session, "garbage") is None

    token.revoked_at = datetime.now(timezone.utc)
    await async_session.commit()
    assert await authenticate_api_token(async_session, raw) is None

    expired, expired_raw = await create_api_token(
        async_session,
        user_id=user.id,
        name="expired",
        scopes=["read"],
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    assert expired.id
    assert await authenticate_api_token(async_session, expired_raw) is None


@pytest.mark.asyncio
async def test_revoke_is_owned_and_idempotent(client, async_session, user, user_headers):
    token, _ = await create_api_token(
        async_session, user_id=user.id, name="owned", scopes=["read"], expires_at=None
    )
    first = await client.delete(f"/api/v1/auth/tokens/{token.id}", headers=user_headers)
    second = await client.delete(f"/api/v1/auth/tokens/{token.id}", headers=user_headers)
    assert first.status_code == 204
    assert second.status_code == 204

    other = User(username="other-user", password_hash=hash_password("password123"))
    async_session.add(other)
    await async_session.commit()
    other_token, _ = await create_api_token(
        async_session, user_id=other.id, name="other", scopes=["read"], expires_at=None
    )
    denied = await client.delete(f"/api/v1/auth/tokens/{other_token.id}", headers=user_headers)
    assert denied.status_code == 404


@pytest.mark.asyncio
async def test_token_scope_validation(client, user_headers):
    for scopes in ([], ["admin"]):
        response = await client.post(
            "/api/v1/auth/tokens", headers=user_headers, json={"name": "bad", "scopes": scopes}
        )
        assert response.status_code == 422


def test_stored_hash_is_keyed_by_the_app_secret(monkeypatch):
    from hashlib import sha256

    from app.config import settings
    from app.services.api_tokens import hash_token

    raw_token = "mw_pat_example"
    keyed = hash_token(raw_token)

    assert keyed == hash_token(raw_token)
    assert keyed != sha256(raw_token.encode()).hexdigest()

    monkeypatch.setattr(settings, "secret_key", "a-different-secret")
    assert hash_token(raw_token) != keyed


@pytest.mark.asyncio
async def test_token_stops_authenticating_when_the_app_secret_changes(async_session, user, monkeypatch):
    from app.config import settings

    _, raw_token = await create_api_token(
        async_session, user_id=user.id, name="rotation", scopes=["read"], expires_at=None
    )
    assert await authenticate_api_token(async_session, raw_token) is not None

    monkeypatch.setattr(settings, "secret_key", "rotated-secret")
    assert await authenticate_api_token(async_session, raw_token) is None
