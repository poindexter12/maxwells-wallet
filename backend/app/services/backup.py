"""
SQLite backup service for creating, restoring, and managing database backups.

Backups are stored as gzip-compressed copies of the SQLite database file.
A manifest.json file tracks backup metadata.
"""

import gzip
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from app.config import settings
from app.database import DATABASE_URL


class BackupMetadata(BaseModel):
    """Metadata for a database backup."""

    id: str  # Timestamp-based: "20241215_143022"
    filename: str  # "wallet_hourly_20241215_143022.db.gz"
    description: str
    created_at: datetime
    size_bytes: int
    is_demo_backup: bool = False
    source: Literal["manual", "scheduled", "pre_import", "demo_seed"] = "manual"
    db_version: str | None = None
    tier: Literal["hourly", "daily", "weekly", "monthly"] = "hourly"


class BackupManifest(BaseModel):
    """Manifest file tracking all backups."""

    version: int = 1
    backups: list[BackupMetadata] = []


class BackupService:
    """Service for managing SQLite database backups."""

    def __init__(self):
        self.backup_dir = Path(settings.backup_dir)
        self.manifest_path = self.backup_dir / "manifest.json"
        self._db_path: Path | None = None

    @property
    def db_path(self) -> Path:
        """Get the SQLite database file path from DATABASE_URL."""
        if self._db_path is None:
            # Parse sqlite+aiosqlite:///./wallet.db or similar
            url = DATABASE_URL
            if url.startswith("sqlite"):
                # Extract path after sqlite+aiosqlite:/// or sqlite:///
                if ":///" in url:
                    path_part = url.split(":///", 1)[1]
                    self._db_path = Path(path_part).resolve()
                else:
                    raise ValueError(f"Invalid SQLite URL format: {url}")
            else:
                raise ValueError(f"Backup only supports SQLite, got: {url}")
        return self._db_path

    def _ensure_backup_dir(self) -> None:
        """Ensure the backup directory exists."""
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def _load_manifest(self) -> BackupManifest:
        """Load the backup manifest from disk."""
        if self.manifest_path.exists():
            with open(self.manifest_path) as f:
                data = json.load(f)
                return BackupManifest(**data)
        return BackupManifest()

    def _save_manifest(self, manifest: BackupManifest) -> None:
        """Save the backup manifest to disk."""
        self._ensure_backup_dir()
        with open(self.manifest_path, "w") as f:
            json.dump(manifest.model_dump(mode="json"), f, indent=2, default=str)

    def _get_app_version(self) -> str | None:
        """Get the current app version from pyproject.toml or package."""
        try:
            from importlib.metadata import version

            return version("maxwells-wallet-backend")
        except Exception:
            return None

    def _generate_backup_id(self) -> str:
        """Generate a timestamp-based backup ID with microseconds for uniqueness."""
        return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")

    def create_backup(
        self,
        description: str = "",
        source: Literal["manual", "scheduled", "pre_import", "demo_seed"] = "manual",
        is_demo_backup: bool = False,
        retention_count: int | None = None,
    ) -> BackupMetadata:
        """
        Create a new backup of the database.

        Args:
            description: Human-readable description of the backup
            source: What triggered this backup
            is_demo_backup: Whether this is the demo reset target
            retention_count: Number of backups to keep (passed to cleanup)

        Returns:
            BackupMetadata for the created backup
        """
        self._ensure_backup_dir()

        # Generate backup ID and filename (new backups start as "hourly")
        backup_id = self._generate_backup_id()
        filename = f"wallet_hourly_{backup_id}.db.gz"
        backup_path = self.backup_dir / filename

        # Copy and compress the database
        with open(self.db_path, "rb") as f_in:
            with gzip.open(backup_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

        # Create metadata (new backups start as "hourly" tier)
        metadata = BackupMetadata(
            id=backup_id,
            filename=filename,
            description=description or f"Backup created at {datetime.now(timezone.utc).isoformat()}",
            created_at=datetime.now(timezone.utc),
            size_bytes=backup_path.stat().st_size,
            is_demo_backup=is_demo_backup,
            source=source,
            db_version=self._get_app_version(),
            tier="hourly",
        )

        # Update manifest
        manifest = self._load_manifest()

        # If this is a demo backup, unmark any existing demo backup
        if is_demo_backup:
            for backup in manifest.backups:
                backup.is_demo_backup = False

        manifest.backups.append(metadata)
        self._save_manifest(manifest)

        # Run cleanup after creating backup
        self.cleanup_old_backups(retention_count=retention_count)

        return metadata

    def list_backups(self) -> list[BackupMetadata]:
        """List all available backups, sorted by creation date (newest first)."""
        manifest = self._load_manifest()
        return sorted(manifest.backups, key=lambda b: b.created_at, reverse=True)

    def get_backup(self, backup_id: str) -> BackupMetadata | None:
        """Get metadata for a specific backup."""
        manifest = self._load_manifest()
        for backup in manifest.backups:
            if backup.id == backup_id:
                return backup
        return None

    def restore_backup(self, backup_id: str) -> bool:
        """
        Restore the database from a backup.

        Args:
            backup_id: ID of the backup to restore

        Returns:
            True if restore was successful
        """
        backup = self.get_backup(backup_id)
        if backup is None:
            raise ValueError(f"Backup not found: {backup_id}")

        backup_path = self.backup_dir / backup.filename
        if not backup_path.exists():
            raise FileNotFoundError(f"Backup file not found: {backup_path}")

        # Decompress and replace the database
        with gzip.open(backup_path, "rb") as f_in:
            with open(self.db_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

        return True

    def delete_backup(self, backup_id: str) -> bool:
        """
        Delete a backup.

        Args:
            backup_id: ID of the backup to delete

        Returns:
            True if deletion was successful
        """
        backup = self.get_backup(backup_id)
        if backup is None:
            raise ValueError(f"Backup not found: {backup_id}")

        # Don't allow deleting demo backup
        if backup.is_demo_backup:
            raise ValueError("Cannot delete demo backup")

        # Delete the file
        backup_path = self.backup_dir / backup.filename
        if backup_path.exists():
            backup_path.unlink()

        # Update manifest
        manifest = self._load_manifest()
        manifest.backups = [b for b in manifest.backups if b.id != backup_id]
        self._save_manifest(manifest)

        return True

    def cleanup_old_backups(self, retention_count: int | None = None) -> int:
        """
        Remove old backups according to GFS (Grandfather-Father-Son) tiered retention.

        Retention tiers:
        - Keep all backups from the last 24 hours (hourly)
        - Keep one backup per day for the last 7 days (daily)
        - Keep one backup per week for the last 4 weeks (weekly)
        - Keep one backup per month for the last 12 months (monthly)

        Demo backups are never deleted.
        Files are renamed to reflect their tier (e.g., wallet_daily_...).

        Args:
            retention_count: Ignored (kept for API compatibility). GFS policy is always used.

        Returns:
            Number of backups deleted
        """
        from datetime import timedelta

        manifest = self._load_manifest()
        now = datetime.now(timezone.utc)

        # Separate demo backup from regular backups
        demo_backup = next((b for b in manifest.backups if b.is_demo_backup), None)
        regular_backups = [b for b in manifest.backups if not b.is_demo_backup]

        # Sort by creation date (newest first)
        regular_backups.sort(key=lambda b: b.created_at, reverse=True)

        # Track which backups to keep and their tier
        # Higher tier = more important (monthly > weekly > daily > hourly)
        backup_tiers: dict[str, Literal["hourly", "daily", "weekly", "monthly"]] = {}

        # Tier 1: Keep all backups from last 24 hours (hourly)
        cutoff_24h = now - timedelta(hours=24)
        for backup in regular_backups:
            if backup.created_at >= cutoff_24h:
                backup_tiers[backup.id] = "hourly"

        # Tier 2: Keep one backup per day for last 7 days (daily)
        for days_ago in range(1, 8):
            day_start = (now - timedelta(days=days_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)

            # Find the newest backup from that day
            for backup in regular_backups:
                if day_start <= backup.created_at < day_end:
                    # Upgrade tier if this is a higher tier
                    if backup.id not in backup_tiers or backup_tiers[backup.id] == "hourly":
                        backup_tiers[backup.id] = "daily"
                    break  # Keep only the newest from that day

        # Tier 3: Keep one backup per week for last 4 weeks (weekly)
        for weeks_ago in range(1, 5):
            # Start of the week (Monday)
            week_start = now - timedelta(weeks=weeks_ago)
            week_start = week_start - timedelta(days=week_start.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            week_end = week_start + timedelta(weeks=1)

            # Find the newest backup from that week
            for backup in regular_backups:
                if week_start <= backup.created_at < week_end:
                    # Upgrade tier if this is a higher tier
                    if backup.id not in backup_tiers or backup_tiers[backup.id] in ("hourly", "daily"):
                        backup_tiers[backup.id] = "weekly"
                    break

        # Tier 4: Keep one backup per month for last 12 months (monthly)
        for months_ago in range(1, 13):
            # Calculate month boundaries
            year = now.year
            month = now.month - months_ago
            while month <= 0:
                month += 12
                year -= 1

            month_start = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                month_end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

            # Find the newest backup from that month
            for backup in regular_backups:
                if month_start <= backup.created_at < month_end:
                    # Monthly is highest tier
                    backup_tiers[backup.id] = "monthly"
                    break

        # Process backups: delete those not kept, rename those with tier changes
        deleted_count = 0
        remaining_backups: list[BackupMetadata] = []

        for backup in regular_backups:
            if backup.id in backup_tiers:
                new_tier = backup_tiers[backup.id]

                # Rename file if tier changed
                if backup.tier != new_tier:
                    old_path = self.backup_dir / backup.filename
                    new_filename = f"wallet_{new_tier}_{backup.id}.db.gz"
                    new_path = self.backup_dir / new_filename

                    if old_path.exists():
                        old_path.rename(new_path)
                        backup.filename = new_filename
                    backup.tier = new_tier

                remaining_backups.append(backup)
            else:
                # Delete the file
                backup_path = self.backup_dir / backup.filename
                if backup_path.exists():
                    backup_path.unlink()
                deleted_count += 1

        # Rebuild manifest with remaining backups
        if demo_backup:
            remaining_backups.append(demo_backup)
        manifest.backups = remaining_backups
        self._save_manifest(manifest)

        return deleted_count

    def get_demo_backup(self) -> BackupMetadata | None:
        """Get the current demo backup, if any."""
        manifest = self._load_manifest()
        return next((b for b in manifest.backups if b.is_demo_backup), None)

    def set_demo_backup(self, backup_id: str) -> bool:
        """
        Mark a backup as the demo backup.

        Args:
            backup_id: ID of the backup to mark as demo

        Returns:
            True if successful
        """
        manifest = self._load_manifest()

        found = False
        for backup in manifest.backups:
            if backup.id == backup_id:
                backup.is_demo_backup = True
                found = True
            else:
                backup.is_demo_backup = False

        if not found:
            raise ValueError(f"Backup not found: {backup_id}")

        self._save_manifest(manifest)
        return True


# Singleton instance
backup_service = BackupService()
