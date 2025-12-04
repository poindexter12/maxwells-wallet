"""add_content_hash_no_account

Revision ID: 72eca9e7f907
Revises: ab31f6a47a0d
Create Date: 2025-12-03 21:55:11.201996

Add content_hash_no_account column to transactions table for cross-account duplicate detection.
This hash excludes account_source, allowing detection of same transactions imported to different accounts.
"""
from alembic import op
import sqlalchemy as sa
import hashlib


# revision identifiers, used by Alembic.
revision = '72eca9e7f907'
down_revision = 'ab31f6a47a0d'
branch_labels = None
depends_on = None


def compute_hash_no_account(date_str: str, amount: float, description: str) -> str:
    """Compute SHA256 hash without account_source."""
    amount_str = f"{amount:.2f}"
    description_normalized = description.lower().strip()
    hash_input = f"{date_str}|{amount_str}|{description_normalized}"
    hash_obj = hashlib.sha256(hash_input.encode('utf-8'))
    return hash_obj.hexdigest()


def upgrade() -> None:
    # Add content_hash_no_account column
    op.add_column('transactions', sa.Column('content_hash_no_account', sa.String(), nullable=True))
    op.create_index('ix_transactions_content_hash_no_account', 'transactions', ['content_hash_no_account'])

    # Backfill content_hash_no_account for all existing transactions
    connection = op.get_bind()

    result = connection.execute(
        sa.text("""
            SELECT id, date, amount, description
            FROM transactions
            WHERE content_hash_no_account IS NULL
        """)
    )

    transactions = result.fetchall()

    for txn in transactions:
        txn_id, date_str, amount, description = txn

        if not all([date_str, description]):
            continue

        content_hash_no_account = compute_hash_no_account(date_str, amount, description)

        connection.execute(
            sa.text("""
                UPDATE transactions
                SET content_hash_no_account = :hash
                WHERE id = :txn_id
            """),
            {"hash": content_hash_no_account, "txn_id": txn_id}
        )


def downgrade() -> None:
    op.drop_index('ix_transactions_content_hash_no_account', table_name='transactions')
    op.drop_column('transactions', 'content_hash_no_account')
