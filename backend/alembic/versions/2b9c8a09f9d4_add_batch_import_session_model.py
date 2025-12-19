"""add batch import session model

Revision ID: 2b9c8a09f9d4
Revises: 4a20f1655011
Create Date: 2025-11-29 15:27:38.811232

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '2b9c8a09f9d4'
down_revision = 'ea943ea0e6ab'  # Fixed: depends on merge migration, not 4a20f1655011
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NOTE: Most tables were moved to root migration 1b7c2fce9b4b
    # This migration now only creates batch_import_sessions and modifies import_sessions

    # batch_import_sessions table (new in this migration)
    op.create_table('batch_import_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('total_files', sa.Integer(), nullable=False),
        sa.Column('imported_files', sa.Integer(), nullable=False),
        sa.Column('total_transactions', sa.Integer(), nullable=False),
        sa.Column('total_duplicates', sa.Integer(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Add batch_import_id to import_sessions
    op.add_column('import_sessions', sa.Column('batch_import_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_import_sessions_batch_import_id'), 'import_sessions', ['batch_import_id'], unique=False)
    # FK constraint enforced at ORM level for SQLite; real FK would be added for Postgres


def downgrade() -> None:
    # Only undo what this migration does (batch_import_sessions and import_sessions column)
    op.drop_index(op.f('ix_import_sessions_batch_import_id'), table_name='import_sessions')
    op.drop_column('import_sessions', 'batch_import_id')
    op.drop_table('batch_import_sessions')
