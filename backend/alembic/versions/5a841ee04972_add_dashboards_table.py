"""add_dashboards_table

Revision ID: 5a841ee04972
Revises: 72eca9e7f907
Create Date: 2025-12-03 22:09:36.715325

Add dashboards table for multi-dashboard support.
Creates a default dashboard and assigns all existing widgets to it.
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '5a841ee04972'
down_revision = '72eca9e7f907'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create dashboards table
    op.create_table('dashboards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('view_mode', sa.String(), nullable=False),
        sa.Column('pinned_year', sa.Integer(), nullable=True),
        sa.Column('pinned_month', sa.Integer(), nullable=True),
        sa.Column('filter_buckets', sa.String(), nullable=True),
        sa.Column('filter_accounts', sa.String(), nullable=True),
        sa.Column('filter_merchants', sa.String(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_dashboards_is_default', 'dashboards', ['is_default'])
    op.create_index('ix_dashboards_name', 'dashboards', ['name'])

    # Add dashboard_id to dashboard_widgets
    op.add_column('dashboard_widgets', sa.Column('dashboard_id', sa.Integer(), nullable=True))
    op.create_index('ix_dashboard_widgets_dashboard_id', 'dashboard_widgets', ['dashboard_id'])
    # Note: SQLite doesn't support adding FK constraints after table creation
    # The relationship is enforced at the application level via SQLModel

    # Create default dashboard and assign existing widgets
    connection = op.get_bind()
    now = datetime.utcnow()

    # Insert default dashboard
    connection.execute(
        sa.text("""
            INSERT INTO dashboards (created_at, updated_at, name, description, view_mode, is_default, position)
            VALUES (:created_at, :updated_at, :name, :description, :view_mode, :is_default, :position)
        """),
        {
            "created_at": now,
            "updated_at": now,
            "name": "Default",
            "description": "Default dashboard",
            "view_mode": "month",
            "is_default": True,
            "position": 0
        }
    )

    # Get the default dashboard ID
    result = connection.execute(sa.text("SELECT id FROM dashboards WHERE is_default = 1"))
    default_dashboard_id = result.fetchone()[0]

    # Assign all existing widgets to the default dashboard
    connection.execute(
        sa.text("UPDATE dashboard_widgets SET dashboard_id = :dashboard_id"),
        {"dashboard_id": default_dashboard_id}
    )


def downgrade() -> None:
    op.drop_index('ix_dashboard_widgets_dashboard_id', table_name='dashboard_widgets')
    op.drop_column('dashboard_widgets', 'dashboard_id')
    op.drop_index('ix_dashboards_name', table_name='dashboards')
    op.drop_index('ix_dashboards_is_default', table_name='dashboards')
    op.drop_table('dashboards')
