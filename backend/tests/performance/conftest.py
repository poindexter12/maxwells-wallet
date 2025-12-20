"""
Performance test fixtures for load testing and query analysis.

These fixtures provide:
- Large dataset generation (10k+ transactions)
- Query counting for N+1 detection
- Response time measurement utilities
"""

import random
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.orm import Base

from app.database import get_session
from app.main import app
from app.models import (
    Budget,
    Dashboard,
    DashboardWidget,
    ReconciliationStatus,
    Tag,
    Transaction,
    TransactionTag,
)


# ============================================================================
# Query Counter - Detects N+1 queries
# ============================================================================


@dataclass
class QueryCounter:
    """Counts SQL queries executed during a block of code."""

    queries: list[str] = field(default_factory=list)
    enabled: bool = True

    @property
    def count(self) -> int:
        return len(self.queries)

    def reset(self):
        self.queries.clear()

    def assert_max_queries(self, max_count: int, message: str = ""):
        """Assert that no more than max_count queries were executed."""
        if self.count > max_count:
            query_list = "\n".join(f"  {i + 1}. {q[:100]}..." for i, q in enumerate(self.queries[:20]))
            raise AssertionError(
                f"Expected at most {max_count} queries, but got {self.count}. {message}\n"
                f"First 20 queries:\n{query_list}"
            )


# ============================================================================
# Timing Utilities
# ============================================================================


@dataclass
class TimingResult:
    """Result of a timed operation."""

    duration_ms: float
    query_count: int

    def assert_under(self, max_ms: float, message: str = ""):
        """Assert response time is under threshold."""
        if self.duration_ms > max_ms:
            raise AssertionError(f"Expected response in <{max_ms}ms, got {self.duration_ms:.1f}ms. {message}")


@asynccontextmanager
async def timed_request(query_counter: QueryCounter | None = None):
    """Context manager to time a request and optionally count queries."""
    if query_counter:
        query_counter.reset()

    start = time.perf_counter()
    result = TimingResult(duration_ms=0, query_count=0)

    try:
        yield result
    finally:
        result.duration_ms = (time.perf_counter() - start) * 1000
        if query_counter:
            result.query_count = query_counter.count


# ============================================================================
# Database Fixtures
# ============================================================================

# Use file-based SQLite for more realistic performance testing
PERF_DATABASE_URL = "sqlite+aiosqlite:///./test_perf.db"

# Module-level cache for expensive setup
_engine_cache = None
_session_factory_cache = None
_seeded = False


@pytest_asyncio.fixture
async def perf_engine():
    """Create a file-based SQLite engine for performance tests."""
    global _engine_cache

    if _engine_cache is None:
        _engine_cache = create_async_engine(
            PERF_DATABASE_URL,
            echo=False,  # Set True to see all queries
            future=True,
        )
        async with _engine_cache.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    yield _engine_cache


