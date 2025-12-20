"""
Tests for ORM relationship loading with SQLAlchemy 2.0.

These tests verify that:
1. lazy="selectin" relationships load correctly
2. Related data is accessible after session operations
3. No N+1 query issues when accessing relationships
"""

import pytest
import pytest_asyncio
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, event

from app.orm import (
    Base,
    Transaction,
    Tag,
    TransactionTag,
    Dashboard,
    DashboardWidget,
)


# ============================================================================
# Test Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def test_engine():
    """Create in-memory database for relationship tests."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncSession:
    """Create test session."""
    async_session = sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session() as session:
        yield session


@pytest.fixture
def query_tracker(test_engine):
    """Track queries executed during a test."""
    queries = []

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    sync_engine = test_engine.sync_engine
    event.listen(sync_engine, "before_cursor_execute", before_cursor_execute)
    yield queries
    event.remove(sync_engine, "before_cursor_execute", before_cursor_execute)


# ============================================================================
# Relationship Loading Tests
# ============================================================================


class TestTransactionTagRelationship:
    """Tests for Transaction <-> Tag many-to-many relationship."""

    async def test_transaction_loads_tags_with_selectin(
        self, test_session: AsyncSession, query_tracker: list
    ):
        """Transaction.tags relationship uses selectin loading."""
        # Setup: Create tag and transaction
        tag = Tag(namespace="bucket", value="groceries")
        test_session.add(tag)
        await test_session.flush()

        txn = Transaction(
            date=date.today(),
            description="Test transaction",
            amount=-50.0,
            account_source="test",
        )
        test_session.add(txn)
        await test_session.flush()

        # Link transaction to tag
        tt = TransactionTag(transaction_id=txn.id, tag_id=tag.id)
        test_session.add(tt)
        await test_session.commit()

        # Clear query tracker
        query_tracker.clear()

        # Load transaction fresh
        result = await test_session.execute(
            select(Transaction).where(Transaction.id == txn.id)
        )
        loaded_txn = result.scalar_one()

        # Access tags - should NOT cause additional query with selectin
        # (selectin loads in the same "round" as the main query)
        tags = loaded_txn.tags
        assert len(tags) == 1
        assert tags[0].value == "groceries"

    async def test_transaction_tags_accessible_after_expunge(
        self, test_session: AsyncSession
    ):
        """Tags remain accessible after transaction is expunged from session."""
        # Setup
        tag = Tag(namespace="bucket", value="dining")
        test_session.add(tag)
        await test_session.flush()

        txn = Transaction(
            date=date.today(),
            description="Dinner",
            amount=-75.0,
            account_source="test",
        )
        test_session.add(txn)
        await test_session.flush()

        tt = TransactionTag(transaction_id=txn.id, tag_id=tag.id)
        test_session.add(tt)
        await test_session.commit()

        # Load fresh and expunge
        result = await test_session.execute(
            select(Transaction).where(Transaction.id == txn.id)
        )
        loaded_txn = result.scalar_one()

        # Access tags before expunge (triggers selectin load)
        _ = loaded_txn.tags

        # Expunge from session
        test_session.expunge(loaded_txn)

        # Should still be accessible (loaded via selectin, not lazy)
        assert len(loaded_txn.tags) == 1
        assert loaded_txn.tags[0].value == "dining"

    async def test_multiple_transactions_no_n_plus_one(
        self, test_session: AsyncSession, query_tracker: list
    ):
        """Loading multiple transactions doesn't cause N+1 for tags."""
        # Setup: Create tags
        tag1 = Tag(namespace="bucket", value="groceries")
        tag2 = Tag(namespace="bucket", value="dining")
        test_session.add_all([tag1, tag2])
        await test_session.flush()

        # Create multiple transactions
        transactions = []
        for i in range(10):
            txn = Transaction(
                date=date.today(),
                description=f"Transaction {i}",
                amount=-10.0 * (i + 1),
                account_source="test",
            )
            transactions.append(txn)
        test_session.add_all(transactions)
        await test_session.flush()

        # Link transactions to tags
        for i, txn in enumerate(transactions):
            tag = tag1 if i % 2 == 0 else tag2
            tt = TransactionTag(transaction_id=txn.id, tag_id=tag.id)
            test_session.add(tt)
        await test_session.commit()

        # Clear tracker
        query_tracker.clear()

        # Load all transactions
        result = await test_session.execute(select(Transaction))
        loaded_transactions = result.scalars().all()

        # Access tags on all transactions
        for txn in loaded_transactions:
            _ = txn.tags

        # With selectin, should be 2 queries:
        # 1. SELECT transactions
        # 2. SELECT tags WHERE transaction_id IN (...)
        # NOT 1 + N queries
        assert len(query_tracker) <= 3, (
            f"Possible N+1: {len(query_tracker)} queries for {len(loaded_transactions)} transactions. "
            f"Expected ~2 queries with selectin loading."
        )


