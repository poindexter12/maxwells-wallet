"""rename category_rules to tag_rules and category to tag column

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-11-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NOTE: This migration is now a no-op because:
    # 1. tag_rules is created in root migration 1b7c2fce9b4b with the correct schema
    # 2. category_rules was never created (we start with tag_rules)
    # The migration is kept for schema version history
    pass


def downgrade() -> None:
    # No-op - see upgrade() comment
    pass
