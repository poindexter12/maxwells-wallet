"""
Demo mode middleware to restrict certain operations.

When DEMO_MODE is enabled, this middleware blocks:
- File uploads/imports
- Database purge operations
- Non-demo backup restores
- Bulk delete operations
"""

import re
from typing import TYPE_CHECKING, Callable, cast

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings

if TYPE_CHECKING:
    from fastapi import FastAPI


# Endpoints blocked in demo mode
# Format: (method, path_pattern)
BLOCKED_ENDPOINTS = [
    # Import file uploads (blocks user financial data from being uploaded)
    # These endpoints accept file uploads which could contain personal data
    ("POST", r"^/api/v1/import/preview$"),
    ("POST", r"^/api/v1/import/confirm$"),
    ("POST", r"^/api/v1/import/batch/upload$"),
    ("POST", r"^/api/v1/import/batch/confirm$"),
    ("POST", r"^/api/v1/import/analyze$"),
    ("POST", r"^/api/v1/import/custom/auto-detect$"),
    ("POST", r"^/api/v1/import/custom/preview$"),
    ("POST", r"^/api/v1/import/custom/confirm$"),
    # Note: /import/custom/configs and /import/custom/configs/import are ALLOWED
    # because they only contain format configuration, not personal financial data
    # Admin destructive operations
    ("DELETE", r"^/api/v1/admin/purge-all$"),
    ("DELETE", r"^/api/v1/admin/import-sessions/\d+$"),
    # Backup restore (we'll allow demo restore separately)
    ("POST", r"^/api/v1/admin/restore/.*"),
    # Backup deletion
    ("DELETE", r"^/api/v1/admin/backup/.*"),
    # Bulk transaction operations
    ("DELETE", r"^/api/v1/transactions$"),  # Bulk delete
    ("POST", r"^/api/v1/transactions/bulk-delete$"),
    # Test endpoints (seeding, clearing)
    ("POST", r"^/api/v1/test/seed$"),
    ("DELETE", r"^/api/v1/test/clear$"),
]


class DemoModeMiddleware(BaseHTTPMiddleware):
    """Middleware to block restricted operations in demo mode."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Check if the request is blocked in demo mode.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/handler in chain

        Returns:
            HTTP response (403 if blocked, otherwise normal response)
        """
        # Skip if demo mode is not enabled
        if not settings.demo_mode:
            return cast(Response, await call_next(request))

        # Check if this endpoint is blocked
        method = request.method
        path = request.url.path

        for blocked_method, blocked_pattern in BLOCKED_ENDPOINTS:
            if method == blocked_method and re.match(blocked_pattern, path):
                return JSONResponse(
                    status_code=403,
                    content={
                        "error_code": "DEMO_MODE_RESTRICTED",
                        "message": "This feature is disabled in demo mode.",
                        "context": {
                            "blocked_endpoint": path,
                            "blocked_method": method,
                        },
                    },
                )

        return cast(Response, await call_next(request))


def add_demo_mode_middleware(app: "FastAPI") -> None:
    """
    Add demo mode middleware to FastAPI app.

    Args:
        app: FastAPI application instance
    """
    if settings.demo_mode:
        app.add_middleware(DemoModeMiddleware)
