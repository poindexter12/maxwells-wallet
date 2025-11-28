"""add tags system with namespaced tags

Revision ID: a1b2c3d4e5f6
Revises: 6ce6205b5a58
Create Date: 2025-11-28 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


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
    # 1. Create tags table
    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('namespace', sa.String(), nullable=False),
        sa.Column('value', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tags_namespace', 'tags', ['namespace'], unique=False)
    op.create_index('ix_tags_value', 'tags', ['value'], unique=False)
    op.create_index('ix_tags_namespace_value', 'tags', ['namespace', 'value'], unique=True)

    # 2. Create transaction_tags junction table
    op.create_table(
        'transaction_tags',
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('transaction_id', 'tag_id')
    )

    # 3. Seed default bucket tags
    conn = op.get_bind()
    now = datetime.utcnow().isoformat()

    for namespace, value, description in DEFAULT_BUCKET_TAGS:
        conn.execute(
            sa.text(
                "INSERT INTO tags (created_at, updated_at, namespace, value, description) "
                "VALUES (:created_at, :updated_at, :namespace, :value, :description)"
            ),
            {"created_at": now, "updated_at": now, "namespace": namespace, "value": value, "description": description}
        )

    # 4. Migrate existing transaction categories to bucket tags
    # First, get existing unique categories from transactions
    result = conn.execute(sa.text("SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL"))
    existing_categories = [row[0] for row in result.fetchall()]

    # Create bucket tags for any categories not in our defaults
    default_values = {t[1] for t in DEFAULT_BUCKET_TAGS}
    for cat in existing_categories:
        cat_lower = cat.lower().replace(" ", "-")
        if cat_lower not in default_values:
            conn.execute(
                sa.text(
                    "INSERT INTO tags (created_at, updated_at, namespace, value, description) "
                    "VALUES (:created_at, :updated_at, 'bucket', :value, :description)"
                ),
                {"created_at": now, "updated_at": now, "value": cat_lower, "description": f"Migrated from category: {cat}"}
            )

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
    # Drop junction table first (depends on tags)
    op.drop_table('transaction_tags')

    # Drop indexes and tags table
    op.drop_index('ix_tags_namespace_value', table_name='tags')
    op.drop_index('ix_tags_value', table_name='tags')
    op.drop_index('ix_tags_namespace', table_name='tags')
    op.drop_table('tags')
