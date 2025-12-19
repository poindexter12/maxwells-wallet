"""rename budget category to tag column

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2025-11-28 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NOTE: This migration is now a no-op because:
    # 1. budgets table is created in root migration 1b7c2fce9b4b with 'tag' column
    # 2. No 'category' column ever existed (we start with 'tag')
    # The migration is kept for schema version history
    pass


def downgrade() -> None:
    # No-op - see upgrade() comment
    pass
