"""Tests for the backup service."""

import gzip
import json
import os
import pytest
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.services.backup import BackupService, BackupMetadata, BackupManifest


@pytest.fixture
def temp_backup_dir():
    """Create a temporary directory for backup tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def temp_db_file():
    """Create a temporary database file for testing."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        # Write some test data to simulate a database
        f.write(b"SQLite test database content for backup testing")
        f.flush()
        yield f.name
    # Cleanup
    if os.path.exists(f.name):
        os.unlink(f.name)


@pytest.fixture
def backup_service(temp_backup_dir, temp_db_file):
    """Create a backup service with test configuration."""
    with patch('app.services.backup.settings') as mock_settings:
        mock_settings.backup_dir = temp_backup_dir
        mock_settings.backup_retention = 3
        mock_settings.backup_retention_days = 0

        service = BackupService()
        service._db_path = Path(temp_db_file)
        yield service


class TestBackupService:
    """Tests for BackupService class."""

    def test_create_backup(self, backup_service, temp_backup_dir):
        """Test creating a backup."""
        metadata = backup_service.create_backup(
            description="Test backup",
            source="manual"
        )

        assert metadata.description == "Test backup"
        assert metadata.source == "manual"
        assert metadata.is_demo_backup is False
        assert metadata.size_bytes > 0

        # Verify file was created
        backup_path = Path(temp_backup_dir) / metadata.filename
        assert backup_path.exists()

        # Verify it's gzipped
        with gzip.open(backup_path, 'rb') as f:
            content = f.read()
            assert b"SQLite test database content" in content

    def test_create_demo_backup(self, backup_service):
        """Test creating a demo backup."""
        metadata = backup_service.create_backup(
            description="Demo seed",
            source="demo_seed",
            is_demo_backup=True
        )

        assert metadata.is_demo_backup is True
        assert metadata.source == "demo_seed"

    def test_list_backups(self, backup_service):
        """Test listing backups."""
        # Create multiple backups
        backup_service.create_backup(description="Backup 1", source="manual")
        backup_service.create_backup(description="Backup 2", source="manual")

        backups = backup_service.list_backups()

        assert len(backups) == 2
        # Should be sorted newest first
        assert backups[0].description == "Backup 2"
        assert backups[1].description == "Backup 1"

    def test_get_backup(self, backup_service):
        """Test getting a specific backup by ID."""
        created = backup_service.create_backup(description="Test", source="manual")

        retrieved = backup_service.get_backup(created.id)

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.description == created.description

    def test_get_backup_not_found(self, backup_service):
        """Test getting a non-existent backup."""
        result = backup_service.get_backup("nonexistent")
        assert result is None

    def test_restore_backup(self, backup_service, temp_db_file):
        """Test restoring from a backup."""
        # Create backup
        metadata = backup_service.create_backup(description="To restore", source="manual")

        # Modify the database
        with open(temp_db_file, 'wb') as f:
            f.write(b"Modified database content")

        # Restore
        result = backup_service.restore_backup(metadata.id)

        assert result is True

        # Verify content was restored
        with open(temp_db_file, 'rb') as f:
            content = f.read()
            assert b"SQLite test database content" in content

    def test_restore_backup_not_found(self, backup_service):
        """Test restoring a non-existent backup."""
        with pytest.raises(ValueError, match="Backup not found"):
            backup_service.restore_backup("nonexistent")

    def test_delete_backup(self, backup_service, temp_backup_dir):
        """Test deleting a backup."""
        metadata = backup_service.create_backup(description="To delete", source="manual")
        backup_path = Path(temp_backup_dir) / metadata.filename

        assert backup_path.exists()

        result = backup_service.delete_backup(metadata.id)

        assert result is True
        assert not backup_path.exists()
        assert backup_service.get_backup(metadata.id) is None

    def test_delete_backup_not_found(self, backup_service):
        """Test deleting a non-existent backup."""
        with pytest.raises(ValueError, match="Backup not found"):
            backup_service.delete_backup("nonexistent")

    def test_cannot_delete_demo_backup(self, backup_service):
        """Test that demo backup cannot be deleted."""
        metadata = backup_service.create_backup(
            description="Demo",
            source="demo_seed",
            is_demo_backup=True
        )

        with pytest.raises(ValueError, match="Cannot delete demo backup"):
            backup_service.delete_backup(metadata.id)

    def test_retention_policy_count(self, backup_service):
        """Test that retention policy removes old backups."""
        # Create 5 backups (retention is 3)
        for i in range(5):
            backup_service.create_backup(description=f"Backup {i}", source="manual")

        backups = backup_service.list_backups()

        # Should only have 3 backups (retention limit)
        assert len(backups) == 3
        # Newest ones should be kept
        descriptions = [b.description for b in backups]
        assert "Backup 4" in descriptions
        assert "Backup 3" in descriptions
        assert "Backup 2" in descriptions

    def test_demo_backup_not_deleted_by_retention(self, backup_service):
        """Test that demo backup is preserved even when over retention limit."""
        # Create demo backup first
        demo = backup_service.create_backup(
            description="Demo",
            source="demo_seed",
            is_demo_backup=True
        )

        # Create more backups than retention allows
        for i in range(5):
            backup_service.create_backup(description=f"Backup {i}", source="manual")

        backups = backup_service.list_backups()

        # Should have 3 regular + 1 demo = 4 total
        assert len(backups) == 4

        # Demo should still be there
        demo_backup = backup_service.get_demo_backup()
        assert demo_backup is not None
        assert demo_backup.id == demo.id

    def test_set_demo_backup(self, backup_service):
        """Test setting a backup as the demo backup."""
        b1 = backup_service.create_backup(description="Backup 1", source="manual")
        b2 = backup_service.create_backup(description="Backup 2", source="manual")

        # Backup IDs include microseconds, so they should be unique
        assert b1.id != b2.id, "Backup IDs should be unique"

        # Set b1 as demo
        backup_service.set_demo_backup(b1.id)

        assert backup_service.get_backup(b1.id).is_demo_backup is True
        assert backup_service.get_backup(b2.id).is_demo_backup is False

        # Set b2 as demo - should unset b1
        backup_service.set_demo_backup(b2.id)

        assert backup_service.get_backup(b1.id).is_demo_backup is False
        assert backup_service.get_backup(b2.id).is_demo_backup is True

    def test_manifest_persistence(self, backup_service, temp_backup_dir):
        """Test that manifest is properly saved and loaded."""
        backup_service.create_backup(description="Persistent", source="manual")

        # Create a new service instance (simulating restart)
        with patch('app.services.backup.settings') as mock_settings:
            mock_settings.backup_dir = temp_backup_dir
            mock_settings.backup_retention = 10
            mock_settings.backup_retention_days = 0

            new_service = BackupService()

            backups = new_service.list_backups()
            assert len(backups) == 1
            assert backups[0].description == "Persistent"


