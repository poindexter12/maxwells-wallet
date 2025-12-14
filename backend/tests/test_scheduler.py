"""
Tests for scheduler service.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone

from app.services.scheduler import SchedulerService, SchedulerSettings


class TestSchedulerServiceInit:
    """Tests for scheduler service initialization."""

    def test_scheduler_service_init(self):
        """Scheduler service initializes with correct defaults."""
        service = SchedulerService()

        assert service._started is False
        assert service._settings.auto_backup_enabled is False
        assert service._settings.auto_backup_interval_hours == 24
        assert service._settings.demo_reset_interval_hours == 1
        assert service._settings.next_auto_backup is None
        assert service._settings.next_demo_reset is None


class TestSchedulerServiceStartStop:
    """Tests for scheduler service start/stop."""

    def test_scheduler_start(self):
        """Scheduler starts correctly."""
        service = SchedulerService()

        with patch.object(service.scheduler, "start") as mock_start:
            with patch("app.services.scheduler.settings") as mock_settings:
                mock_settings.demo_mode = False

                service.start()

                mock_start.assert_called_once()
                assert service._started is True

    def test_scheduler_start_idempotent(self):
        """Scheduler start is idempotent - multiple calls don't restart."""
        service = SchedulerService()

        with patch.object(service.scheduler, "start") as mock_start:
            with patch("app.services.scheduler.settings") as mock_settings:
                mock_settings.demo_mode = False

                service.start()
                service.start()  # Second call should be no-op

                mock_start.assert_called_once()

    def test_scheduler_stop(self):
        """Scheduler stops correctly."""
        service = SchedulerService()
        service._started = True

        with patch.object(service.scheduler, "shutdown") as mock_shutdown:
            service.stop()

            mock_shutdown.assert_called_once_with(wait=False)
            assert service._started is False

    def test_scheduler_stop_idempotent(self):
        """Scheduler stop is idempotent - multiple calls don't error."""
        service = SchedulerService()
        service._started = False

        with patch.object(service.scheduler, "shutdown") as mock_shutdown:
            service.stop()
            service.stop()  # Second call should be no-op

            mock_shutdown.assert_not_called()

    def test_scheduler_start_with_demo_mode(self):
        """Scheduler starts demo reset job when demo_mode is enabled."""
        service = SchedulerService()

        with patch.object(service.scheduler, "start"):
            with patch.object(service, "schedule_demo_reset") as mock_demo_reset:
                with patch("app.services.scheduler.settings") as mock_settings:
                    mock_settings.demo_mode = True

                    service.start()

                    mock_demo_reset.assert_called_once_with(1)  # default interval


class TestSchedulerServiceSettings:
    """Tests for scheduler service settings."""

    def test_get_settings_returns_defaults(self):
        """Get settings returns default values."""
        service = SchedulerService()

        with patch.object(service.scheduler, "get_job", return_value=None):
            settings = service.get_settings()

            assert settings.auto_backup_enabled is False
            assert settings.auto_backup_interval_hours == 24
            assert settings.demo_reset_interval_hours == 1

    def test_get_settings_includes_next_run_times(self):
        """Get settings includes next run times from jobs."""
        service = SchedulerService()
        next_run = datetime(2024, 12, 16, 10, 0, 0, tzinfo=timezone.utc)

        mock_job = MagicMock()
        mock_job.next_run_time = next_run

        with patch.object(service.scheduler, "get_job") as mock_get_job:
            mock_get_job.side_effect = lambda job_id: mock_job if job_id == "auto_backup" else None

            settings = service.get_settings()

            assert settings.next_auto_backup == next_run
            assert settings.next_demo_reset is None


