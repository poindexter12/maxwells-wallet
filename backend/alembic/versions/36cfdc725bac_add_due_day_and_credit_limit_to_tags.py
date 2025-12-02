"""add due_day and credit_limit to tags

Revision ID: 36cfdc725bac
Revises: 79d69775547d
Create Date: 2025-12-01 21:48:16.610586

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '36cfdc725bac'
down_revision = '79d69775547d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add account-specific fields to tags table
    op.add_column('tags', sa.Column('due_day', sa.Integer(), nullable=True))
    op.add_column('tags', sa.Column('credit_limit', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('tags', 'credit_limit')
    op.drop_column('tags', 'due_day')
