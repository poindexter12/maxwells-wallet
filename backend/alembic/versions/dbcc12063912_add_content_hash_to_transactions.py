"""add_content_hash_to_transactions

Revision ID: dbcc12063912
Revises: 4a20f1655011
Create Date: 2025-11-29 14:20:42.202919

Add content_hash column to transactions table for reliable deduplication.
Uses SHA256 hash of normalized: {date}|{amount}|{description}|{account_source}
"""
from alembic import op
import sqlalchemy as sa
import hashlib


# revision identifiers, used by Alembic.
revision = 'dbcc12063912'
down_revision = '4a20f1655011'
branch_labels = None
depends_on = None


def compute_content_hash(date_str: str, amount: float, description: str, account_source: str) -> str:
    """Compute SHA256 content hash for a transaction"""
    # Normalize inputs
    amount_str = f"{amount:.2f}"
    description_normalized = description.lower().strip()
    account_source_normalized = account_source.lower().strip()

    # Create hash input
    hash_input = f"{date_str}|{amount_str}|{description_normalized}|{account_source_normalized}"

    # Compute SHA256 hash
    hash_obj = hashlib.sha256(hash_input.encode('utf-8'))
    return hash_obj.hexdigest()


def upgrade() -> None:
    """Add content_hash column and backfill existing transactions"""
    # Add content_hash column (nullable for backfill)
    op.add_column('transactions', sa.Column('content_hash', sa.String(), nullable=True))

    # Create index for fast lookups
    op.create_index('ix_transactions_content_hash', 'transactions', ['content_hash'])

    # Backfill content_hash for all existing transactions
    connection = op.get_bind()

    # Get all transactions
    result = connection.execute(
        sa.text("""
            SELECT id, date, amount, description, account_source
            FROM transactions
            WHERE content_hash IS NULL
        """)
    )

    transactions = result.fetchall()

    # Update each transaction with its computed hash
    for txn in transactions:
        txn_id, date_str, amount, description, account_source = txn

        # Skip if any required field is missing
        if not all([date_str, description, account_source]):
            continue

        # Compute hash
        content_hash = compute_content_hash(date_str, amount, description, account_source)

        # Update transaction
        connection.execute(
            sa.text("""
                UPDATE transactions
                SET content_hash = :content_hash
                WHERE id = :txn_id
            """),
            {"content_hash": content_hash, "txn_id": txn_id}
        )


def downgrade() -> None:
    """Remove content_hash column"""
    op.drop_index('ix_transactions_content_hash', table_name='transactions')
    op.drop_column('transactions', 'content_hash')
