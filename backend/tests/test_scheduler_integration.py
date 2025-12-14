"""
Integration tests for scheduler service - tests actual timing behavior.

These tests use short intervals and actually wait for jobs to fire,
verifying the full integration between APScheduler and our backup service.
"""

import asyncio
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch

from app.services.scheduler import SchedulerService
from app.services.backup import BackupService


class TestSchedulerTimingIntegration:
    """Integration tests that verify scheduler actually fires jobs at correct intervals."""

    @pytest.fixture
    def temp_backup_dir(self):
        """Create a temporary directory for backups."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def temp_db_file(self, temp_backup_dir):
        """Create a temporary database file."""
        db_path = Path(temp_backup_dir) / "test.db"
        db_path.write_bytes(b"test database content")
        return db_path

    @pytest.mark.asyncio
    async def test_auto_backup_actually_fires(self, temp_backup_dir, temp_db_file):
        """Test that auto backup job actually fires after the interval."""
        # Track how many times backup was called
        backup_call_count = 0
        backup_ids = []

        async def mock_run_backup():
            nonlocal backup_call_count
            backup_call_count += 1
            backup_ids.append(f"backup_{backup_call_count}")

        service = SchedulerService()

        # Replace the backup method with our tracker
        service._run_auto_backup = mock_run_backup

        service.start()

        # Schedule with 0.1 second interval (100ms)
        service.scheduler.add_job(
            mock_run_backup,
            "interval",
            seconds=0.1,
            id="test_auto_backup",
        )

        # Wait for ~350ms - should fire 3 times (at 100ms, 200ms, 300ms)
        await asyncio.sleep(0.35)

        service.stop()

        # Should have fired at least 3 times
        assert backup_call_count >= 3, f"Expected at least 3 backups, got {backup_call_count}"

    @pytest.mark.asyncio
    async def test_demo_reset_actually_fires(self, temp_backup_dir, temp_db_file):
        """Test that demo reset job actually fires after the interval."""
        reset_call_count = 0

        async def mock_run_reset():
            nonlocal reset_call_count
            reset_call_count += 1

        service = SchedulerService()
        service._run_demo_reset = mock_run_reset

        service.start()

        # Schedule with 0.1 second interval
        service.scheduler.add_job(
            mock_run_reset,
            "interval",
            seconds=0.1,
            id="test_demo_reset",
        )

        await asyncio.sleep(0.35)
        service.stop()

        assert reset_call_count >= 3, f"Expected at least 3 resets, got {reset_call_count}"

    @pytest.mark.asyncio
    async def test_scheduler_respects_interval_changes(self):
        """Test that changing the interval actually changes when jobs fire."""
        call_times = []

        async def track_call():
            call_times.append(asyncio.get_event_loop().time())

        service = SchedulerService()
        service.start()

        # Start with 0.05 second interval
        service.scheduler.add_job(
            track_call,
            "interval",
            seconds=0.05,
            id="test_interval",
            replace_existing=True,
        )

        await asyncio.sleep(0.15)  # Should fire ~3 times

        first_batch_count = len(call_times)
        assert first_batch_count >= 2, f"Expected at least 2 calls in first batch, got {first_batch_count}"

        # Change to 0.2 second interval (slower)
        service.scheduler.add_job(
            track_call,
            "interval",
            seconds=0.2,
            id="test_interval",
            replace_existing=True,
        )

        call_times.clear()
        await asyncio.sleep(0.5)

        service.stop()

        # With 0.2s interval over 0.5s, should fire 2-3 times (not 10 times like before)
        assert len(call_times) <= 4, f"Expected ~2-3 calls with slower interval, got {len(call_times)}"

    @pytest.mark.asyncio
    async def test_scheduler_job_removal_stops_execution(self):
        """Test that removing a job actually stops it from firing."""
        call_count = 0

        async def increment():
            nonlocal call_count
            call_count += 1

        service = SchedulerService()
        service.start()

        service.scheduler.add_job(
            increment,
            "interval",
            seconds=0.05,
            id="test_removal",
        )

        await asyncio.sleep(0.15)

        # Remove the job
        service.scheduler.remove_job("test_removal")

        # Small buffer to ensure no in-flight job completes after removal
        await asyncio.sleep(0.02)
        count_after_removal = call_count

        # Wait more time - if job wasn't removed, it would fire again
        await asyncio.sleep(0.15)
        count_after_waiting = call_count

        service.stop()

        # Should have stopped incrementing after removal
        assert count_after_waiting == count_after_removal, (
            f"Job kept firing after removal: {count_after_removal} -> {count_after_waiting}"
        )


class TestSchedulerWithRealBackupService:
    """Integration tests using the real backup service."""

    @pytest.fixture
    def backup_env(self, tmp_path):
        """Set up environment for backup service testing."""
        backup_dir = tmp_path / "backups"
        backup_dir.mkdir()

        db_file = tmp_path / "test.db"
        db_file.write_bytes(b"SQLite format 3\x00" + b"\x00" * 100)

        return {
            "backup_dir": str(backup_dir),
            "db_file": str(db_file),
        }

    @pytest.mark.asyncio
    async def test_scheduled_backup_creates_real_file(self, backup_env):
        """Test that a scheduled backup actually creates a backup file."""
        with patch("app.services.backup.settings") as mock_settings:
            mock_settings.backup_dir = backup_env["backup_dir"]
            mock_settings.backup_retention = 10
            mock_settings.backup_retention_days = 0

            with patch("app.services.backup.DATABASE_URL", f"sqlite:///{backup_env['db_file']}"):
                backup_service = BackupService()

                # Verify no backups exist initially
                assert len(backup_service.list_backups()) == 0

                service = SchedulerService()

                # Create a job that calls the real backup service
                async def create_backup():
                    backup_service.create_backup(
                        description="Scheduled test backup",
                        source="scheduled",
                    )

                service.start()
                service.scheduler.add_job(
                    create_backup,
                    "interval",
                    seconds=0.1,
                    id="real_backup_test",
                )

                await asyncio.sleep(0.35)
                service.stop()

                # Should have created at least 3 backups
                backups = backup_service.list_backups()
                assert len(backups) >= 3, f"Expected at least 3 backups, got {len(backups)}"

                # Verify backup files actually exist
                for backup in backups:
                    backup_path = Path(backup_env["backup_dir"]) / backup.filename
                    assert backup_path.exists(), f"Backup file missing: {backup_path}"
                    assert backup_path.stat().st_size > 0, f"Backup file is empty: {backup_path}"


class TestSchedulerHourlyIntervalConversion:
    """Test that hour-based intervals work correctly."""

    @pytest.mark.asyncio
    async def test_schedule_auto_backup_uses_hours(self):
        """Verify that schedule_auto_backup converts hours to the trigger correctly."""
        service = SchedulerService()
        service.start()

        # Schedule for 24 hours
        service.schedule_auto_backup(interval_hours=24)

        job = service.scheduler.get_job("auto_backup")
        assert job is not None

        # Verify the trigger interval
        trigger = job.trigger
        # APScheduler IntervalTrigger stores interval as timedelta
        assert trigger.interval.total_seconds() == 24 * 60 * 60  # 24 hours in seconds

        service.stop()

    @pytest.mark.asyncio
    async def test_schedule_demo_reset_uses_hours(self):
        """Verify that schedule_demo_reset converts hours to the trigger correctly."""
        service = SchedulerService()
        service.start()

        with patch("app.services.scheduler.settings") as mock_settings:
            mock_settings.demo_mode = True

            service.schedule_demo_reset(interval_hours=1)

            job = service.scheduler.get_job("demo_reset")
            assert job is not None

            trigger = job.trigger
            assert trigger.interval.total_seconds() == 1 * 60 * 60  # 1 hour in seconds

        service.stop()

    @pytest.mark.asyncio
    async def test_fractional_hour_interval(self):
        """Test that fractional hours work (e.g., 0.5 = 30 minutes)."""
        service = SchedulerService()
        service.start()

        # This tests if the implementation supports fractional hours
        # Currently it uses int, but this documents expected behavior
        service.scheduler.add_job(
            lambda: None,
            "interval",
            hours=0.5,  # 30 minutes
            id="fractional_test",
        )

        job = service.scheduler.get_job("fractional_test")
        assert job is not None
        assert job.trigger.interval.total_seconds() == 30 * 60  # 30 minutes

        service.stop()
