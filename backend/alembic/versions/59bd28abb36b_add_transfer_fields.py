"""add_transfer_fields

Revision ID: 59bd28abb36b
Revises: 4535a448d09f
Create Date: 2025-11-29 20:23:40.093168

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '59bd28abb36b'
down_revision = '4535a448d09f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add transfer detection fields to transactions
    op.add_column('transactions', sa.Column('is_transfer', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('transactions', sa.Column('linked_transaction_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_transactions_is_transfer'), 'transactions', ['is_transfer'], unique=False)
    op.create_index(op.f('ix_transactions_linked_transaction_id'), 'transactions', ['linked_transaction_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_transactions_linked_transaction_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_is_transfer'), table_name='transactions')
    op.drop_column('transactions', 'linked_transaction_id')
    op.drop_column('transactions', 'is_transfer')
