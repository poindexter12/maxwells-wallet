"""rename budget category to tag column

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2025-11-28 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite doesn't support ALTER TABLE RENAME COLUMN directly
    # We need to recreate the table

    # 1. Create new budgets table with tag column
    op.create_table(
        'budgets_new',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('tag', sa.String(), nullable=False),  # renamed from 'category'
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('period', sa.String(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('rollover_enabled', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_budgets_new_tag', 'budgets_new', ['tag'], unique=False)

    # 2. Copy data from budgets, converting category to bucket:category format
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO budgets_new (
            id, created_at, updated_at, tag, amount, period,
            start_date, end_date, rollover_enabled
        )
        SELECT
            id, created_at, updated_at,
            'bucket:' || LOWER(REPLACE(category, ' ', '-')),
            amount, period,
            start_date, end_date, rollover_enabled
        FROM budgets
    """))

    # 3. Drop old table
    op.drop_table('budgets')

    # 4. Rename new table to budgets
    op.rename_table('budgets_new', 'budgets')


def downgrade() -> None:
    # Recreate old budgets table with category column
    op.create_table(
        'budgets_old',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('period', sa.String(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('rollover_enabled', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_budgets_old_category', 'budgets_old', ['category'], unique=False)

    # Copy data back, stripping bucket: prefix
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO budgets_old (
            id, created_at, updated_at, category, amount, period,
            start_date, end_date, rollover_enabled
        )
        SELECT
            id, created_at, updated_at,
            REPLACE(tag, 'bucket:', ''),
            amount, period,
            start_date, end_date, rollover_enabled
        FROM budgets
    """))

    op.drop_table('budgets')
    op.rename_table('budgets_old', 'budgets')
