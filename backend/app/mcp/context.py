"""Request-local MCP identity and database access helpers."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextvars import ContextVar

from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.services.api_tokens import TokenPrincipal

_principal: ContextVar[TokenPrincipal | None] = ContextVar("mcp_principal", default=None)


def current_principal() -> TokenPrincipal:
    """Return the authenticated MCP token principal for this request."""
    principal = _principal.get()
    if principal is None:
        raise ToolError("MCP authentication is required.")
    return principal


def require_scope(scope: str) -> None:
    """Require an API-token scope before a tool performs work."""
    if scope not in current_principal().scopes:
        raise ToolError(f"This API token does not have the required '{scope}' scope.")


@asynccontextmanager
async def tool_session() -> AsyncIterator[AsyncSession]:
    """Yield the same session provider FastAPI tests override for the real app."""
    # Resolve lazily to avoid app.main -> mcp -> app.main import cycles at startup.
    from app.main import app

    provider = app.dependency_overrides.get(get_session, get_session)
    async for session in provider():
        yield session
        return
