"""
Tests for backup-related API endpoints in admin router.
"""

import pytest
from unittest.mock import patch
from datetime import datetime, timezone
from httpx import AsyncClient

from app.services.backup import BackupMetadata


class TestBackupAPIList:
    """Tests for GET /api/v1/admin/backups endpoint."""

    @pytest.mark.asyncio
    async def test_list_backups_empty(self, client: AsyncClient):
        """List backups returns empty list when no backups exist."""
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.list_backups.return_value = []

            response = await client.get("/api/v1/admin/backups")

            assert response.status_code == 200
            assert response.json() == []
            mock_service.list_backups.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_backups_with_data(self, client: AsyncClient):
        """List backups returns available backups."""
        mock_backups = [
            BackupMetadata(
                id="20241215_143022_123456",
                filename="wallet_20241215_143022_123456.db.gz",
                description="Test backup 1",
                created_at=datetime(2024, 12, 15, 14, 30, 22, tzinfo=timezone.utc),
                size_bytes=1024,
                is_demo_backup=False,
                source="manual",
            ),
            BackupMetadata(
                id="20241214_120000_654321",
                filename="wallet_20241214_120000_654321.db.gz",
                description="Test backup 2",
                created_at=datetime(2024, 12, 14, 12, 0, 0, tzinfo=timezone.utc),
                size_bytes=2048,
                is_demo_backup=True,
                source="demo_seed",
            ),
        ]
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.list_backups.return_value = mock_backups

            response = await client.get("/api/v1/admin/backups")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["id"] == "20241215_143022_123456"
            assert data[1]["is_demo_backup"] is True


