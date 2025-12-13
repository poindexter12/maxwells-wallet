"""
Tests for demo mode middleware.
"""
import pytest
import re
from unittest.mock import patch, MagicMock, AsyncMock
from starlette.requests import Request
from starlette.responses import Response

from app.middleware.demo_mode import DemoModeMiddleware, BLOCKED_ENDPOINTS


class TestBlockedEndpointsPatterns:
    """Tests to verify blocked endpoint patterns match correctly."""

    @pytest.mark.parametrize(
        "method,path,should_match",
        [
            # Import operations - should be blocked
            ("POST", "/api/v1/import/preview", True),
            ("POST", "/api/v1/import/confirm", True),
            ("POST", "/api/v1/import/batch", True),
            ("GET", "/api/v1/import/preview", False),  # GET not blocked

            # Admin destructive operations - should be blocked
            ("DELETE", "/api/v1/admin/purge-all", True),
            ("DELETE", "/api/v1/admin/import-sessions/123", True),
            ("DELETE", "/api/v1/admin/import-sessions/99999", True),
            ("GET", "/api/v1/admin/import-sessions/123", False),  # GET not blocked

            # Backup restore - should be blocked
            ("POST", "/api/v1/admin/restore/backup_123", True),
            ("POST", "/api/v1/admin/restore/20241215_143022_123456", True),
            ("GET", "/api/v1/admin/restore/backup_123", False),  # GET not blocked

            # Backup deletion - should be blocked
            ("DELETE", "/api/v1/admin/backup/backup_123", True),
            ("DELETE", "/api/v1/admin/backup/20241215_143022_123456", True),
            ("GET", "/api/v1/admin/backup/backup_123", False),  # GET not blocked
            ("POST", "/api/v1/admin/backup", False),  # POST create not blocked

            # Bulk transaction operations - should be blocked
            ("DELETE", "/api/v1/transactions", True),
            ("POST", "/api/v1/transactions/bulk-delete", True),
            ("GET", "/api/v1/transactions", False),  # GET not blocked
            ("POST", "/api/v1/transactions", False),  # Regular POST not blocked

            # Test endpoints - should be blocked
            ("POST", "/api/v1/test/seed", True),
            ("DELETE", "/api/v1/test/clear", True),

            # Safe endpoints - should NOT be blocked
            ("GET", "/api/v1/admin/backups", False),
            ("POST", "/api/v1/admin/backup", False),
            ("GET", "/api/v1/settings", False),
            ("PATCH", "/api/v1/settings", False),
            ("GET", "/api/v1/transactions", False),
            ("GET", "/api/v1/transactions/123", False),
            ("POST", "/api/v1/admin/backup/123/set-demo", False),  # Set demo allowed
        ],
    )
    def test_blocked_endpoint_pattern_matching(self, method, path, should_match):
        """Verify that blocked endpoint patterns match correctly."""
        matched = False
        for blocked_method, blocked_pattern in BLOCKED_ENDPOINTS:
            if method == blocked_method and re.match(blocked_pattern, path):
                matched = True
                break

        assert matched == should_match, (
            f"Expected {method} {path} to {'match' if should_match else 'not match'} "
            f"blocked patterns, but got {'match' if matched else 'no match'}"
        )


class TestDemoModeMiddlewareDisabled:
    """Tests for middleware when demo mode is disabled."""

    @pytest.mark.asyncio
    async def test_middleware_passes_through_when_disabled(self):
        """Middleware passes all requests through when demo_mode=False."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.url.path = "/api/v1/import/confirm"

        mock_response = MagicMock(spec=Response)
        mock_call_next = AsyncMock(return_value=mock_response)

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = False

            response = await middleware.dispatch(mock_request, mock_call_next)

            # Should call next middleware without blocking
            mock_call_next.assert_called_once_with(mock_request)
            assert response == mock_response


class TestDemoModeMiddlewareEnabled:
    """Tests for middleware when demo mode is enabled."""

    @pytest.mark.asyncio
    async def test_middleware_blocks_import_endpoint(self):
        """Middleware blocks import endpoints when demo_mode=True."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.url.path = "/api/v1/import/confirm"

        mock_call_next = AsyncMock()

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            # Should NOT call next middleware
            mock_call_next.assert_not_called()

            # Should return 403 JSON response
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_middleware_blocks_purge_all(self):
        """Middleware blocks purge-all endpoint when demo_mode=True."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "DELETE"
        mock_request.url.path = "/api/v1/admin/purge-all"

        mock_call_next = AsyncMock()

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            mock_call_next.assert_not_called()
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_middleware_blocks_backup_restore(self):
        """Middleware blocks backup restore endpoint when demo_mode=True."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.url.path = "/api/v1/admin/restore/20241215_143022"

        mock_call_next = AsyncMock()

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            mock_call_next.assert_not_called()
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_middleware_blocks_backup_delete(self):
        """Middleware blocks backup delete endpoint when demo_mode=True."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "DELETE"
        mock_request.url.path = "/api/v1/admin/backup/20241215_143022"

        mock_call_next = AsyncMock()

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            mock_call_next.assert_not_called()
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_middleware_allows_safe_endpoints(self):
        """Middleware allows safe endpoints when demo_mode=True."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/api/v1/transactions"

        mock_response = MagicMock(spec=Response)
        mock_call_next = AsyncMock(return_value=mock_response)

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            # Should call next middleware
            mock_call_next.assert_called_once_with(mock_request)
            assert response == mock_response

    @pytest.mark.asyncio
    async def test_middleware_allows_backup_create(self):
        """Middleware allows backup creation when demo_mode=True."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.url.path = "/api/v1/admin/backup"

        mock_response = MagicMock(spec=Response)
        mock_call_next = AsyncMock(return_value=mock_response)

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            mock_call_next.assert_called_once_with(mock_request)
            assert response == mock_response

    @pytest.mark.asyncio
    async def test_middleware_allows_backup_list(self):
        """Middleware allows listing backups when demo_mode=True."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/api/v1/admin/backups"

        mock_response = MagicMock(spec=Response)
        mock_call_next = AsyncMock(return_value=mock_response)

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            mock_call_next.assert_called_once_with(mock_request)
            assert response == mock_response

    @pytest.mark.asyncio
    async def test_middleware_allows_set_demo_backup(self):
        """Middleware allows setting demo backup when demo_mode=True."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.url.path = "/api/v1/admin/backup/123/set-demo"

        mock_response = MagicMock(spec=Response)
        mock_call_next = AsyncMock(return_value=mock_response)

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            mock_call_next.assert_called_once_with(mock_request)
            assert response == mock_response


class TestDemoModeMiddlewareResponseContent:
    """Tests for the response content when requests are blocked."""

    @pytest.mark.asyncio
    async def test_blocked_response_contains_error_details(self):
        """Blocked response contains proper error information."""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.url.path = "/api/v1/import/confirm"

        mock_call_next = AsyncMock()

        middleware = DemoModeMiddleware(app=MagicMock())

        with patch("app.middleware.demo_mode.settings") as mock_settings:
            mock_settings.demo_mode = True

            response = await middleware.dispatch(mock_request, mock_call_next)

            # Parse response body
            import json
            body = json.loads(response.body.decode())

            assert body["error_code"] == "DEMO_MODE_RESTRICTED"
            assert "demo mode" in body["message"].lower()
            assert body["context"]["blocked_endpoint"] == "/api/v1/import/confirm"
            assert body["context"]["blocked_method"] == "POST"
