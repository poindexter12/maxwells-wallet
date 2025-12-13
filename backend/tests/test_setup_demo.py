"""
Tests for the demo setup script.

These tests verify that the setup_demo script:
1. Completes without hanging (important: APScheduler threads can block exit)
2. Seeds the database correctly
3. Creates a demo backup
"""

import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine


@pytest.fixture
def demo_db(tmp_path: Path):
    """Create a temporary database with schema for demo testing."""
    import asyncio

    db_path = tmp_path / "test_wallet.db"
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()

    async def create_tables():
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
        from app import models  # noqa: F401

        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        await engine.dispose()

    # Run in a fresh event loop to avoid conflicts with pytest-asyncio
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(create_tables())
    finally:
        loop.close()

    return db_path, backup_dir


class TestSetupDemoScript:
    """Tests for the setup_demo.py script execution behavior."""

    def test_setup_demo_exits_without_hanging(self, demo_db):
        """
        Test that setup_demo.py exits within a reasonable time.

        This is the most important test - it catches the bug where
        APScheduler threads blocked exit. The script should complete
        in under 30 seconds for any reasonable database size.
        """
        db_path, backup_dir = demo_db

        # Run the setup_demo script as a subprocess with timeout
        result = subprocess.run(
            [sys.executable, "-m", "scripts.setup_demo"],
            cwd=Path(__file__).parent.parent,
            env={
                "DATABASE_URL": f"sqlite+aiosqlite:///{db_path}",
                "BACKUP_DIR": str(backup_dir),
                "PATH": "",
            },
            capture_output=True,
            text=True,
            timeout=30,  # Should complete well under 30 seconds
        )

        # Verify it completed successfully (exit code 0)
        assert result.returncode == 0, f"Script failed with: {result.stderr}"

    def test_setup_demo_populates_database(self, demo_db):
        """Test that setup_demo creates transactions in the database."""
        db_path, backup_dir = demo_db

        result = subprocess.run(
            [sys.executable, "-m", "scripts.setup_demo"],
            cwd=Path(__file__).parent.parent,
            env={
                "DATABASE_URL": f"sqlite+aiosqlite:///{db_path}",
                "BACKUP_DIR": str(backup_dir),
                "PATH": "",
            },
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode == 0

        # Verify transactions were created
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT COUNT(*) FROM transactions")
        count = cursor.fetchone()[0]
        conn.close()

        # setup_demo creates 500 transactions by default
        assert count == 500, f"Expected 500 transactions, got {count}"

    def test_setup_demo_creates_backup(self, demo_db):
        """Test that setup_demo creates a backup file."""
        db_path, backup_dir = demo_db

        result = subprocess.run(
            [sys.executable, "-m", "scripts.setup_demo"],
            cwd=Path(__file__).parent.parent,
            env={
                "DATABASE_URL": f"sqlite+aiosqlite:///{db_path}",
                "BACKUP_DIR": str(backup_dir),
                "PATH": "",
            },
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode == 0

        # Verify backup was created
        backup_files = list(backup_dir.glob("*.gz"))
        assert len(backup_files) >= 1, "No backup files created"

    def test_setup_demo_creates_demo_backup_marker(self, demo_db):
        """Test that the created backup is marked as demo backup."""
        import json

        db_path, backup_dir = demo_db

        result = subprocess.run(
            [sys.executable, "-m", "scripts.setup_demo"],
            cwd=Path(__file__).parent.parent,
            env={
                "DATABASE_URL": f"sqlite+aiosqlite:///{db_path}",
                "BACKUP_DIR": str(backup_dir),
                "PATH": "",
            },
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode == 0

        # Read manifest and verify demo backup flag
        manifest_path = backup_dir / "manifest.json"
        assert manifest_path.exists(), "Manifest file not created"

        with open(manifest_path) as f:
            manifest = json.load(f)

        # Should have exactly one backup marked as demo
        demo_backups = [b for b in manifest["backups"] if b.get("is_demo_backup")]
        assert len(demo_backups) == 1, "Expected exactly one demo backup"
        assert demo_backups[0]["source"] == "demo_seed"