@pytest_asyncio.fixture
async def perf_session_factory(perf_engine):
    """Create session factory for performance tests."""
    global _session_factory_cache

    if _session_factory_cache is None:
        _session_factory_cache = sessionmaker(
            perf_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory_cache


@pytest_asyncio.fixture
async def perf_session(perf_session_factory) -> AsyncGenerator[AsyncSession, None]:
    """Create a session for a single test."""
    async with perf_session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
def query_counter(perf_engine) -> QueryCounter:
    """Fixture to count queries during a test."""
    counter = QueryCounter()

    # Get the sync engine for event listening
    sync_engine = perf_engine.sync_engine

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if counter.enabled:
            counter.queries.append(statement)

    event.listen(sync_engine, "before_cursor_execute", before_cursor_execute)

    yield counter

    event.remove(sync_engine, "before_cursor_execute", before_cursor_execute)


# ============================================================================
# Test Client with Performance Database
# ============================================================================


@pytest_asyncio.fixture
async def perf_client(perf_session_factory) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client configured to use performance database."""

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with perf_session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


# ============================================================================
# Large Dataset Generation
# ============================================================================

MERCHANTS = [
    ("Whole Foods", "groceries", -50, -200),
    ("Trader Joe's", "groceries", -30, -150),
    ("Safeway", "groceries", -40, -180),
    ("Costco", "groceries", -100, -400),
    ("Kroger", "groceries", -35, -160),
    ("Sprouts", "groceries", -25, -120),
    ("Target", "shopping", -20, -150),
    ("Amazon", "shopping", -10, -500),
    ("Walmart", "shopping", -15, -200),
    ("Best Buy", "shopping", -50, -1000),
    ("Home Depot", "shopping", -30, -400),
    ("Nordstrom", "shopping", -75, -350),
    ("REI", "shopping", -40, -300),
    ("Shell Gas", "transportation", -30, -80),
    ("Chevron", "transportation", -35, -90),
    ("Uber", "transportation", -10, -50),
    ("Lyft", "transportation", -8, -45),
    ("BART", "transportation", -5, -20),
    ("Tesla Supercharger", "transportation", -15, -40),
    ("Netflix", "subscriptions", -15, -20),
    ("Spotify", "subscriptions", -10, -15),
    ("Adobe", "subscriptions", -55, -60),
    ("Apple iCloud", "subscriptions", -3, -10),
    ("YouTube Premium", "subscriptions", -12, -15),
    ("NYT Subscription", "subscriptions", -15, -20),
    ("Chipotle", "dining", -12, -25),
    ("Starbucks", "dining", -5, -15),
    ("Olive Garden", "dining", -30, -80),
    ("McDonald's", "dining", -8, -20),
    ("In-N-Out", "dining", -10, -25),
    ("Sweetgreen", "dining", -15, -20),
    ("Local Restaurant", "dining", -40, -150),
    ("PG&E", "utilities", -100, -300),
    ("Comcast", "utilities", -80, -150),
    ("AT&T", "utilities", -60, -120),
    ("Water Company", "utilities", -40, -100),
    ("Waste Management", "utilities", -30, -60),
    ("CVS Pharmacy", "healthcare", -10, -100),
    ("Kaiser", "healthcare", -50, -500),
    ("Walgreens", "healthcare", -15, -80),
    ("Dentist Office", "healthcare", -100, -400),
    ("United Airlines", "travel", -200, -800),
    ("Marriott", "travel", -150, -400),
    ("Airbnb", "travel", -100, -500),
    ("Delta Airlines", "travel", -250, -900),
    ("Hilton", "travel", -120, -350),
    ("Expedia", "travel", -150, -600),
    ("Planet Fitness", "entertainment", -25, -30),
    ("AMC Theaters", "entertainment", -15, -40),
    ("Steam Games", "entertainment", -10, -60),
    ("Concert Tickets", "entertainment", -50, -300),
]

INCOME_SOURCES = [
    ("Employer Direct Deposit", 3000, 8000),
    ("Freelance Payment", 500, 2000),
    ("Interest Income", 10, 100),
    ("Dividend", 50, 500),
    ("Tax Refund", 500, 3000),
    ("Bonus Payment", 1000, 5000),
    ("Side Gig Payment", 100, 800),
]

# Extended accounts - mix of checking, credit cards, HSA, investment
ACCOUNTS = [
    ("chase_checking", "Chase Checking", None, None),
    ("chase_sapphire", "Chase Sapphire Reserve", 15, 25000.0),
    ("chase_freedom", "Chase Freedom", 20, 10000.0),
    ("bofa_checking", "BofA Checking", None, None),
    ("bofa_rewards", "BofA Rewards Visa", 25, 15000.0),
    ("amex_gold", "Amex Gold", 1, None),  # Pay in full
    ("amex_plat", "Amex Platinum", 1, None),
    ("citi_double", "Citi Double Cash", 10, 12000.0),
    ("capital_one", "Capital One Venture", 5, 20000.0),
    ("discover", "Discover It", 28, 8000.0),
    ("hsa", "HSA Account", None, None),
    ("schwab", "Schwab Brokerage", None, None),
]

# Card member names for multi-user households
CARD_MEMBERS = [
    "JOHN DOE",
    "JANE DOE",
    "JOHN D DOE JR",
    None,  # Some transactions don't have card member
]

# Occasions for tagging special events/trips
OCCASIONS = [
    "summer-vacation-2024",
    "christmas-2024",
    "birthday-party",
    "home-renovation",
    "wedding-gift",
    "business-trip-q1",
    "business-trip-q2",
    "ski-trip",
    "beach-vacation",
    "thanksgiving-2024",
]

# Legacy ACCOUNTS list for backward compatibility with 10k tests
ACCOUNTS_SIMPLE = ["chase", "bofa", "amex", "sapphire", "hsa"]


@pytest_asyncio.fixture
async def seed_large_dataset(perf_session_factory) -> dict[str, Any]:
    """
    Seed database with 10,000+ transactions for performance testing.

    Returns metadata about the seeded data for use in assertions.
    """
    global _seeded

    async with perf_session_factory() as session:
        # Check if already seeded (use global flag for caching)
        from sqlalchemy import select, func

        result = await session.execute(select(func.count()).select_from(Transaction))
        existing_count = result.scalar()

        if _seeded or (existing_count and existing_count >= 10000):
            # Already seeded, return metadata
            return {
                "transaction_count": existing_count,
                "accounts": ACCOUNTS_SIMPLE,
                "date_range": (date.today() - timedelta(days=365), date.today()),
            }

        # Create tags
        buckets = [
            "groceries",
            "dining",
            "utilities",
            "entertainment",
            "transportation",
            "shopping",
            "healthcare",
            "subscriptions",
            "travel",
            "personal",
            "income",
        ]

        bucket_tags = {}
        for bucket in buckets:
            tag = Tag(namespace="bucket", value=bucket)
            session.add(tag)
            bucket_tags[bucket] = tag

        account_tags = {}
        for acc in ACCOUNTS_SIMPLE:
            tag = Tag(namespace="account", value=acc)
            session.add(tag)
            account_tags[acc] = tag

        await session.flush()

        # Generate 10,000+ transactions over 1 year
        transactions = []
        start_date = date.today() - timedelta(days=365)

        for i in range(10500):
            # 90% expenses, 10% income
            if random.random() < 0.9:
                merchant, bucket, min_amt, max_amt = random.choice(MERCHANTS)
                amount = round(random.uniform(min_amt, max_amt), 2)
            else:
                source, min_amt, max_amt = random.choice(INCOME_SOURCES)
                merchant = source
                bucket = "income"
                amount = round(random.uniform(min_amt, max_amt), 2)

            account_name = random.choice(ACCOUNTS_SIMPLE)
            txn_date = start_date + timedelta(days=random.randint(0, 365))

            txn = Transaction(
                date=txn_date,
                description=f"{merchant} purchase",
                merchant=merchant,
                amount=amount,
                account_source=f"{account_name.upper()}-Checking",
                account_tag_id=account_tags[account_name].id,
                category=bucket,  # Use category field for basic categorization
            )
            transactions.append(txn)

            # Batch insert for performance
            if len(transactions) >= 1000:
                session.add_all(transactions)
                await session.flush()
                transactions.clear()

        # Insert remaining
        if transactions:
            session.add_all(transactions)
            await session.flush()

        # Create budgets
        for bucket in ["groceries", "dining", "entertainment", "shopping"]:
            budget = Budget(
                tag=f"bucket:{bucket}",
                amount=500.0,
                period="monthly",
            )
            session.add(budget)

        # Create dashboard with widgets
        dashboard = Dashboard(
            name="Performance Test Dashboard",
            date_range_type="ytd",
            is_default=True,
            position=0,
        )
        session.add(dashboard)
        await session.flush()

        widget_types = ["summary", "bucket_pie", "trends", "top_merchants", "velocity"]
        for i, wtype in enumerate(widget_types):
            widget = DashboardWidget(
                dashboard_id=dashboard.id,
                widget_type=wtype,
                position=i,
                width="half" if wtype != "summary" else "full",
                is_visible=True,
            )
            session.add(widget)

        await session.commit()
        _seeded = True

        return {
            "transaction_count": 10500,
            "accounts": ACCOUNTS_SIMPLE,
            "buckets": buckets,
            "date_range": (start_date, date.today()),
        }


# Module-level cache for stress test
_stress_seeded = False
STRESS_DB_URL = "sqlite+aiosqlite:///./test_stress.db"
_stress_engine_cache = None
_stress_session_factory_cache = None


@pytest_asyncio.fixture
async def stress_engine():
    """Create a separate database for stress tests (50k+ transactions)."""
    global _stress_engine_cache

    if _stress_engine_cache is None:
        _stress_engine_cache = create_async_engine(
            STRESS_DB_URL,
            echo=False,
            future=True,
        )
        async with _stress_engine_cache.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    yield _stress_engine_cache


@pytest_asyncio.fixture
async def stress_session_factory(stress_engine):
    """Create session factory for stress tests."""
    global _stress_session_factory_cache

    if _stress_session_factory_cache is None:
        _stress_session_factory_cache = sessionmaker(
            stress_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _stress_session_factory_cache


@pytest_asyncio.fixture
async def stress_client(stress_session_factory) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client for stress tests."""

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with stress_session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seed_stress_dataset(stress_session_factory) -> dict[str, Any]:
    """
    Seed database with 50,000+ transactions for stress testing.

    Creates realistic, complex data with:
    - 12 different accounts (checking, credit cards, HSA, brokerage)
    - TransactionTag relationships (bucket tags on every transaction)
    - Occasion tags on ~10% of transactions
    - ~2% internal transfers between accounts
    - Multiple card members for multi-user households
    - Various reconciliation statuses
    """
    global _stress_seeded

    async with stress_session_factory() as session:
        from sqlalchemy import select, func

        result = await session.execute(select(func.count()).select_from(Transaction))
        existing_count = result.scalar()

        if _stress_seeded or (existing_count and existing_count >= 50000):
            account_names = [acc[0] for acc in ACCOUNTS]
            return {
                "transaction_count": existing_count,
                "accounts": account_names,
                "date_range": (date.today() - timedelta(days=730), date.today()),
            }

        # Create bucket tags
        buckets = [
            "groceries",
            "dining",
            "utilities",
            "entertainment",
            "transportation",
            "shopping",
            "healthcare",
            "subscriptions",
            "travel",
            "personal",
            "income",
        ]

        bucket_tags = {}
        for i, bucket in enumerate(buckets):
            tag = Tag(namespace="bucket", value=bucket, sort_order=i)
            session.add(tag)
            bucket_tags[bucket] = tag

        # Create account tags with credit card metadata
        account_tags = {}
        for acc_id, acc_name, due_day, credit_limit in ACCOUNTS:
            tag = Tag(
                namespace="account",
                value=acc_id,
                description=acc_name,
                due_day=due_day,
                credit_limit=credit_limit,
            )
            session.add(tag)
            account_tags[acc_id] = tag

        # Create occasion tags
        occasion_tags = {}
        for occasion in OCCASIONS:
            tag = Tag(namespace="occasion", value=occasion)
            session.add(tag)
            occasion_tags[occasion] = tag

        await session.flush()

        # Generate 52,000+ transactions over 2 years
        start_date = date.today() - timedelta(days=730)
        transactions_to_insert = []
        transaction_tag_links = []  # (txn_index, bucket_tag_id, occasion_tag_id or None)
        transfer_pairs = []  # Track transfers to link later

        account_list = list(account_tags.keys())
        reconciliation_statuses = [
            ReconciliationStatus.unreconciled,
            ReconciliationStatus.matched,
            ReconciliationStatus.manually_entered,
        ]
        status_weights = [0.7, 0.25, 0.05]  # 70% unreconciled, 25% matched, 5% manual

        for i in range(52000):
            txn_date = start_date + timedelta(days=random.randint(0, 730))
            account_id = random.choice(account_list)
            account_info = next(a for a in ACCOUNTS if a[0] == account_id)
            card_member = random.choice(CARD_MEMBERS) if account_info[2] else None  # Credit cards have card members
            reconciliation = random.choices(reconciliation_statuses, weights=status_weights)[0]

            # 2% transfers between accounts
            if random.random() < 0.02:
                # Create transfer pair
                other_account = random.choice([a for a in account_list if a != account_id])
                amount = round(random.uniform(100, 2000), 2)

                # Outgoing transfer
                txn = Transaction(
                    date=txn_date,
                    description=f"Transfer to {other_account}",
                    merchant="Internal Transfer",
                    amount=-amount,
                    account_source=account_info[1],
                    account_tag_id=account_tags[account_id].id,
                    card_member=card_member,
                    category="transfer",
                    reconciliation_status=reconciliation,
                    is_transfer=True,
                )
                transactions_to_insert.append(txn)

                # Incoming transfer (will link later)
                other_info = next(a for a in ACCOUNTS if a[0] == other_account)
                txn2 = Transaction(
                    date=txn_date,
                    description=f"Transfer from {account_id}",
                    merchant="Internal Transfer",
                    amount=amount,
                    account_source=other_info[1],
                    account_tag_id=account_tags[other_account].id,
                    category="transfer",
                    reconciliation_status=reconciliation,
                    is_transfer=True,
                )
                transactions_to_insert.append(txn2)
                transfer_pairs.append((len(transactions_to_insert) - 2, len(transactions_to_insert) - 1))
                continue

            # 90% expenses, 10% income
            if random.random() < 0.9:
                merchant, bucket, min_amt, max_amt = random.choice(MERCHANTS)
                amount = round(random.uniform(min_amt, max_amt), 2)
            else:
                source, min_amt, max_amt = random.choice(INCOME_SOURCES)
                merchant = source
                bucket = "income"
                amount = round(random.uniform(min_amt, max_amt), 2)

            txn = Transaction(
                date=txn_date,
                description=f"{merchant} - {random.randint(1000, 9999)}",
                merchant=merchant,
                amount=amount,
                account_source=account_info[1],
                account_tag_id=account_tags[account_id].id,
                card_member=card_member,
                category=bucket,
                reconciliation_status=reconciliation,
            )
            transactions_to_insert.append(txn)

            # Track bucket tag for TransactionTag relationship
            txn_idx = len(transactions_to_insert) - 1
            occasion_tag_id = None
            # ~10% of transactions get an occasion tag
            if random.random() < 0.10:
                occasion_tag_id = random.choice(list(occasion_tags.values())).id
            transaction_tag_links.append((txn_idx, bucket_tags[bucket].id, occasion_tag_id))

            # Batch insert for performance
            if len(transactions_to_insert) >= 2000:
                session.add_all(transactions_to_insert)
                await session.flush()

                # Create TransactionTag entries
                for txn_idx, bucket_tag_id, occ_tag_id in transaction_tag_links:
                    txn = transactions_to_insert[txn_idx]
                    tt = TransactionTag(transaction_id=txn.id, tag_id=bucket_tag_id)
                    session.add(tt)
                    if occ_tag_id:
                        tt_occ = TransactionTag(transaction_id=txn.id, tag_id=occ_tag_id)
                        session.add(tt_occ)

                transactions_to_insert.clear()
                transaction_tag_links.clear()
                await session.flush()

        # Insert remaining transactions
        if transactions_to_insert:
            session.add_all(transactions_to_insert)
            await session.flush()

            for txn_idx, bucket_tag_id, occ_tag_id in transaction_tag_links:
                txn = transactions_to_insert[txn_idx]
                tt = TransactionTag(transaction_id=txn.id, tag_id=bucket_tag_id)
                session.add(tt)
                if occ_tag_id:
                    tt_occ = TransactionTag(transaction_id=txn.id, tag_id=occ_tag_id)
                    session.add(tt_occ)

        # Create budgets for spending categories
        budget_amounts = {
            "groceries": 800,
            "dining": 400,
            "entertainment": 200,
            "shopping": 500,
            "transportation": 300,
            "utilities": 400,
            "healthcare": 200,
            "subscriptions": 100,
        }
        for bucket, amount in budget_amounts.items():
            budget = Budget(
                tag=f"bucket:{bucket}",
                amount=float(amount),
                period="monthly",
            )
            session.add(budget)

        # Create dashboard with widgets
        dashboard = Dashboard(
            name="Stress Test Dashboard",
            date_range_type="ytd",
            is_default=True,
            position=0,
        )
        session.add(dashboard)
        await session.flush()

        widget_types = ["summary", "bucket_pie", "trends", "top_merchants", "velocity"]
        for i, wtype in enumerate(widget_types):
            widget = DashboardWidget(
                dashboard_id=dashboard.id,
                widget_type=wtype,
                position=i,
                width="half" if wtype != "summary" else "full",
                is_visible=True,
            )
            session.add(widget)

        await session.commit()
        _stress_seeded = True

        account_names = [acc[0] for acc in ACCOUNTS]
        return {
            "transaction_count": 52000,
            "accounts": account_names,
            "buckets": buckets,
            "occasions": OCCASIONS,
            "date_range": (start_date, date.today()),
        }


# ============================================================================
# Performance Thresholds
# ============================================================================


class PerfThresholds:
    """Performance thresholds for assertions."""

    # Response time thresholds (milliseconds)
    DASHBOARD_LOAD_MS = 500
    REPORT_GENERATION_MS = 2000
    TRANSACTION_LIST_MS = 200
    TRANSACTION_SEARCH_MS = 500

    # Query count thresholds
    MAX_QUERIES_DASHBOARD = 20
    MAX_QUERIES_REPORT = 15
    MAX_QUERIES_TRANSACTION_LIST = 5
    MAX_QUERIES_TRANSACTION_DETAIL = 3


@pytest.fixture
def thresholds() -> type[PerfThresholds]:
    """Expose thresholds to tests."""
    return PerfThresholds