class TestBackupAPICreate:
    """Tests for POST /api/v1/admin/backup endpoint."""

    @pytest.mark.asyncio
    async def test_create_backup_default(self, client: AsyncClient):
        """Create backup with default parameters."""
        mock_backup = BackupMetadata(
            id="20241215_150000_111111",
            filename="wallet_20241215_150000_111111.db.gz",
            description="Manual backup",
            created_at=datetime.now(timezone.utc),
            size_bytes=512,
            is_demo_backup=False,
            source="manual",
        )
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.create_backup.return_value = mock_backup

            response = await client.post("/api/v1/admin/backup")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "20241215_150000_111111"
            mock_service.create_backup.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_backup_with_description(self, client: AsyncClient):
        """Create backup with custom description."""
        mock_backup = BackupMetadata(
            id="20241215_150000_222222",
            filename="wallet_20241215_150000_222222.db.gz",
            description="Pre-deployment backup",
            created_at=datetime.now(timezone.utc),
            size_bytes=512,
            is_demo_backup=False,
            source="manual",
        )
        with patch("app.routers.admin.backup_service") as mock_backup_svc:
            mock_backup_svc.create_backup.return_value = mock_backup

            response = await client.post(
                "/api/v1/admin/backup",
                json={"description": "Pre-deployment backup"},
            )

            assert response.status_code == 200
            mock_backup_svc.create_backup.assert_called_once_with(
                description="Pre-deployment backup",
                source="manual",
                is_demo_backup=False,
            )

    @pytest.mark.asyncio
    async def test_create_backup_as_demo(self, client: AsyncClient):
        """Create backup marked as demo backup."""
        mock_backup = BackupMetadata(
            id="20241215_150000_333333",
            filename="wallet_20241215_150000_333333.db.gz",
            description="Demo seed backup",
            created_at=datetime.now(timezone.utc),
            size_bytes=512,
            is_demo_backup=True,
            source="demo_seed",
        )
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.create_backup.return_value = mock_backup

            response = await client.post(
                "/api/v1/admin/backup",
                json={
                    "description": "Demo seed backup",
                    "source": "demo_seed",
                    "is_demo_backup": True,
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["is_demo_backup"] is True
            assert data["source"] == "demo_seed"


class TestBackupAPIGet:
    """Tests for GET /api/v1/admin/backup/{backup_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_backup_existing(self, client: AsyncClient):
        """Get existing backup by ID."""
        mock_backup = BackupMetadata(
            id="20241215_143022_123456",
            filename="wallet_20241215_143022_123456.db.gz",
            description="Test backup",
            created_at=datetime(2024, 12, 15, 14, 30, 22, tzinfo=timezone.utc),
            size_bytes=1024,
            is_demo_backup=False,
            source="manual",
        )
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = mock_backup

            response = await client.get("/api/v1/admin/backup/20241215_143022_123456")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "20241215_143022_123456"

    @pytest.mark.asyncio
    async def test_get_backup_not_found(self, client: AsyncClient):
        """Get nonexistent backup returns 404."""
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = None

            response = await client.get("/api/v1/admin/backup/nonexistent_id")

            assert response.status_code == 404
            data = response.json()
            assert data["detail"]["error_code"] == "BACKUP_NOT_FOUND"


class TestBackupAPIRestore:
    """Tests for POST /api/v1/admin/restore/{backup_id} endpoint."""

    @pytest.mark.asyncio
    async def test_restore_backup_without_confirm(self, client: AsyncClient):
        """Restore backup without confirm param fails."""
        response = await client.post("/api/v1/admin/restore/some_backup_id")
        # FastAPI returns 422 for missing required query param
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_restore_backup_wrong_confirm(self, client: AsyncClient):
        """Restore backup with wrong confirm value fails."""
        response = await client.post("/api/v1/admin/restore/some_backup_id?confirm=wrong")
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["error_code"] == "CONFIRMATION_REQUIRED"

    @pytest.mark.asyncio
    async def test_restore_backup_not_found(self, client: AsyncClient):
        """Restore nonexistent backup returns 404."""
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = None

            response = await client.post("/api/v1/admin/restore/nonexistent_id?confirm=RESTORE")

            assert response.status_code == 404
            data = response.json()
            assert data["detail"]["error_code"] == "BACKUP_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_restore_backup_success(self, client: AsyncClient):
        """Restore backup with correct confirm succeeds."""
        mock_backup = BackupMetadata(
            id="20241215_143022_123456",
            filename="wallet_20241215_143022_123456.db.gz",
            description="Test backup",
            created_at=datetime(2024, 12, 15, 14, 30, 22, tzinfo=timezone.utc),
            size_bytes=1024,
            is_demo_backup=False,
            source="manual",
        )
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = mock_backup
            mock_service.restore_backup.return_value = True

            response = await client.post("/api/v1/admin/restore/20241215_143022_123456?confirm=RESTORE")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "backup" in data
            mock_service.restore_backup.assert_called_once_with("20241215_143022_123456")

    @pytest.mark.asyncio
    async def test_restore_backup_file_missing_raises_error(self, client: AsyncClient):
        """Restore backup when file is missing raises FileNotFoundError."""
        mock_backup = BackupMetadata(
            id="20241215_143022_123456",
            filename="wallet_20241215_143022_123456.db.gz",
            description="Test backup",
            created_at=datetime(2024, 12, 15, 14, 30, 22, tzinfo=timezone.utc),
            size_bytes=1024,
            is_demo_backup=False,
            source="manual",
        )
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = mock_backup
            mock_service.restore_backup.side_effect = FileNotFoundError("Backup file not found")

            # FileNotFoundError is not caught, propagates up
            with pytest.raises(FileNotFoundError, match="Backup file not found"):
                await client.post("/api/v1/admin/restore/20241215_143022_123456?confirm=RESTORE")


class TestBackupAPIDelete:
    """Tests for DELETE /api/v1/admin/backup/{backup_id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_backup_without_confirm(self, client: AsyncClient):
        """Delete backup without confirm param fails."""
        response = await client.delete("/api/v1/admin/backup/some_backup_id")
        # FastAPI returns 422 for missing required query param
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_backup_wrong_confirm(self, client: AsyncClient):
        """Delete backup with wrong confirm value fails."""
        response = await client.delete("/api/v1/admin/backup/some_backup_id?confirm=wrong")
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["error_code"] == "CONFIRMATION_REQUIRED"

    @pytest.mark.asyncio
    async def test_delete_backup_not_found(self, client: AsyncClient):
        """Delete nonexistent backup returns 404."""
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = None

            response = await client.delete("/api/v1/admin/backup/nonexistent_id?confirm=DELETE")

            assert response.status_code == 404
            data = response.json()
            assert data["detail"]["error_code"] == "BACKUP_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_delete_backup_success(self, client: AsyncClient):
        """Delete backup with correct confirm succeeds."""
        mock_backup = BackupMetadata(
            id="20241215_143022_123456",
            filename="wallet_20241215_143022_123456.db.gz",
            description="Test backup",
            created_at=datetime(2024, 12, 15, 14, 30, 22, tzinfo=timezone.utc),
            size_bytes=1024,
            is_demo_backup=False,
            source="manual",
        )
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = mock_backup
            mock_service.delete_backup.return_value = True

            response = await client.delete("/api/v1/admin/backup/20241215_143022_123456?confirm=DELETE")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            mock_service.delete_backup.assert_called_once_with("20241215_143022_123456")

    @pytest.mark.asyncio
    async def test_delete_demo_backup_fails(self, client: AsyncClient):
        """Delete demo backup fails with 400."""
        mock_backup = BackupMetadata(
            id="demo_backup_id",
            filename="wallet_demo_backup_id.db.gz",
            description="Demo backup",
            created_at=datetime(2024, 12, 15, 14, 30, 22, tzinfo=timezone.utc),
            size_bytes=1024,
            is_demo_backup=True,  # This is the key - it's a demo backup
            source="demo_seed",
        )
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = mock_backup

            response = await client.delete("/api/v1/admin/backup/demo_backup_id?confirm=DELETE")

            assert response.status_code == 400
            data = response.json()
            assert data["detail"]["error_code"] == "CANNOT_DELETE_DEMO_BACKUP"


class TestBackupAPISetDemo:
    """Tests for POST /api/v1/admin/backup/{backup_id}/set-demo endpoint."""

    @pytest.mark.asyncio
    async def test_set_demo_backup_success(self, client: AsyncClient):
        """Set demo backup succeeds."""
        mock_backup = BackupMetadata(
            id="20241215_143022_123456",
            filename="wallet_20241215_143022_123456.db.gz",
            description="Test backup",
            created_at=datetime(2024, 12, 15, 14, 30, 22, tzinfo=timezone.utc),
            size_bytes=1024,
            is_demo_backup=False,
            source="manual",
        )
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = mock_backup
            mock_service.set_demo_backup.return_value = True

            response = await client.post("/api/v1/admin/backup/20241215_143022_123456/set-demo")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            mock_service.set_demo_backup.assert_called_once_with("20241215_143022_123456")

    @pytest.mark.asyncio
    async def test_set_demo_backup_not_found(self, client: AsyncClient):
        """Set demo backup for nonexistent backup returns 404."""
        with patch("app.routers.admin.backup_service") as mock_service:
            mock_service.get_backup.return_value = None

            response = await client.post("/api/v1/admin/backup/nonexistent/set-demo")

            assert response.status_code == 404
            data = response.json()
            assert data["detail"]["error_code"] == "BACKUP_NOT_FOUND"
