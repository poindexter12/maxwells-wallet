"""
Tests for settings API endpoints, particularly demo mode and backup schedule.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from httpx import AsyncClient

from app.services.scheduler import SchedulerSettings


class TestSettingsAPIDemoMode:
    """Tests for demo mode in GET /api/v1/settings endpoint."""

    @pytest.mark.asyncio
    async def test_settings_returns_demo_mode_false(self, client: AsyncClient):
        """Settings returns demo_mode=false when disabled."""
        with patch("app.routers.settings.app_config") as mock_settings:
            mock_settings.demo_mode = False

            response = await client.get("/api/v1/settings")

            assert response.status_code == 200
            data = response.json()
            assert data["demo_mode"] is False
            assert "demo_message" not in data

    @pytest.mark.asyncio
    async def test_settings_returns_demo_mode_true_with_message(self, client: AsyncClient):
        """Settings returns demo_mode=true with message when enabled."""
        with patch("app.routers.settings.app_config") as mock_settings:
            mock_settings.demo_mode = True

            response = await client.get("/api/v1/settings")

            assert response.status_code == 200
            data = response.json()
            assert data["demo_mode"] is True
            assert "demo_message" in data
            assert "demo" in data["demo_message"].lower()


class TestBackupScheduleSettingsGet:
    """Tests for GET /api/v1/settings/backup endpoint."""

    @pytest.mark.asyncio
    async def test_get_backup_schedule_defaults(self, client: AsyncClient):
        """Get backup schedule returns default settings."""
        mock_settings = SchedulerSettings()

        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.get_settings.return_value = mock_settings

            response = await client.get("/api/v1/settings/backup")

            assert response.status_code == 200
            data = response.json()
            assert data["auto_backup_enabled"] is False
            assert data["auto_backup_interval_hours"] == 24
            assert data["demo_reset_interval_hours"] == 1
            assert data["next_auto_backup"] is None
            assert data["next_demo_reset"] is None

    @pytest.mark.asyncio
    async def test_get_backup_schedule_with_next_run_times(self, client: AsyncClient):
        """Get backup schedule includes next run times."""
        next_backup = datetime(2024, 12, 16, 10, 0, 0, tzinfo=timezone.utc)
        next_reset = datetime(2024, 12, 15, 15, 0, 0, tzinfo=timezone.utc)

        mock_settings = SchedulerSettings(
            auto_backup_enabled=True,
            auto_backup_interval_hours=12,
            demo_reset_interval_hours=2,
            next_auto_backup=next_backup,
            next_demo_reset=next_reset,
        )

        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.get_settings.return_value = mock_settings

            response = await client.get("/api/v1/settings/backup")

            assert response.status_code == 200
            data = response.json()
            assert data["auto_backup_enabled"] is True
            assert data["auto_backup_interval_hours"] == 12
            assert data["next_auto_backup"] is not None
            assert data["next_demo_reset"] is not None


class TestBackupScheduleSettingsPut:
    """Tests for PUT /api/v1/settings/backup endpoint."""

    @pytest.mark.asyncio
    async def test_enable_auto_backup(self, client: AsyncClient):
        """Enable auto backup via PUT."""
        updated_settings = SchedulerSettings(auto_backup_enabled=True)

        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.update_settings.return_value = updated_settings

            response = await client.put(
                "/api/v1/settings/backup",
                json={"auto_backup_enabled": True},
            )

            assert response.status_code == 200
            mock_service.update_settings.assert_called_once_with(
                auto_backup_enabled=True,
                auto_backup_interval_hours=None,
                demo_reset_interval_hours=None,
                backup_retention_count=None,
            )

    @pytest.mark.asyncio
    async def test_disable_auto_backup(self, client: AsyncClient):
        """Disable auto backup via PUT."""
        updated_settings = SchedulerSettings(auto_backup_enabled=False)

        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.update_settings.return_value = updated_settings

            response = await client.put(
                "/api/v1/settings/backup",
                json={"auto_backup_enabled": False},
            )

            assert response.status_code == 200
            mock_service.update_settings.assert_called_once_with(
                auto_backup_enabled=False,
                auto_backup_interval_hours=None,
                demo_reset_interval_hours=None,
                backup_retention_count=None,
            )

    @pytest.mark.asyncio
    async def test_update_auto_backup_interval(self, client: AsyncClient):
        """Update auto backup interval via PUT."""
        updated_settings = SchedulerSettings(auto_backup_interval_hours=6)

        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.update_settings.return_value = updated_settings

            response = await client.put(
                "/api/v1/settings/backup",
                json={"auto_backup_interval_hours": 6},
            )

            assert response.status_code == 200
            mock_service.update_settings.assert_called_once_with(
                auto_backup_enabled=None,
                auto_backup_interval_hours=6,
                demo_reset_interval_hours=None,
                backup_retention_count=None,
            )

    @pytest.mark.asyncio
    async def test_update_demo_reset_interval(self, client: AsyncClient):
        """Update demo reset interval via PUT."""
        updated_settings = SchedulerSettings(demo_reset_interval_hours=4)

        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.update_settings.return_value = updated_settings

            response = await client.put(
                "/api/v1/settings/backup",
                json={"demo_reset_interval_hours": 4},
            )

            assert response.status_code == 200
            mock_service.update_settings.assert_called_once_with(
                auto_backup_enabled=None,
                auto_backup_interval_hours=None,
                demo_reset_interval_hours=4,
                backup_retention_count=None,
            )

    @pytest.mark.asyncio
    async def test_update_multiple_settings(self, client: AsyncClient):
        """Update multiple backup settings at once."""
        updated_settings = SchedulerSettings(
            auto_backup_enabled=True,
            auto_backup_interval_hours=12,
            demo_reset_interval_hours=2,
        )

        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.update_settings.return_value = updated_settings

            response = await client.put(
                "/api/v1/settings/backup",
                json={
                    "auto_backup_enabled": True,
                    "auto_backup_interval_hours": 12,
                    "demo_reset_interval_hours": 2,
                },
            )

            assert response.status_code == 200
            mock_service.update_settings.assert_called_once_with(
                auto_backup_enabled=True,
                auto_backup_interval_hours=12,
                demo_reset_interval_hours=2,
                backup_retention_count=None,
            )

    @pytest.mark.asyncio
    async def test_update_returns_new_settings(self, client: AsyncClient):
        """PUT returns the updated settings."""
        next_backup = datetime(2024, 12, 16, 10, 0, 0, tzinfo=timezone.utc)

        updated_settings = SchedulerSettings(
            auto_backup_enabled=True,
            auto_backup_interval_hours=6,
            demo_reset_interval_hours=1,
            next_auto_backup=next_backup,
        )

        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.update_settings.return_value = updated_settings

            response = await client.put(
                "/api/v1/settings/backup",
                json={"auto_backup_enabled": True, "auto_backup_interval_hours": 6},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["auto_backup_enabled"] is True
            assert data["auto_backup_interval_hours"] == 6
            assert data["next_auto_backup"] is not None


class TestBackupScheduleSettingsValidation:
    """Tests for input validation on backup schedule settings."""

    @pytest.mark.asyncio
    async def test_invalid_interval_type(self, client: AsyncClient):
        """Invalid interval type returns 422."""
        response = await client.put(
            "/api/v1/settings/backup",
            json={"auto_backup_interval_hours": "not_a_number"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_body(self, client: AsyncClient):
        """Empty body is valid (no-op update)."""
        with patch("app.routers.settings.scheduler_service") as mock_service:
            mock_service.update_settings.return_value = SchedulerSettings()

            response = await client.put(
                "/api/v1/settings/backup",
                json={},
            )

            assert response.status_code == 200
            mock_service.update_settings.assert_called_once_with(
                auto_backup_enabled=None,
                auto_backup_interval_hours=None,
                demo_reset_interval_hours=None,
                backup_retention_count=None,
            )


class TestSettingsAPIEffectiveLocale:
    """Tests for effective locale in settings response."""

    @pytest.mark.asyncio
    async def test_settings_returns_effective_locale(self, client: AsyncClient):
        """Settings returns effective_locale based on Accept-Language header."""
        with patch("app.routers.settings.app_config") as mock_settings:
            mock_settings.demo_mode = False

            response = await client.get(
                "/api/v1/settings",
                headers={"Accept-Language": "en-US,en;q=0.9"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "effective_locale" in data
            assert data["effective_locale"] == "en-US"

    @pytest.mark.asyncio
    async def test_settings_returns_default_locale_for_unsupported(self, client: AsyncClient):
        """Settings returns default locale for unsupported language."""
        with patch("app.routers.settings.app_config") as mock_settings:
            mock_settings.demo_mode = False

            response = await client.get(
                "/api/v1/settings",
                headers={"Accept-Language": "ja-JP,ja;q=0.9"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "effective_locale" in data
            # Should fall back to default
            assert data["effective_locale"] == "en-US"

    @pytest.mark.asyncio
    async def test_settings_handles_complex_accept_language(self, client: AsyncClient):
        """Settings handles complex Accept-Language headers."""
        with patch("app.routers.settings.app_config") as mock_settings:
            mock_settings.demo_mode = False

            response = await client.get(
                "/api/v1/settings",
                headers={"Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,en-US;q=0.7"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["effective_locale"] == "fr-FR"
