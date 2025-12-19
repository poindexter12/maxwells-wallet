"""Initial schema - base tables for v0.3

Revision ID: 1b7c2fce9b4b
Revises:
Create Date: 2025-11-27 13:27:32.864736

This is the initial migration that creates all base tables.
Table creation code moved here from 2b9c8a09f9d4 to fix migration chain.
"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '1b7c2fce9b4b'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create base tables that subsequent migrations depend on

    # Tags table (needed by transactions)
    op.create_table('tags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('namespace', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('value', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('color', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tags_namespace'), 'tags', ['namespace'], unique=False)
    op.create_index(op.f('ix_tags_value'), 'tags', ['value'], unique=False)

    # Transactions table (core table, needed by many migrations)
    op.create_table('transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('merchant', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('account_source', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('account_tag_id', sa.Integer(), nullable=True),
        sa.Column('card_member', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('reconciliation_status', sa.Enum('unreconciled', 'matched', 'manually_entered', 'ignored', name='reconciliationstatus'), nullable=False),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('reference_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(['account_tag_id'], ['tags.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transactions_account_source'), 'transactions', ['account_source'], unique=False)
    op.create_index(op.f('ix_transactions_account_tag_id'), 'transactions', ['account_tag_id'], unique=False)
    op.create_index(op.f('ix_transactions_category'), 'transactions', ['category'], unique=False)
    op.create_index(op.f('ix_transactions_date'), 'transactions', ['date'], unique=False)
    op.create_index(op.f('ix_transactions_merchant'), 'transactions', ['merchant'], unique=False)
    op.create_index(op.f('ix_transactions_reconciliation_status'), 'transactions', ['reconciliation_status'], unique=False)
    op.create_index(op.f('ix_transactions_reference_id'), 'transactions', ['reference_id'], unique=False)

    # Transaction tags junction table
    op.create_table('transaction_tags',
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ),
        sa.PrimaryKeyConstraint('transaction_id', 'tag_id')
    )

    # Categories table (legacy, may be dropped later)
    op.create_table('categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=True)

    # Import formats table
    op.create_table('import_formats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('account_source', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('format_type', sa.Enum('bofa_bank', 'bofa_cc', 'amex_cc', 'unknown', name='importformattype'), nullable=False),
        sa.Column('custom_mappings', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_import_formats_account_source'), 'import_formats', ['account_source'], unique=True)

    # Tag rules table
    op.create_table('tag_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('tag', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('merchant_pattern', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('description_pattern', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('amount_min', sa.Float(), nullable=True),
        sa.Column('amount_max', sa.Float(), nullable=True),
        sa.Column('account_source', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('match_all', sa.Boolean(), nullable=False),
        sa.Column('match_count', sa.Integer(), nullable=False),
        sa.Column('last_matched_date', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tag_rules_priority'), 'tag_rules', ['priority'], unique=False)
    op.create_index(op.f('ix_tag_rules_tag'), 'tag_rules', ['tag'], unique=False)

    # Budgets table
    op.create_table('budgets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('tag', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('period', sa.Enum('monthly', 'yearly', name='budgetperiod'), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('rollover_enabled', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_budgets_tag'), 'budgets', ['tag'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_budgets_tag'), table_name='budgets')
    op.drop_table('budgets')
    op.drop_index(op.f('ix_tag_rules_tag'), table_name='tag_rules')
    op.drop_index(op.f('ix_tag_rules_priority'), table_name='tag_rules')
    op.drop_table('tag_rules')
    op.drop_index(op.f('ix_import_formats_account_source'), table_name='import_formats')
    op.drop_table('import_formats')
    op.drop_index(op.f('ix_categories_name'), table_name='categories')
    op.drop_table('categories')
    op.drop_table('transaction_tags')
    op.drop_index(op.f('ix_transactions_reference_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_reconciliation_status'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_merchant'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_date'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_category'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_account_tag_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_account_source'), table_name='transactions')
    op.drop_table('transactions')
    op.drop_index(op.f('ix_tags_value'), table_name='tags')
    op.drop_index(op.f('ix_tags_namespace'), table_name='tags')
    op.drop_table('tags')
