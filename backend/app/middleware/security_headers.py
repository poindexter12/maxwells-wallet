"""
Security headers middleware for defense-in-depth.

Adds standard security headers to all responses. Uses setdefault()
so route-specific headers take precedence.
"""

from typing import Callable, cast

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Headers applied to every response (won't override existing values)
SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'self'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
    "Cache-Control": "no-store",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses without overriding route-specific values."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = cast(Response, await call_next(request))
        for header, value in SECURITY_HEADERS.items():
            # setdefault: only add if the header isn't already set by the route
            if header not in response.headers:
                response.headers[header] = value
        return response
