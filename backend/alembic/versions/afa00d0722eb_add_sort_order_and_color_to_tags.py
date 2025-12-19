"""add sort_order and color to tags

Revision ID: afa00d0722eb
Revises: c3d4e5f6a7b8
Create Date: 2025-11-29 07:45:58.350189

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'afa00d0722eb'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NOTE: This migration is now a no-op because:
    # 1. tags table is created in root migration 1b7c2fce9b4b with sort_order and color columns
    # The migration is kept for schema version history
    pass


def downgrade() -> None:
    # No-op - see upgrade() comment
    pass
