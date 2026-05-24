"""add_app_settings_table

Add app_settings table for storing application-wide settings including
i18n language preference. Uses single-row upsert pattern.

Revision ID: b3c4d5e6f7g8
Revises: 7a9e75752cd8
Create Date: 2025-12-09

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from datetime import UTC, datetime


# revision identifiers, used by Alembic.
revision = 'b3c4d5e6f7g8'
down_revision = '7a9e75752cd8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create app_settings table
    op.create_table('app_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('language', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='browser'),
        sa.PrimaryKeyConstraint('id')
    )

    # Insert default row with 'browser' language preference
    connection = op.get_bind()
    now = datetime.now(UTC)
    connection.execute(
        sa.text("""
            INSERT INTO app_settings (created_at, updated_at, language)
            VALUES (:created_at, :updated_at, :language)
        """),
        {"created_at": now, "updated_at": now, "language": "browser"}
    )


def downgrade() -> None:
    op.drop_table('app_settings')
