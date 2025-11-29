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
    # Add account_tag_id FK to transactions table
    # SQLite doesn't support ADD CONSTRAINT, so add column and index only
    op.add_column('transactions', sa.Column('account_tag_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_transactions_account_tag_id'), 'transactions', ['account_tag_id'], unique=False)
    # FK constraint enforced at ORM level for SQLite; real FK would be added for Postgres


def downgrade() -> None:
    op.drop_index(op.f('ix_transactions_account_tag_id'), table_name='transactions')
    op.drop_column('transactions', 'account_tag_id')
