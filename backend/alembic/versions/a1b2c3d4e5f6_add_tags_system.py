"""add tags system with namespaced tags

Revision ID: a1b2c3d4e5f6
Revises: 6ce6205b5a58
Create Date: 2025-11-28 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import UTC, datetime


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '6ce6205b5a58'
branch_labels = None
depends_on = None

# Default bucket tags to seed
DEFAULT_BUCKET_TAGS = [
    ("bucket", "none", "Uncategorized transactions"),
    ("bucket", "income", "Income and earnings"),
    ("bucket", "groceries", "Grocery shopping"),
    ("bucket", "dining", "Restaurants and food delivery"),
    ("bucket", "shopping", "General shopping"),
    ("bucket", "utilities", "Utilities and bills"),
    ("bucket", "transportation", "Gas, transit, rideshare"),
    ("bucket", "entertainment", "Entertainment and leisure"),
    ("bucket", "healthcare", "Medical and health expenses"),
    ("bucket", "education", "Education and learning"),
    ("bucket", "housing", "Rent, mortgage, home expenses"),
    ("bucket", "subscriptions", "Recurring subscriptions"),
    ("bucket", "other", "Other expenses"),
]


def upgrade() -> None:
    # NOTE: tags and transaction_tags tables are now created in root migration 1b7c2fce9b4b
    # This migration only adds the unique index and seeds default data

    # 1. Add unique index on namespace+value (may not exist yet)
    try:
        op.create_index('ix_tags_namespace_value', 'tags', ['namespace', 'value'], unique=True)
    except Exception:
        pass  # Index might already exist

    # 2. Seed default bucket tags
    conn = op.get_bind()
    now = datetime.now(UTC).isoformat()

    for idx, (namespace, value, description) in enumerate(DEFAULT_BUCKET_TAGS):
        conn.execute(
            sa.text(
                "INSERT INTO tags (created_at, updated_at, namespace, value, description, sort_order, color) "
                "VALUES (:created_at, :updated_at, :namespace, :value, :description, :sort_order, :color)"
            ),
            {"created_at": now, "updated_at": now, "namespace": namespace, "value": value,
             "description": description, "sort_order": idx, "color": None}
        )

    # 4. Migrate existing transaction categories to bucket tags
    # First, get existing unique categories from transactions
    result = conn.execute(sa.text("SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL"))
    existing_categories = [row[0] for row in result.fetchall()]

    # Create bucket tags for any categories not in our defaults
    default_values = {t[1] for t in DEFAULT_BUCKET_TAGS}
    extra_sort_order = len(DEFAULT_BUCKET_TAGS)
    for cat in existing_categories:
        cat_lower = cat.lower().replace(" ", "-")
        if cat_lower not in default_values:
            conn.execute(
                sa.text(
                    "INSERT INTO tags (created_at, updated_at, namespace, value, description, sort_order, color) "
                    "VALUES (:created_at, :updated_at, 'bucket', :value, :description, :sort_order, :color)"
                ),
                {"created_at": now, "updated_at": now, "value": cat_lower,
                 "description": f"Migrated from category: {cat}", "sort_order": extra_sort_order, "color": None}
            )
            extra_sort_order += 1

    # 5. Link transactions to their bucket tags
    # For each transaction with a category, create a transaction_tag entry
    conn.execute(
        sa.text("""
            INSERT INTO transaction_tags (transaction_id, tag_id)
            SELECT t.id, tags.id
            FROM transactions t
            JOIN tags ON tags.namespace = 'bucket' AND LOWER(REPLACE(t.category, ' ', '-')) = tags.value
            WHERE t.category IS NOT NULL
        """)
    )

    # For transactions without a category, link to bucket:none
    conn.execute(
        sa.text("""
            INSERT INTO transaction_tags (transaction_id, tag_id)
            SELECT t.id, tags.id
            FROM transactions t
            JOIN tags ON tags.namespace = 'bucket' AND tags.value = 'none'
            WHERE t.category IS NULL
            AND NOT EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = t.id)
        """)
    )


def downgrade() -> None:
    # NOTE: tags and transaction_tags tables are dropped by root migration downgrade
    # This migration only drops the unique index it created and removes seeded data
    conn = op.get_bind()

    # Remove the seeded bucket tags and their transaction links
    conn.execute(sa.text("DELETE FROM transaction_tags WHERE tag_id IN (SELECT id FROM tags WHERE namespace = 'bucket')"))
    conn.execute(sa.text("DELETE FROM tags WHERE namespace = 'bucket'"))

    # Drop the unique index
    try:
        op.drop_index('ix_tags_namespace_value', table_name='tags')
    except Exception:
        pass  # Index might not exist
