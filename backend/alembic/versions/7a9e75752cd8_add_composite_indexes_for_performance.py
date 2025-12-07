"""add_composite_indexes_for_performance

Revision ID: 7a9e75752cd8
Revises: 8ae9be195232
Create Date: 2025-12-06 20:03:04.981756

Performance optimization indexes for common query patterns:
- Composite index on (date, is_transfer) for report date range + transfer filter
- Composite index on (is_transfer, date, category) for aggregation queries
- Index on transaction_tags.tag_id for tag filtering joins
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '7a9e75752cd8'
down_revision = '8ae9be195232'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite index for date range + transfer filter (most reports use this pattern)
    op.create_index(
        'ix_transactions_date_is_transfer',
        'transactions',
        ['date', 'is_transfer'],
        unique=False
    )

    # Covering index for category aggregations by date (excludes transfers)
    op.create_index(
        'ix_transactions_is_transfer_date_category',
        'transactions',
        ['is_transfer', 'date', 'category'],
        unique=False
    )

    # Index on tag_id for efficient tag filtering joins
    # (PK only covers transaction_id, tag_id together)
    op.create_index(
        'ix_transaction_tags_tag_id',
        'transaction_tags',
        ['tag_id'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_transaction_tags_tag_id', table_name='transaction_tags')
    op.drop_index('ix_transactions_is_transfer_date_category', table_name='transactions')
    op.drop_index('ix_transactions_date_is_transfer', table_name='transactions')