class TestBackupMetadata:
    """Tests for BackupMetadata model."""

    def test_metadata_serialization(self):
        """Test that metadata can be serialized to JSON."""
        from datetime import datetime, timezone

        metadata = BackupMetadata(
            id="20241215_143022",
            filename="wallet_20241215_143022.db.gz",
            description="Test backup",
            created_at=datetime.now(timezone.utc),
            size_bytes=1024,
            is_demo_backup=False,
            source="manual",
            db_version="0.9.0"
        )

        # Should be serializable
        json_str = metadata.model_dump_json()
        assert "20241215_143022" in json_str
        assert "Test backup" in json_str


class TestBackupManifest:
    """Tests for BackupManifest model."""

    def test_empty_manifest(self):
        """Test creating an empty manifest."""
        manifest = BackupManifest()
        assert manifest.version == 1
        assert manifest.backups == []

    def test_manifest_with_backups(self):
        """Test manifest with backup entries."""
        backup = BackupMetadata(
            id="test",
            filename="test.db.gz",
            description="Test",
            created_at=datetime.now(timezone.utc),
            size_bytes=100,
            source="manual"
        )

        manifest = BackupManifest(backups=[backup])
        assert len(manifest.backups) == 1


class TestBackupServiceEdgeCases:
    """Edge case tests for BackupService."""

    def test_backup_dir_created_automatically(self, temp_db_file):
        """Test that backup directory is created if it doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            nonexistent_dir = os.path.join(tmpdir, "nested", "backup", "dir")

            with patch('app.services.backup.settings') as mock_settings:
                mock_settings.backup_dir = nonexistent_dir
                mock_settings.backup_retention = 10
                mock_settings.backup_retention_days = 0

                service = BackupService()
                service._db_path = Path(temp_db_file)

                metadata = service.create_backup(description="Test", source="manual")

                assert os.path.exists(nonexistent_dir)
                assert (Path(nonexistent_dir) / metadata.filename).exists()

    def test_backup_with_empty_description(self, backup_service):
        """Test backup with empty description gets auto-generated."""
        metadata = backup_service.create_backup(description="", source="manual")

        assert metadata.description != ""
        assert "Backup created at" in metadata.description

    def test_backup_sources(self, backup_service):
        """Test all backup source types."""
        sources = ["manual", "scheduled", "pre_import", "demo_seed"]

        for source in sources:
            metadata = backup_service.create_backup(
                description=f"Test {source}",
                source=source
            )
            assert metadata.source == source

    def test_cleanup_with_no_backups(self, backup_service):
        """Test cleanup does nothing with no backups."""
        deleted = backup_service.cleanup_old_backups()
        assert deleted == 0

    def test_cleanup_preserves_recent_backups(self, backup_service):
        """Test cleanup preserves backups within retention limit."""
        # Create exactly retention limit number of backups
        for i in range(3):  # retention is 3
            backup_service.create_backup(description=f"Backup {i}", source="manual")

        # Cleanup should delete nothing
        deleted = backup_service.cleanup_old_backups()
        assert deleted == 0
        assert len(backup_service.list_backups()) == 3

    def test_backup_file_compression(self, backup_service, temp_backup_dir, temp_db_file):
        """Test that backup files are properly compressed."""
        # Write more data to test compression
        with open(temp_db_file, 'wb') as f:
            f.write(b"A" * 10000)  # Highly compressible data

        metadata = backup_service.create_backup(description="Compression test", source="manual")

        # Compressed size should be much smaller than original
        assert metadata.size_bytes < 10000

        # Verify decompression works
        backup_path = Path(temp_backup_dir) / metadata.filename
        with gzip.open(backup_path, 'rb') as f:
            content = f.read()
            assert len(content) == 10000
            assert content == b"A" * 10000

    def test_restore_overwrites_database(self, backup_service, temp_db_file):
        """Test that restore completely overwrites database."""
        original_content = b"Original database content"
        with open(temp_db_file, 'wb') as f:
            f.write(original_content)

        # Create backup of original
        metadata = backup_service.create_backup(description="Original", source="manual")

        # Modify database significantly
        with open(temp_db_file, 'wb') as f:
            f.write(b"Completely different content that is much longer")

        # Restore should bring back original
        backup_service.restore_backup(metadata.id)

        with open(temp_db_file, 'rb') as f:
            restored_content = f.read()
            assert restored_content == original_content

    def test_multiple_demo_backups_only_one_active(self, backup_service):
        """Test that only one backup can be demo backup at a time."""
        b1 = backup_service.create_backup(description="B1", source="demo_seed", is_demo_backup=True)
        b2 = backup_service.create_backup(description="B2", source="demo_seed", is_demo_backup=True)

        # Only b2 should be demo backup (most recent with is_demo_backup=True)
        assert backup_service.get_backup(b1.id).is_demo_backup is False
        assert backup_service.get_backup(b2.id).is_demo_backup is True

    def test_get_demo_backup_returns_none_when_none_set(self, backup_service):
        """Test get_demo_backup returns None when no demo backup exists."""
        backup_service.create_backup(description="Regular", source="manual")

        demo = backup_service.get_demo_backup()
        assert demo is None

    def test_set_demo_backup_not_found(self, backup_service):
        """Test setting non-existent backup as demo."""
        with pytest.raises(ValueError, match="Backup not found"):
            backup_service.set_demo_backup("nonexistent_id")

    def test_db_version_captured(self, backup_service):
        """Test that database version is captured in backup metadata."""
        metadata = backup_service.create_backup(description="Version test", source="manual")

        # Should have a version (from package metadata)
        # Note: In tests, this might be None if package isn't installed
        # but the field should exist
        assert hasattr(metadata, 'db_version')

    def test_backup_id_format(self, backup_service):
        """Test backup ID format includes timestamp with microseconds."""
        metadata = backup_service.create_backup(description="ID test", source="manual")

        # ID should be in format YYYYMMDD_HHMMSS_ffffff
        parts = metadata.id.split('_')
        assert len(parts) == 3
        assert len(parts[0]) == 8  # YYYYMMDD
        assert len(parts[1]) == 6  # HHMMSS
        assert len(parts[2]) == 6  # ffffff (microseconds)

    def test_backup_filename_matches_id(self, backup_service):
        """Test that backup filename is derived from ID."""
        metadata = backup_service.create_backup(description="Filename test", source="manual")

        expected_filename = f"wallet_{metadata.id}.db.gz"
        assert metadata.filename == expected_filename

    def test_list_backups_sorted_newest_first(self, backup_service):
        """Test that list_backups returns backups sorted by date descending."""
        import time

        b1 = backup_service.create_backup(description="First", source="manual")
        time.sleep(0.01)  # Small delay to ensure different timestamps
        b2 = backup_service.create_backup(description="Second", source="manual")
        time.sleep(0.01)
        b3 = backup_service.create_backup(description="Third", source="manual")

        backups = backup_service.list_backups()

        assert backups[0].id == b3.id
        assert backups[1].id == b2.id
        assert backups[2].id == b1.id


class TestBackupServiceRetentionDays:
    """Tests for time-based retention policy."""

    def test_retention_days_deletes_old_backups(self, temp_backup_dir, temp_db_file):
        """Test that old backups are deleted based on retention days."""
        with patch('app.services.backup.settings') as mock_settings:
            mock_settings.backup_dir = temp_backup_dir
            mock_settings.backup_retention = 0  # Disable count-based retention
            mock_settings.backup_retention_days = 7

            service = BackupService()
            service._db_path = Path(temp_db_file)

            # Create a backup
            metadata = service.create_backup(description="Old backup", source="manual")

            # Manually modify the manifest to make backup appear old
            manifest = service._load_manifest()
            manifest.backups[0].created_at = datetime.now(timezone.utc) - timedelta(days=10)
            service._save_manifest(manifest)

            # Create new backup (triggers cleanup)
            service.create_backup(description="New backup", source="manual")

            # Old backup should be deleted
            backups = service.list_backups()
            assert len(backups) == 1
            assert backups[0].description == "New backup"

    def test_retention_days_preserves_recent(self, temp_backup_dir, temp_db_file):
        """Test that recent backups are preserved regardless of count."""
        with patch('app.services.backup.settings') as mock_settings:
            mock_settings.backup_dir = temp_backup_dir
            mock_settings.backup_retention = 0  # Disable count-based retention
            mock_settings.backup_retention_days = 30

            service = BackupService()
            service._db_path = Path(temp_db_file)

            # Create many backups (all recent)
            for i in range(10):
                service.create_backup(description=f"Backup {i}", source="manual")

            # All should be preserved (all are recent)
            backups = service.list_backups()
            assert len(backups) == 10


class TestBackupServiceInvalidDatabase:
    """Tests for handling invalid database scenarios."""

    def test_invalid_database_url(self, temp_backup_dir):
        """Test error when database URL is not SQLite."""
        with patch('app.services.backup.settings') as mock_settings:
            mock_settings.backup_dir = temp_backup_dir
            mock_settings.backup_retention = 10
            mock_settings.backup_retention_days = 0

            with patch('app.services.backup.DATABASE_URL', 'postgresql://localhost/db'):
                service = BackupService()

                with pytest.raises(ValueError, match="Backup only supports SQLite"):
                    _ = service.db_path

    def test_missing_database_file(self, temp_backup_dir):
        """Test error when database file doesn't exist."""
        with patch('app.services.backup.settings') as mock_settings:
            mock_settings.backup_dir = temp_backup_dir
            mock_settings.backup_retention = 10
            mock_settings.backup_retention_days = 0

            service = BackupService()
            service._db_path = Path("/nonexistent/path/to/db.sqlite")

            with pytest.raises(FileNotFoundError):
                service.create_backup(description="Test", source="manual")

    def test_restore_missing_backup_file(self, backup_service, temp_backup_dir):
        """Test error when backup file is missing but in manifest."""
        # Create backup
        metadata = backup_service.create_backup(description="Test", source="manual")

        # Delete the actual file but keep manifest entry
        backup_path = Path(temp_backup_dir) / metadata.filename
        backup_path.unlink()

        with pytest.raises(FileNotFoundError, match="Backup file not found"):
            backup_service.restore_backup(metadata.id)
