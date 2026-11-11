"""Shared Streamable HTTP MCP server instance.

The installed MCP SDK v2 renamed FastMCP to MCPServer. `MCP_ALLOWED_HOSTS` is a
comma-separated allowlist for reverse-proxy/tunnel Host headers.
"""

from mcp.server import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from app.config import settings
from app.mcp.auth import McpBearerAuthMiddleware

mcp_server = MCPServer("maxwells-wallet", title="Maxwell's Wallet")

# Register the read-only surface. Future tickets add one import each for
# tools_write and tools_classify here.
from app.mcp import tools_classify as _tools_classify  # noqa: E402, F401
from app.mcp import tools_read as _tools_read  # noqa: E402, F401
from app.mcp import tools_write as _tools_write  # noqa: E402, F401


def mcp_asgi_app():
    """Build the authenticated stateless JSON Streamable HTTP ASGI application."""
    transport_security = TransportSecuritySettings(
        allowed_hosts=settings.mcp_allowed_hosts_list,
    )
    app = mcp_server.streamable_http_app(
        streamable_http_path="/",
        json_response=True,
        stateless_http=True,
        transport_security=transport_security,
    )
    return McpBearerAuthMiddleware(app)
