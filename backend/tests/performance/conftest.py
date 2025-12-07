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
from sqlmodel import SQLModel

from app.database import get_session
from app.main import app
from app.models import Budget, Dashboard, DashboardWidget, Tag, Transaction


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
            query_list = "\n".join(f"  {i+1}. {q[:100]}..." for i, q in enumerate(self.queries[:20]))
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
            raise AssertionError(
                f"Expected response in <{max_ms}ms, got {self.duration_ms:.1f}ms. {message}"
            )


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
            await conn.run_sync(SQLModel.metadata.create_all)

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
    ("Target", "shopping", -20, -150),
    ("Amazon", "shopping", -10, -500),
    ("Walmart", "shopping", -15, -200),
    ("Best Buy", "shopping", -50, -1000),
    ("Shell Gas", "transportation", -30, -80),
    ("Chevron", "transportation", -35, -90),
    ("Uber", "transportation", -10, -50),
    ("Lyft", "transportation", -8, -45),
    ("Netflix", "subscriptions", -15, -20),
    ("Spotify", "subscriptions", -10, -15),
    ("Adobe", "subscriptions", -55, -60),
    ("Chipotle", "dining", -12, -25),
    ("Starbucks", "dining", -5, -15),
    ("Olive Garden", "dining", -30, -80),
    ("McDonald's", "dining", -8, -20),
    ("PG&E", "utilities", -100, -300),
    ("Comcast", "utilities", -80, -150),
    ("AT&T", "utilities", -60, -120),
    ("CVS Pharmacy", "healthcare", -10, -100),
    ("Kaiser", "healthcare", -50, -500),
    ("United Airlines", "travel", -200, -800),
    ("Marriott", "travel", -150, -400),
    ("Airbnb", "travel", -100, -500),
]

INCOME_SOURCES = [
    ("Employer Direct Deposit", 3000, 8000),
    ("Freelance Payment", 500, 2000),
    ("Interest Income", 10, 100),
    ("Dividend", 50, 500),
]

ACCOUNTS = ["chase", "bofa", "amex", "sapphire", "hsa"]


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
                "accounts": ACCOUNTS,
                "date_range": (date.today() - timedelta(days=365), date.today()),
            }

        # Create tags
        buckets = ["groceries", "dining", "utilities", "entertainment", "transportation",
                   "shopping", "healthcare", "subscriptions", "travel", "personal", "income"]

        bucket_tags = {}
        for bucket in buckets:
            tag = Tag(namespace="bucket", value=bucket)
            session.add(tag)
            bucket_tags[bucket] = tag

        account_tags = {}
        for acc in ACCOUNTS:
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

            account_name = random.choice(ACCOUNTS)
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
                title=f"Test {wtype.title()}",
                position=i,
                width="half" if wtype != "summary" else "full",
                is_visible=True,
            )
            session.add(widget)

        await session.commit()
        _seeded = True

        return {
            "transaction_count": 10500,
            "accounts": ACCOUNTS,
            "buckets": buckets,
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