class TestSchedulerServiceUpdateSettings:
    """Tests for updating scheduler settings."""

    def test_update_enable_auto_backup(self):
        """Enabling auto backup schedules the job."""
        service = SchedulerService()

        with patch.object(service, "schedule_auto_backup") as mock_schedule:
            with patch.object(service.scheduler, "get_job", return_value=None):
                service.update_settings(auto_backup_enabled=True)

                mock_schedule.assert_called_once_with(24)  # default interval
                assert service._settings.auto_backup_enabled is True

    def test_update_disable_auto_backup(self):
        """Disabling auto backup removes the job."""
        service = SchedulerService()
        service._settings.auto_backup_enabled = True

        with patch.object(service, "_remove_job") as mock_remove:
            with patch.object(service.scheduler, "get_job", return_value=None):
                service.update_settings(auto_backup_enabled=False)

                mock_remove.assert_called_once_with("auto_backup")
                assert service._settings.auto_backup_enabled is False

    def test_update_auto_backup_interval(self):
        """Updating interval reschedules the job when enabled."""
        service = SchedulerService()
        service._settings.auto_backup_enabled = True

        with patch.object(service, "schedule_auto_backup") as mock_schedule:
            with patch.object(service.scheduler, "get_job", return_value=None):
                service.update_settings(auto_backup_interval_hours=12)

                mock_schedule.assert_called_once_with(12)
                assert service._settings.auto_backup_interval_hours == 12

    def test_update_auto_backup_interval_when_disabled(self):
        """Updating interval when disabled doesn't schedule job."""
        service = SchedulerService()
        service._settings.auto_backup_enabled = False

        with patch.object(service, "schedule_auto_backup") as mock_schedule:
            with patch.object(service.scheduler, "get_job", return_value=None):
                service.update_settings(auto_backup_interval_hours=12)

                mock_schedule.assert_not_called()
                assert service._settings.auto_backup_interval_hours == 12

    def test_update_demo_reset_interval(self):
        """Updating demo reset interval reschedules when demo_mode is enabled."""
        service = SchedulerService()

        with patch.object(service, "schedule_demo_reset") as mock_schedule:
            with patch.object(service.scheduler, "get_job", return_value=None):
                with patch("app.services.scheduler.settings") as mock_settings:
                    mock_settings.demo_mode = True

                    service.update_settings(demo_reset_interval_hours=2)

                    mock_schedule.assert_called_once_with(2)
                    assert service._settings.demo_reset_interval_hours == 2

    def test_update_demo_reset_interval_when_demo_disabled(self):
        """Updating demo reset interval when demo_mode is disabled doesn't schedule."""
        service = SchedulerService()

        with patch.object(service, "schedule_demo_reset") as mock_schedule:
            with patch.object(service.scheduler, "get_job", return_value=None):
                with patch("app.services.scheduler.settings") as mock_settings:
                    mock_settings.demo_mode = False

                    service.update_settings(demo_reset_interval_hours=2)

                    mock_schedule.assert_not_called()


class TestSchedulerServiceScheduleJobs:
    """Tests for scheduling jobs."""

    def test_schedule_auto_backup(self):
        """Schedule auto backup adds job with correct trigger."""
        service = SchedulerService()

        with patch.object(service.scheduler, "add_job") as mock_add_job:
            service.schedule_auto_backup(interval_hours=6)

            mock_add_job.assert_called_once()
            call_kwargs = mock_add_job.call_args.kwargs
            assert call_kwargs["id"] == "auto_backup"
            assert call_kwargs["replace_existing"] is True

    def test_schedule_demo_reset_when_demo_mode_enabled(self):
        """Schedule demo reset adds job when demo_mode is enabled."""
        service = SchedulerService()

        with patch.object(service.scheduler, "add_job") as mock_add_job:
            with patch("app.services.scheduler.settings") as mock_settings:
                mock_settings.demo_mode = True

                service.schedule_demo_reset(interval_hours=2)

                mock_add_job.assert_called_once()
                call_kwargs = mock_add_job.call_args.kwargs
                assert call_kwargs["id"] == "demo_reset"
                assert call_kwargs["replace_existing"] is True

    def test_schedule_demo_reset_when_demo_mode_disabled(self):
        """Schedule demo reset does nothing when demo_mode is disabled."""
        service = SchedulerService()

        with patch.object(service.scheduler, "add_job") as mock_add_job:
            with patch("app.services.scheduler.settings") as mock_settings:
                mock_settings.demo_mode = False

                service.schedule_demo_reset(interval_hours=2)

                mock_add_job.assert_not_called()


