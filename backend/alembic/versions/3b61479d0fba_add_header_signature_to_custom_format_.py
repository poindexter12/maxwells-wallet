"""add header_signature to custom_format_configs

Revision ID: 3b61479d0fba
Revises: 2a92177dfb54
Create Date: 2025-12-04 16:43:19.255152

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '3b61479d0fba'
down_revision = '2a92177dfb54'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add header_signature column for auto-matching CSV formats by their headers
    op.add_column('custom_format_configs', sa.Column('header_signature', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f('ix_custom_format_configs_header_signature'), 'custom_format_configs', ['header_signature'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_custom_format_configs_header_signature'), table_name='custom_format_configs')
    op.drop_column('custom_format_configs', 'header_signature')
