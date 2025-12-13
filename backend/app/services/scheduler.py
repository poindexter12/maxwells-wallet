"""
Scheduler service for automated backup and demo reset operations.

Uses APScheduler with AsyncIOScheduler to run background tasks.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from pydantic import BaseModel

from app.config import settings
from app.services.backup import backup_service

logger = logging.getLogger(__name__)


class SchedulerSettings(BaseModel):
    """Configuration for scheduled backup jobs."""

    # These default to env var values from AppSettings
    auto_backup_enabled: bool = settings.auto_backup_enabled
    auto_backup_interval_hours: int = settings.auto_backup_interval_hours
    demo_reset_interval_hours: int = settings.demo_reset_interval_hours
    next_auto_backup: Optional[datetime] = None
    next_demo_reset: Optional[datetime] = None


class SchedulerService:
    """Service for managing scheduled backup and reset jobs."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._settings = SchedulerSettings()
        self._started = False

    def start(self) -> None:
        """Start the scheduler."""
        if not self._started:
            self.scheduler.start()
            self._started = True
            logger.info("Scheduler started")

            # If auto backup is enabled via env var, start the auto backup job
            if self._settings.auto_backup_enabled:
                self.schedule_auto_backup(self._settings.auto_backup_interval_hours)

            # If demo mode is enabled, start the demo reset job
            if settings.demo_mode:
                self.schedule_demo_reset(self._settings.demo_reset_interval_hours)

    def stop(self) -> None:
        """Stop the scheduler."""
        if self._started:
            self.scheduler.shutdown(wait=False)
            self._started = False
            logger.info("Scheduler stopped")

    def get_settings(self) -> SchedulerSettings:
        """Get current scheduler settings."""
        # Update next run times from scheduler
        auto_backup_job = self.scheduler.get_job("auto_backup")
        demo_reset_job = self.scheduler.get_job("demo_reset")

        self._settings.next_auto_backup = (
            auto_backup_job.next_run_time if auto_backup_job else None
        )
        self._settings.next_demo_reset = (
            demo_reset_job.next_run_time if demo_reset_job else None
        )

        return self._settings

    def update_settings(
        self,
        auto_backup_enabled: Optional[bool] = None,
        auto_backup_interval_hours: Optional[int] = None,
        demo_reset_interval_hours: Optional[int] = None,
    ) -> SchedulerSettings:
        """Update scheduler settings and reschedule jobs as needed."""
        if auto_backup_enabled is not None:
            self._settings.auto_backup_enabled = auto_backup_enabled
            if auto_backup_enabled:
                self.schedule_auto_backup(
                    auto_backup_interval_hours or self._settings.auto_backup_interval_hours
                )
            else:
                self._remove_job("auto_backup")

        if auto_backup_interval_hours is not None:
            self._settings.auto_backup_interval_hours = auto_backup_interval_hours
            if self._settings.auto_backup_enabled:
                self.schedule_auto_backup(auto_backup_interval_hours)

        if demo_reset_interval_hours is not None:
            self._settings.demo_reset_interval_hours = demo_reset_interval_hours
            if settings.demo_mode:
                self.schedule_demo_reset(demo_reset_interval_hours)

        return self.get_settings()

    def schedule_auto_backup(self, interval_hours: int) -> None:
        """Schedule automatic backups at the specified interval."""
        self.scheduler.add_job(
            self._run_auto_backup,
            IntervalTrigger(hours=interval_hours),
            id="auto_backup",
            replace_existing=True,
            name="Automatic database backup",
        )
        logger.info(f"Scheduled automatic backups every {interval_hours} hours")

    def schedule_demo_reset(self, interval_hours: int) -> None:
        """Schedule demo mode data resets at the specified interval."""
        if not settings.demo_mode:
            logger.warning("Demo reset scheduling skipped - DEMO_MODE is not enabled")
            return

        self.scheduler.add_job(
            self._run_demo_reset,
            IntervalTrigger(hours=interval_hours),
            id="demo_reset",
            replace_existing=True,
            name="Demo mode data reset",
        )
        logger.info(f"Scheduled demo resets every {interval_hours} hours")

    def _remove_job(self, job_id: str) -> None:
        """Remove a scheduled job if it exists."""
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"Removed scheduled job: {job_id}")
        except Exception:
            pass  # Job doesn't exist

    async def _run_auto_backup(self) -> None:
        """Execute an automatic backup."""
        try:
            logger.info("Running scheduled backup...")
            backup = backup_service.create_backup(
                description="Scheduled automatic backup",
                source="scheduled",
            )
            logger.info(f"Scheduled backup created: {backup.id}")
        except Exception as e:
            logger.error(f"Scheduled backup failed: {e}")

    async def _run_demo_reset(self) -> None:
        """Execute a demo mode data reset."""
        try:
            logger.info("Running demo reset...")
            demo_backup = backup_service.get_demo_backup()
            if demo_backup is None:
                logger.warning("No demo backup configured - skipping reset")
                return

            backup_service.restore_backup(demo_backup.id)
            logger.info(f"Demo reset completed - restored from backup {demo_backup.id}")
        except Exception as e:
            logger.error(f"Demo reset failed: {e}")

    def trigger_auto_backup(self) -> None:
        """Manually trigger an automatic backup (runs immediately)."""
        self.scheduler.add_job(
            self._run_auto_backup,
            id="manual_auto_backup",
            replace_existing=True,
        )

    def trigger_demo_reset(self) -> None:
        """Manually trigger a demo reset (runs immediately)."""
        if not settings.demo_mode:
            raise ValueError("Demo reset only available when DEMO_MODE is enabled")
        self.scheduler.add_job(
            self._run_demo_reset,
            id="manual_demo_reset",
            replace_existing=True,
        )


# Singleton instance
scheduler_service = SchedulerService()
