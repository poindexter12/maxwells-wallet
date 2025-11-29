"""backfill_account_tag_id

Revision ID: 4a20f1655011
Revises: 36d3a72a4e57
Create Date: 2025-11-29 08:12:33.027996

Backfill account_tag_id for existing transactions by matching
account_source string to account tags (namespace='account').
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4a20f1655011'
down_revision = '36d3a72a4e57'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Backfill account_tag_id for existing transactions.

    For each unique account_source:
    1. Normalize to tag value format (lowercase, dashes)
    2. Find or create matching account tag
    3. Update all transactions with that account_source
    """
    connection = op.get_bind()

    # Get all unique account_sources that don't have account_tag_id set
    result = connection.execute(
        sa.text("""
            SELECT DISTINCT account_source
            FROM transactions
            WHERE account_source IS NOT NULL
            AND (account_tag_id IS NULL OR account_tag_id = 0)
        """)
    )
    account_sources = [row[0] for row in result]

    for account_source in account_sources:
        # Normalize to tag value format
        tag_value = account_source.lower().replace(' ', '-')

        # Check if account tag exists
        tag_result = connection.execute(
            sa.text("""
                SELECT id FROM tags
                WHERE namespace = 'account' AND value = :tag_value
            """),
            {"tag_value": tag_value}
        )
        tag_row = tag_result.fetchone()

        if tag_row:
            tag_id = tag_row[0]
        else:
            # Create the account tag
            connection.execute(
                sa.text("""
                    INSERT INTO tags (created_at, updated_at, namespace, value, description, sort_order)
                    VALUES (datetime('now'), datetime('now'), 'account', :tag_value, :description, 0)
                """),
                {"tag_value": tag_value, "description": account_source}
            )
            # Get the new tag ID
            tag_result = connection.execute(
                sa.text("SELECT id FROM tags WHERE namespace = 'account' AND value = :tag_value"),
                {"tag_value": tag_value}
            )
            tag_id = tag_result.fetchone()[0]

        # Update all transactions with this account_source
        connection.execute(
            sa.text("""
                UPDATE transactions
                SET account_tag_id = :tag_id
                WHERE account_source = :account_source
            """),
            {"tag_id": tag_id, "account_source": account_source}
        )


def downgrade() -> None:
    """Clear all account_tag_id values"""
    op.execute("UPDATE transactions SET account_tag_id = NULL")
