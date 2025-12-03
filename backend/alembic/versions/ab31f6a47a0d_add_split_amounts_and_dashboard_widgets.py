"""add_split_amounts_and_dashboard_widgets

Revision ID: ab31f6a47a0d
Revises: 9bcc739e9765
Create Date: 2025-12-02 16:32:54.764135

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ab31f6a47a0d'
down_revision = '9bcc739e9765'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create dashboard_widgets table
    op.create_table('dashboard_widgets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('widget_type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('width', sa.String(), nullable=False),
        sa.Column('is_visible', sa.Boolean(), nullable=False),
        sa.Column('config', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dashboard_widgets_widget_type'), 'dashboard_widgets', ['widget_type'], unique=False)

    # Add amount column to transaction_tags for split amounts
    op.add_column('transaction_tags', sa.Column('amount', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('transaction_tags', 'amount')
    op.drop_index(op.f('ix_dashboard_widgets_widget_type'), table_name='dashboard_widgets')
    op.drop_table('dashboard_widgets')