class TestSchedulerServiceRemoveJob:
    """Tests for removing scheduled jobs."""

    def test_remove_existing_job(self):
        """Remove job succeeds for existing job."""
        service = SchedulerService()

        with patch.object(service.scheduler, "remove_job") as mock_remove:
            service._remove_job("auto_backup")

            mock_remove.assert_called_once_with("auto_backup")

    def test_remove_nonexistent_job(self):
        """Remove job doesn't raise for nonexistent job."""
        service = SchedulerService()

        with patch.object(service.scheduler, "remove_job") as mock_remove:
            mock_remove.side_effect = Exception("Job not found")

            # Should not raise
            service._remove_job("nonexistent")


class TestSchedulerServiceBackupExecution:
    """Tests for backup job execution."""

    @pytest.mark.asyncio
    async def test_run_auto_backup_success(self):
        """Auto backup job creates backup successfully."""
        service = SchedulerService()

        with patch("app.services.scheduler.backup_service") as mock_backup:
            mock_backup.create_backup.return_value = MagicMock(id="test_backup_id")

            await service._run_auto_backup()

            mock_backup.create_backup.assert_called_once_with(
                description="Scheduled automatic backup",
                source="scheduled",
            )

    @pytest.mark.asyncio
    async def test_run_auto_backup_failure(self):
        """Auto backup job handles errors gracefully."""
        service = SchedulerService()

        with patch("app.services.scheduler.backup_service") as mock_backup:
            mock_backup.create_backup.side_effect = Exception("Disk full")

            # Should not raise
            await service._run_auto_backup()


class TestSchedulerServiceDemoResetExecution:
    """Tests for demo reset job execution."""

    @pytest.mark.asyncio
    async def test_run_demo_reset_success(self):
        """Demo reset job restores from demo backup."""
        service = SchedulerService()

        with patch("app.services.scheduler.backup_service") as mock_backup:
            mock_demo_backup = MagicMock(id="demo_backup_id")
            mock_backup.get_demo_backup.return_value = mock_demo_backup
            mock_backup.restore_backup.return_value = True

            await service._run_demo_reset()

            mock_backup.get_demo_backup.assert_called_once()
            mock_backup.restore_backup.assert_called_once_with("demo_backup_id")

    @pytest.mark.asyncio
    async def test_run_demo_reset_no_demo_backup(self):
        """Demo reset job skips when no demo backup is configured."""
        service = SchedulerService()

        with patch("app.services.scheduler.backup_service") as mock_backup:
            mock_backup.get_demo_backup.return_value = None

            # Should not raise
            await service._run_demo_reset()

            mock_backup.restore_backup.assert_not_called()

    @pytest.mark.asyncio
    async def test_run_demo_reset_failure(self):
        """Demo reset job handles errors gracefully."""
        service = SchedulerService()

        with patch("app.services.scheduler.backup_service") as mock_backup:
            mock_backup.get_demo_backup.side_effect = Exception("Database error")

            # Should not raise
            await service._run_demo_reset()


