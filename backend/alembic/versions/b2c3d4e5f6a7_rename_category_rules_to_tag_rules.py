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
    # SQLite doesn't support ALTER TABLE RENAME COLUMN directly
    # We need to recreate the table

    # 1. Create new tag_rules table
    op.create_table(
        'tag_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('tag', sa.String(), nullable=False),  # renamed from 'category'
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('merchant_pattern', sa.String(), nullable=True),
        sa.Column('description_pattern', sa.String(), nullable=True),
        sa.Column('amount_min', sa.Float(), nullable=True),
        sa.Column('amount_max', sa.Float(), nullable=True),
        sa.Column('account_source', sa.String(), nullable=True),
        sa.Column('match_all', sa.Boolean(), nullable=False),
        sa.Column('match_count', sa.Integer(), nullable=False),
        sa.Column('last_matched_date', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tag_rules_tag', 'tag_rules', ['tag'], unique=False)
    op.create_index('ix_tag_rules_priority', 'tag_rules', ['priority'], unique=False)

    # 2. Copy data from category_rules, converting category to bucket:category format
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO tag_rules (
            id, created_at, updated_at, name, tag, priority, enabled,
            merchant_pattern, description_pattern, amount_min, amount_max,
            account_source, match_all, match_count, last_matched_date
        )
        SELECT
            id, created_at, updated_at, name,
            'bucket:' || LOWER(REPLACE(category, ' ', '-')),
            priority, enabled,
            merchant_pattern, description_pattern, amount_min, amount_max,
            account_source, match_all, match_count, last_matched_date
        FROM category_rules
    """))

    # 3. Drop old table
    op.drop_table('category_rules')


def downgrade() -> None:
    # Recreate category_rules table
    op.create_table(
        'category_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('merchant_pattern', sa.String(), nullable=True),
        sa.Column('description_pattern', sa.String(), nullable=True),
        sa.Column('amount_min', sa.Float(), nullable=True),
        sa.Column('amount_max', sa.Float(), nullable=True),
        sa.Column('account_source', sa.String(), nullable=True),
        sa.Column('match_all', sa.Boolean(), nullable=False),
        sa.Column('match_count', sa.Integer(), nullable=False),
        sa.Column('last_matched_date', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_category_rules_category', 'category_rules', ['category'], unique=False)
    op.create_index('ix_category_rules_priority', 'category_rules', ['priority'], unique=False)

    # Copy data back, stripping bucket: prefix
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO category_rules (
            id, created_at, updated_at, name, category, priority, enabled,
            merchant_pattern, description_pattern, amount_min, amount_max,
            account_source, match_all, match_count, last_matched_date
        )
        SELECT
            id, created_at, updated_at, name,
            REPLACE(tag, 'bucket:', ''),
            priority, enabled,
            merchant_pattern, description_pattern, amount_min, amount_max,
            account_source, match_all, match_count, last_matched_date
        FROM tag_rules
    """))

    op.drop_table('tag_rules')
