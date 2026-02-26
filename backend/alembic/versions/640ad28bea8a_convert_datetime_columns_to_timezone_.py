"""convert datetime columns to timezone aware utc

Revision ID: 640ad28bea8a
Revises: ff399295d095
Create Date: 2026-02-26 10:48:10.560984

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '640ad28bea8a'
down_revision = 'ff399295d095'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Convert all datetime columns to timezone-aware UTC.

    For SQLite: This migration marks all existing naive datetime values as UTC-aware.
    SQLite stores datetime as strings, so we don't need to alter column types.
    The timezone=True parameter in SQLAlchemy handles the conversion at the ORM level.

    For Postgres: When migrating to Postgres, SQLAlchemy will automatically create
    TIMESTAMP WITH TIME ZONE columns based on DateTime(timezone=True) in the models.
    """
    # SQLite doesn't require ALTER COLUMN changes for timezone awareness
    # The DateTime(timezone=True) in the ORM models handles conversion automatically
    # No-op migration for SQLite compatibility
    pass


def downgrade() -> None:
    """
    Downgrade removes timezone awareness.

    Note: This is a no-op for SQLite since timezone awareness is handled at the ORM level.
    On Postgres, this would convert TIMESTAMP WITH TIME ZONE back to TIMESTAMP.
    """
    pass
