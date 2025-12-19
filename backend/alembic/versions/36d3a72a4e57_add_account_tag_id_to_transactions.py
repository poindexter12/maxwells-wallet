"""add_account_tag_id_to_transactions

Revision ID: 36d3a72a4e57
Revises: afa00d0722eb
Create Date: 2025-11-29 08:11:13.187609

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '36d3a72a4e57'
down_revision = 'afa00d0722eb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NOTE: This migration is now a no-op because:
    # 1. transactions table is created in root migration 1b7c2fce9b4b with account_tag_id column
    # The migration is kept for schema version history
    pass


def downgrade() -> None:
    # No-op - see upgrade() comment
    pass