class TestSchedulerServiceManualTriggers:
    """Tests for manual trigger methods."""

    def test_trigger_auto_backup(self):
        """Manual trigger adds immediate job."""
        service = SchedulerService()

        with patch.object(service.scheduler, "add_job") as mock_add_job:
            service.trigger_auto_backup()

            mock_add_job.assert_called_once()
            call_kwargs = mock_add_job.call_args.kwargs
            assert call_kwargs["id"] == "manual_auto_backup"
            assert call_kwargs["replace_existing"] is True

    def test_trigger_demo_reset_when_enabled(self):
        """Manual trigger demo reset when demo_mode is enabled."""
        service = SchedulerService()

        with patch.object(service.scheduler, "add_job") as mock_add_job:
            with patch("app.services.scheduler.settings") as mock_settings:
                mock_settings.demo_mode = True

                service.trigger_demo_reset()

                mock_add_job.assert_called_once()
                call_kwargs = mock_add_job.call_args.kwargs
                assert call_kwargs["id"] == "manual_demo_reset"

    def test_trigger_demo_reset_when_disabled(self):
        """Manual trigger demo reset raises when demo_mode is disabled."""
        service = SchedulerService()

        with patch("app.services.scheduler.settings") as mock_settings:
            mock_settings.demo_mode = False

            with pytest.raises(ValueError, match="Demo reset only available when DEMO_MODE"):
                service.trigger_demo_reset()


class TestSchedulerSettingsModel:
    """Tests for SchedulerSettings model."""

    def test_scheduler_settings_defaults(self):
        """SchedulerSettings has correct defaults."""
        settings = SchedulerSettings()

        assert settings.auto_backup_enabled is False
        assert settings.auto_backup_interval_hours == 24
        assert settings.demo_reset_interval_hours == 1
        assert settings.next_auto_backup is None
        assert settings.next_demo_reset is None

    def test_scheduler_settings_with_values(self):
        """SchedulerSettings accepts custom values."""
        next_backup = datetime(2024, 12, 16, 10, 0, 0, tzinfo=timezone.utc)

        settings = SchedulerSettings(
            auto_backup_enabled=True,
            auto_backup_interval_hours=12,
            demo_reset_interval_hours=4,
            next_auto_backup=next_backup,
        )

        assert settings.auto_backup_enabled is True
        assert settings.auto_backup_interval_hours == 12
        assert settings.demo_reset_interval_hours == 4
        assert settings.next_auto_backup == next_backup


class TestSchedulerServiceDateShift:
    """Tests for demo date shifting functionality."""

    @pytest.mark.asyncio
    async def test_shift_demo_dates_calls_update(self):
        """Date shift calculates offset and updates transactions."""
        from datetime import date, timedelta

        service = SchedulerService()

        # Mock the database session
        mock_session = AsyncMock()

        # First query returns max date (30 days ago)
        old_date = date.today() - timedelta(days=30)
        mock_max_result = MagicMock()
        mock_max_result.scalar.return_value = old_date.isoformat()

        # Track all execute calls
        execute_calls = []

        async def mock_execute(query, params=None):
            execute_calls.append((str(query), params))
            return mock_max_result

        mock_session.execute = mock_execute
        mock_session.commit = AsyncMock()

        mock_cm = MagicMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=None)

        with patch("app.database.async_session", return_value=mock_cm):
            await service._shift_demo_dates()

        # Should have called execute 3 times: MAX query, update transactions, update import_sessions
        assert len(execute_calls) == 3

        # Verify the offset is 30 days
        _, update_params = execute_calls[1]
        assert update_params["offset"] == 30

    @pytest.mark.asyncio
    async def test_shift_demo_dates_no_transactions(self):
        """Date shift handles empty database gracefully."""
        service = SchedulerService()

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = None
        mock_session.execute.return_value = mock_result

        mock_cm = MagicMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=None)

        with patch("app.database.async_session", return_value=mock_cm):
            # Should not raise
            await service._shift_demo_dates()

    @pytest.mark.asyncio
    async def test_shift_demo_dates_already_current(self):
        """Date shift skips when transactions are already current."""
        from datetime import date

        service = SchedulerService()

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = date.today().isoformat()
        mock_session.execute.return_value = mock_result

        mock_cm = MagicMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
        mock_cm.__aexit__ = AsyncMock(return_value=None)

        with patch("app.database.async_session", return_value=mock_cm):
            await service._shift_demo_dates()

            # Should only call execute once (for the MAX query), not for updates
            assert mock_session.execute.call_count == 1
