"""drop title from dashboard_widgets

Revision ID: e2a1fd22eee3
Revises: b3c4d5e6f7g8
Create Date: 2025-12-11 09:32:27.898748

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e2a1fd22eee3'
down_revision = 'b3c4d5e6f7g8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the title column - widget names are now i18n translations based on widget_type
    op.drop_column('dashboard_widgets', 'title')


def downgrade() -> None:
    # Re-add title column (nullable)
    op.add_column('dashboard_widgets', sa.Column('title', sa.TEXT(), nullable=True))
