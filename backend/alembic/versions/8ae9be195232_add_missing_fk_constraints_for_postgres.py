"""add_missing_fk_constraints_for_postgres

Revision ID: 8ae9be195232
Revises: f29bca4459fc
Create Date: 2025-12-06 08:07:39.862450

Adds FK constraints that were skipped in earlier migrations due to SQLite limitations.
These constraints are required for Postgres and enforce referential integrity at the DB level.

Missing constraints:
- transactions.account_tag_id -> tags.id
- transactions.linked_transaction_id -> transactions.id (self-referential)
- dashboard_widgets.dashboard_id -> dashboards.id
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '8ae9be195232'
down_revision = 'f29bca4459fc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Only apply FK constraints on Postgres - SQLite doesn't support ADD CONSTRAINT
    # and already enforces these at the ORM level
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    # transactions.account_tag_id -> tags.id
    op.create_foreign_key(
        'fk_transactions_account_tag_id',
        'transactions', 'tags',
        ['account_tag_id'], ['id'],
        ondelete='SET NULL'
    )

    # transactions.linked_transaction_id -> transactions.id (self-referential)
    op.create_foreign_key(
        'fk_transactions_linked_transaction_id',
        'transactions', 'transactions',
        ['linked_transaction_id'], ['id'],
        ondelete='SET NULL'
    )

    # dashboard_widgets.dashboard_id -> dashboards.id
    op.create_foreign_key(
        'fk_dashboard_widgets_dashboard_id',
        'dashboard_widgets', 'dashboards',
        ['dashboard_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    op.drop_constraint('fk_dashboard_widgets_dashboard_id', 'dashboard_widgets', type_='foreignkey')
    op.drop_constraint('fk_transactions_linked_transaction_id', 'transactions', type_='foreignkey')
    op.drop_constraint('fk_transactions_account_tag_id', 'transactions', type_='foreignkey')
