"""add_merchant_aliases

Revision ID: 79d69775547d
Revises: 59bd28abb36b
Create Date: 2025-11-29 21:38:25.297501

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '79d69775547d'
down_revision = '59bd28abb36b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('merchant_aliases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('pattern', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('canonical_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('match_type', sa.Enum('exact', 'contains', 'regex', name='merchantaliasmatchtype'), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('match_count', sa.Integer(), nullable=False),
        sa.Column('last_matched_date', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_merchant_aliases_canonical_name'), 'merchant_aliases', ['canonical_name'], unique=False)
    op.create_index(op.f('ix_merchant_aliases_pattern'), 'merchant_aliases', ['pattern'], unique=False)
    op.create_index(op.f('ix_merchant_aliases_priority'), 'merchant_aliases', ['priority'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_merchant_aliases_priority'), table_name='merchant_aliases')
    op.drop_index(op.f('ix_merchant_aliases_pattern'), table_name='merchant_aliases')
    op.drop_index(op.f('ix_merchant_aliases_canonical_name'), table_name='merchant_aliases')
    op.drop_table('merchant_aliases')
