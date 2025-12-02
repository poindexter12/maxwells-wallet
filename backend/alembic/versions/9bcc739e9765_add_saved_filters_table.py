"""add_saved_filters_table

Revision ID: 9bcc739e9765
Revises: 36cfdc725bac
Create Date: 2025-12-01 22:03:56.533752

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '9bcc739e9765'
down_revision = '36cfdc725bac'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('saved_filters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('accounts', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('accounts_exclude', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('tags', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('tags_exclude', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('search', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('search_regex', sa.Boolean(), nullable=False),
        sa.Column('amount_min', sa.Float(), nullable=True),
        sa.Column('amount_max', sa.Float(), nullable=True),
        sa.Column('reconciliation_status', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('is_transfer', sa.Boolean(), nullable=True),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('date_range_type', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('relative_days', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('use_count', sa.Integer(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('is_pinned', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_saved_filters_name'), 'saved_filters', ['name'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_saved_filters_name'), table_name='saved_filters')
    op.drop_table('saved_filters')