class TestTransactionAccountTagRelationship:
    """Tests for Transaction -> account_tag FK relationship."""

    async def test_transaction_loads_account_tag(self, test_session: AsyncSession):
        """Transaction.account_tag relationship loads correctly."""
        # Setup
        account_tag = Tag(namespace="account", value="chase", description="Chase Checking")
        test_session.add(account_tag)
        await test_session.flush()

        txn = Transaction(
            date=date.today(),
            description="Purchase",
            amount=-100.0,
            account_source="CHASE",
            account_tag_id=account_tag.id,
        )
        test_session.add(txn)
        await test_session.commit()

        # Load fresh
        result = await test_session.execute(
            select(Transaction).where(Transaction.id == txn.id)
        )
        loaded_txn = result.scalar_one()

        # Access account_tag
        assert loaded_txn.account_tag is not None
        assert loaded_txn.account_tag.namespace == "account"
        assert loaded_txn.account_tag.value == "chase"


class TestDashboardWidgetRelationship:
    """Tests for Dashboard <-> DashboardWidget one-to-many relationship."""

    async def test_dashboard_loads_widgets(self, test_session: AsyncSession):
        """Dashboard.widgets relationship loads correctly."""
        # Setup
        dashboard = Dashboard(
            name="Test Dashboard",
            date_range_type="mtd",
            is_default=True,
        )
        test_session.add(dashboard)
        await test_session.flush()

        widgets = [
            DashboardWidget(
                dashboard_id=dashboard.id,
                widget_type="summary",
                position=0,
            ),
            DashboardWidget(
                dashboard_id=dashboard.id,
                widget_type="bucket_pie",
                position=1,
            ),
        ]
        test_session.add_all(widgets)
        await test_session.commit()

        # Load fresh
        result = await test_session.execute(
            select(Dashboard).where(Dashboard.id == dashboard.id)
        )
        loaded_dashboard = result.scalar_one()

        # Access widgets
        assert len(loaded_dashboard.widgets) == 2
        assert {w.widget_type for w in loaded_dashboard.widgets} == {"summary", "bucket_pie"}

    async def test_widget_loads_dashboard(self, test_session: AsyncSession):
        """DashboardWidget.dashboard back-reference loads correctly."""
        # Setup
        dashboard = Dashboard(
            name="Widget Test Dashboard",
            date_range_type="ytd",
        )
        test_session.add(dashboard)
        await test_session.flush()

        widget = DashboardWidget(
            dashboard_id=dashboard.id,
            widget_type="trends",
            position=0,
        )
        test_session.add(widget)
        await test_session.commit()

        # Load widget fresh
        result = await test_session.execute(
            select(DashboardWidget).where(DashboardWidget.id == widget.id)
        )
        loaded_widget = result.scalar_one()

        # Access dashboard
        assert loaded_widget.dashboard is not None
        assert loaded_widget.dashboard.name == "Widget Test Dashboard"

    async def test_multiple_dashboards_no_n_plus_one(
        self, test_session: AsyncSession, query_tracker: list
    ):
        """Loading multiple dashboards doesn't cause N+1 for widgets."""
        # Setup: Create multiple dashboards with widgets
        for i in range(5):
            dashboard = Dashboard(
                name=f"Dashboard {i}",
                date_range_type="mtd",
                position=i,
            )
            test_session.add(dashboard)
            await test_session.flush()

            for j in range(3):
                widget = DashboardWidget(
                    dashboard_id=dashboard.id,
                    widget_type=f"widget_{j}",
                    position=j,
                )
                test_session.add(widget)

        await test_session.commit()

        # Clear tracker
        query_tracker.clear()

        # Load all dashboards
        result = await test_session.execute(select(Dashboard))
        loaded_dashboards = result.scalars().all()

        # Access widgets on all dashboards
        total_widgets = 0
        for dashboard in loaded_dashboards:
            total_widgets += len(dashboard.widgets)

        # Should be 2 queries, not 1 + N
        assert len(query_tracker) <= 3, (
            f"Possible N+1: {len(query_tracker)} queries for {len(loaded_dashboards)} dashboards "
            f"with {total_widgets} total widgets."
        )


