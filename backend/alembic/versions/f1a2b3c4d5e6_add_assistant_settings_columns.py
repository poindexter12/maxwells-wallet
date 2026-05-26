"""add_assistant_settings_columns

Add AI assistant (bring-your-own-key) configuration to app_settings:
provider, model, and api_key. The api_key is write-only at the API layer
and is never returned to clients.

Revision ID: f1a2b3c4d5e6
Revises: 1e79b0957e91
Create Date: 2026-05-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = '1e79b0957e91'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('app_settings') as batch_op:
        batch_op.add_column(sa.Column('assistant_provider', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('assistant_model', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('assistant_api_key', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('app_settings') as batch_op:
        batch_op.drop_column('assistant_api_key')
        batch_op.drop_column('assistant_model')
        batch_op.drop_column('assistant_provider')
