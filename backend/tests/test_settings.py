"""Tests for the settings router."""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models import AppSettings, LanguagePreference
from app.database import get_session


@pytest.fixture
async def client():
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


class TestSettingsEndpoints:
    """Test settings API endpoints."""

    @pytest.mark.asyncio
    async def test_get_settings_creates_default(self, client: AsyncClient):
        """GET /settings creates default settings if none exist."""
        response = await client.get("/api/v1/settings")
        assert response.status_code == 200

        data = response.json()
        assert data["language"] == "browser"
        assert data["effective_locale"] in [
            "en-US", "en-GB", "es", "fr", "it", "pt", "de", "nl", "l33t"
        ]
        assert "supported_locales" in data

    @pytest.mark.asyncio
    async def test_get_settings_supported_locales(self, client: AsyncClient):
        """GET /settings returns list of supported locales."""
        response = await client.get("/api/v1/settings")
        assert response.status_code == 200

        data = response.json()
        assert set(data["supported_locales"]) == {
            "en-US", "en-GB", "es", "fr", "it", "pt", "de", "nl", "l33t"
        }

    @pytest.mark.asyncio
    async def test_update_language_preference(self, client: AsyncClient):
        """PATCH /settings updates language preference."""
        # Set to French
        response = await client.patch(
            "/api/v1/settings",
            json={"language": "fr"}
        )
        assert response.status_code == 200
        assert response.json()["language"] == "fr"

        # Verify it persisted
        response = await client.get("/api/v1/settings")
        assert response.status_code == 200
        assert response.json()["language"] == "fr"
        assert response.json()["effective_locale"] == "fr"

    @pytest.mark.asyncio
    async def test_update_language_to_browser(self, client: AsyncClient):
        """PATCH /settings can set language back to browser detection."""
        # First set to a specific language
        await client.patch("/api/v1/settings", json={"language": "de"})

        # Then reset to browser
        response = await client.patch(
            "/api/v1/settings",
            json={"language": "browser"}
        )
        assert response.status_code == 200
        assert response.json()["language"] == "browser"

    @pytest.mark.asyncio
    async def test_update_language_l33t(self, client: AsyncClient):
        """PATCH /settings can set l33t locale for QA testing."""
        response = await client.patch(
            "/api/v1/settings",
            json={"language": "l33t"}
        )
        assert response.status_code == 200
        assert response.json()["language"] == "l33t"

        # Verify effective locale is l33t
        response = await client.get("/api/v1/settings")
        assert response.json()["effective_locale"] == "l33t"

    @pytest.mark.asyncio
    async def test_accept_language_header_parsing(self, client: AsyncClient):
        """GET /settings respects Accept-Language header when language is 'browser'."""
        # Reset to browser mode first
        await client.patch("/api/v1/settings", json={"language": "browser"})

        # Test with German Accept-Language header
        response = await client.get(
            "/api/v1/settings",
            headers={"Accept-Language": "de-DE,de;q=0.9,en;q=0.8"}
        )
        assert response.status_code == 200
        assert response.json()["effective_locale"] == "de"

    @pytest.mark.asyncio
    async def test_accept_language_fallback(self, client: AsyncClient):
        """GET /settings falls back to en-US for unsupported languages."""
        # Reset to browser mode
        await client.patch("/api/v1/settings", json={"language": "browser"})

        # Test with unsupported language
        response = await client.get(
            "/api/v1/settings",
            headers={"Accept-Language": "zh-CN,zh;q=0.9"}
        )
        assert response.status_code == 200
        assert response.json()["effective_locale"] == "en-US"


class TestAcceptLanguageParsing:
    """Test Accept-Language header parsing logic."""

    def test_parse_simple_locale(self):
        """Parse simple locale like 'en-US'."""
        from app.routers.settings import parse_accept_language
        assert parse_accept_language("en-US") == "en-US"

    def test_parse_language_only(self):
        """Parse language-only like 'de' matches 'de'."""
        from app.routers.settings import parse_accept_language
        assert parse_accept_language("de") == "de"

    def test_parse_with_quality(self):
        """Parse header with quality values."""
        from app.routers.settings import parse_accept_language
        result = parse_accept_language("fr-FR,fr;q=0.9,en;q=0.8")
        assert result == "fr"

    def test_parse_prioritizes_quality(self):
        """Parse prioritizes higher quality values."""
        from app.routers.settings import parse_accept_language
        # Spanish has higher quality than German
        result = parse_accept_language("de;q=0.5,es;q=0.9")
        assert result == "es"

    def test_parse_empty_fallback(self):
        """Empty header falls back to en-US."""
        from app.routers.settings import parse_accept_language
        assert parse_accept_language("") == "en-US"

    def test_parse_unsupported_fallback(self):
        """Unsupported language falls back to en-US."""
        from app.routers.settings import parse_accept_language
        assert parse_accept_language("zh-CN") == "en-US"