class TestLinkedTransactionRelationship:
    """Tests for Transaction -> linked_transaction self-referential relationship."""

    async def test_linked_transaction_loads(self, test_session: AsyncSession):
        """Transaction.linked_transaction relationship loads correctly."""
        # Create transfer pair
        txn1 = Transaction(
            date=date.today(),
            description="Transfer out",
            amount=-500.0,
            account_source="Checking",
            is_transfer=True,
        )
        test_session.add(txn1)
        await test_session.flush()

        txn2 = Transaction(
            date=date.today(),
            description="Transfer in",
            amount=500.0,
            account_source="Savings",
            is_transfer=True,
            linked_transaction_id=txn1.id,
        )
        test_session.add(txn2)
        await test_session.commit()

        # Load the transfer-in transaction
        result = await test_session.execute(
            select(Transaction).where(Transaction.id == txn2.id)
        )
        loaded_txn = result.scalar_one()

        # Access linked transaction
        assert loaded_txn.linked_transaction is not None
        assert loaded_txn.linked_transaction.id == txn1.id
        assert loaded_txn.linked_transaction.amount == -500.0


# ============================================================================
# Edge Cases
# ============================================================================


class TestRelationshipEdgeCases:
    """Edge case tests for relationship loading."""

    async def test_transaction_with_no_tags(self, test_session: AsyncSession):
        """Transaction with no tags returns empty list."""
        txn = Transaction(
            date=date.today(),
            description="No tags",
            amount=-25.0,
            account_source="test",
        )
        test_session.add(txn)
        await test_session.commit()

        result = await test_session.execute(
            select(Transaction).where(Transaction.id == txn.id)
        )
        loaded_txn = result.scalar_one()

        assert loaded_txn.tags == []

    async def test_transaction_with_null_account_tag(self, test_session: AsyncSession):
        """Transaction with no account_tag returns None."""
        txn = Transaction(
            date=date.today(),
            description="No account tag",
            amount=-25.0,
            account_source="test",
            account_tag_id=None,
        )
        test_session.add(txn)
        await test_session.commit()

        result = await test_session.execute(
            select(Transaction).where(Transaction.id == txn.id)
        )
        loaded_txn = result.scalar_one()

        assert loaded_txn.account_tag is None

    async def test_dashboard_with_no_widgets(self, test_session: AsyncSession):
        """Dashboard with no widgets returns empty list."""
        dashboard = Dashboard(
            name="Empty Dashboard",
            date_range_type="mtd",
        )
        test_session.add(dashboard)
        await test_session.commit()

        result = await test_session.execute(
            select(Dashboard).where(Dashboard.id == dashboard.id)
        )
        loaded_dashboard = result.scalar_one()

        assert loaded_dashboard.widgets == []

    async def test_transaction_multiple_tags_same_namespace(
        self, test_session: AsyncSession
    ):
        """Transaction can have multiple tags from same namespace."""
        # Create tags
        tag1 = Tag(namespace="occasion", value="birthday")
        tag2 = Tag(namespace="occasion", value="gift")
        test_session.add_all([tag1, tag2])
        await test_session.flush()

        # Create transaction
        txn = Transaction(
            date=date.today(),
            description="Birthday gift purchase",
            amount=-100.0,
            account_source="test",
        )
        test_session.add(txn)
        await test_session.flush()

        # Link to both tags
        tt1 = TransactionTag(transaction_id=txn.id, tag_id=tag1.id)
        tt2 = TransactionTag(transaction_id=txn.id, tag_id=tag2.id)
        test_session.add_all([tt1, tt2])
        await test_session.commit()

        # Load and verify
        result = await test_session.execute(
            select(Transaction).where(Transaction.id == txn.id)
        )
        loaded_txn = result.scalar_one()

        assert len(loaded_txn.tags) == 2
        tag_values = {t.value for t in loaded_txn.tags}
        assert tag_values == {"birthday", "gift"}
