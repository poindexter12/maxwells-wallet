"""drop_assistant_settings_columns

The AI assistant is now configured only via the server environment (provider,
model, and API key). Nothing assistant-related is persisted, so drop the
app_settings columns added by f1a2b3c4d5e6.

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-05-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('app_settings') as batch_op:
        batch_op.drop_column('assistant_api_key')
        batch_op.drop_column('assistant_model')
        batch_op.drop_column('assistant_provider')


def downgrade() -> None:
    with op.batch_alter_table('app_settings') as batch_op:
        batch_op.add_column(sa.Column('assistant_provider', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('assistant_model', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('assistant_api_key', sa.String(), nullable=True))
