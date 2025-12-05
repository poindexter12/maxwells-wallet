"""add date_range_type to dashboards

Revision ID: f29bca4459fc
Revises: 3b61479d0fba
Create Date: 2025-12-04 19:40:37.969906

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'f29bca4459fc'
down_revision = '3b61479d0fba'
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add date_range_type column to dashboards with default 'mtd' (if not exists)
    if not column_exists('dashboards', 'date_range_type'):
        op.add_column('dashboards', sa.Column(
            'date_range_type',
            sa.Enum('mtd', 'qtd', 'ytd', 'last_30_days', 'last_90_days', 'last_year', name='daterangetype'),
            nullable=False,
            server_default='mtd'
        ))

    # Make view_mode nullable (deprecated field) - skip on SQLite as it doesn't support ALTER COLUMN well
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.alter_column('dashboards', 'view_mode',
                   existing_type=sa.VARCHAR(),
                   nullable=True)


def downgrade() -> None:
    # Make view_mode required again
    op.alter_column('dashboards', 'view_mode',
               existing_type=sa.VARCHAR(),
               nullable=False)

    # Remove date_range_type column
    op.drop_column('dashboards', 'date_range_type')
