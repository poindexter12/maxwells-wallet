"""Bearer-token authentication middleware for the MCP ASGI mount."""

from __future__ import annotations

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.mcp.context import _principal, tool_session
from app.services.api_tokens import TOKEN_PREFIX, authenticate_api_token


class McpBearerAuthMiddleware:
    """Accept only personal API-token bearer credentials for MCP requests."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        authorization = dict(scope.get("headers", [])).get(b"authorization", b"").decode("latin-1")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.startswith(TOKEN_PREFIX):
            await self._unauthorized(scope, receive, send)
            return

        async with tool_session() as session:
            principal = await authenticate_api_token(session, token)
        if principal is None:
            await self._unauthorized(scope, receive, send)
            return

        principal_token = _principal.set(principal)
        try:
            await self.app(scope, receive, send)
        finally:
            _principal.reset(principal_token)

    @staticmethod
    async def _unauthorized(scope: Scope, receive: Receive, send: Send) -> None:
        response = JSONResponse(
            {"detail": "A valid personal API token is required for MCP."},
            status_code=401,
            headers={"WWW-Authenticate": "Bearer"},
        )
        await response(scope, receive, send)
