"""add custom_format_configs table

Revision ID: 2a92177dfb54
Revises: 5a841ee04972
Create Date: 2025-12-04 06:21:28.419872

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '2a92177dfb54'
down_revision = '5a841ee04972'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create custom_format_configs table for user-defined CSV formats
    op.create_table('custom_format_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('config_json', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('use_count', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_custom_format_configs_name'), 'custom_format_configs', ['name'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_custom_format_configs_name'), table_name='custom_format_configs')
    op.drop_table('custom_format_configs')
