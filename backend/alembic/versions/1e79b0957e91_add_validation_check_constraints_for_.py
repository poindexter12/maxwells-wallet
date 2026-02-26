"""add validation check constraints for budget and tag

Revision ID: 1e79b0957e91
Revises: 640ad28bea8a
Create Date: 2026-02-26 10:52:00.739632

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1e79b0957e91'
down_revision = '640ad28bea8a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add check constraints for budget amount and tag due_day validation.

    For SQLite: Uses batch operations to recreate tables with constraints.
    For Postgres: Direct ALTER TABLE ADD CONSTRAINT.
    """
    # SQLite requires batch operations for adding constraints
    with op.batch_alter_table("budgets", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "ck_budgets_amount_positive",
            "amount > 0"
        )

    with op.batch_alter_table("tags", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "ck_tags_due_day_range",
            "due_day IS NULL OR (due_day >= 1 AND due_day <= 28)"
        )


def downgrade() -> None:
    """Remove validation check constraints."""
    with op.batch_alter_table("budgets", schema=None) as batch_op:
        batch_op.drop_constraint("ck_budgets_amount_positive", type_="check")

    with op.batch_alter_table("tags", schema=None) as batch_op:
        batch_op.drop_constraint("ck_tags_due_day_range", type_="check")
