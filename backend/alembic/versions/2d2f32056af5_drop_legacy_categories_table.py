"""drop legacy categories table

Revision ID: 2d2f32056af5
Revises: 4a20f1655011
Create Date: 2025-11-29 14:22:05.858525

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2d2f32056af5'
down_revision = '4a20f1655011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the legacy categories table if it exists
    # This table was from the old Category model which has been replaced by the Tag system
    conn = op.get_bind()

    # Check if table exists first (for SQLite compatibility)
    inspector = sa.inspect(conn)
    if 'categories' in inspector.get_table_names():
        op.drop_table('categories')


def downgrade() -> None:
    # Recreate the categories table for rollback
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_categories_name', 'categories', ['name'], unique=True)
