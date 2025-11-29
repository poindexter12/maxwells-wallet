"""Test configuration and fixtures"""
import pytest
import asyncio
from sqlmodel import SQLModel, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from httpx import AsyncClient, ASGITransport
from typing import AsyncGenerator
import os

from app.main import app
from app.database import get_session
from app.models import Category, Transaction, ImportFormat, Tag, TransactionTag


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def async_engine():
    """Create async engine for tests"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False}
    )

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create async session for tests"""
    async_session_maker = sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session


@pytest.fixture(scope="function")
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with dependency override"""
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield async_session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=True
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def seed_tags(async_session: AsyncSession):
    """Seed default bucket tags and account tags"""
    default_bucket_tags = [
        ("bucket", "none", "Uncategorized"),
        ("bucket", "income", "Income and earnings"),
        ("bucket", "groceries", "Grocery shopping"),
        ("bucket", "dining", "Restaurants and food"),
        ("bucket", "shopping", "General shopping"),
        ("bucket", "utilities", "Bills and utilities"),
        ("bucket", "transportation", "Gas, transit, rideshare"),
        ("bucket", "entertainment", "Entertainment"),
        ("bucket", "healthcare", "Medical expenses"),
        ("bucket", "education", "Education"),
        ("bucket", "housing", "Rent, mortgage"),
        ("bucket", "subscriptions", "Subscriptions"),
        ("bucket", "other", "Other expenses"),
        ("bucket", "savings", "Savings"),
    ]

    # Account tags for filtering tests
    account_tags = [
        ("account", "bofa-1234", "Bank of America Checking"),
        ("account", "amex-5678", "American Express Card"),
        ("account", "chase-9999", "Chase Checking"),
    ]

    # Occasion tags for filtering tests
    occasion_tags = [
        ("occasion", "vacation", "Vacation spending"),
        ("occasion", "holiday", "Holiday spending"),
    ]

    tags = []
    for namespace, value, description in default_bucket_tags + account_tags + occasion_tags:
        tag = Tag(namespace=namespace, value=value, description=description)
        async_session.add(tag)
        tags.append(tag)

    await async_session.commit()
    return tags


@pytest.fixture(scope="function")
async def seed_categories(async_session: AsyncSession, seed_tags):
    """Seed default categories (legacy) - also seeds tags"""
    default_categories = [
        "Income",
        "Groceries",
        "Dining & Coffee",
        "Shopping",
        "Utilities",
        "Transportation",
        "Entertainment",
        "Healthcare",
        "Education",
        "Housing",
        "Subscriptions",
        "Other"
    ]

    for name in default_categories:
        category = Category(name=name)
        async_session.add(category)

    await async_session.commit()
    return default_categories


@pytest.fixture(scope="function")
async def seed_transactions(async_session: AsyncSession, seed_categories):
    """Seed sample transactions with tags and account_tag_id FK"""
    from datetime import date
    from sqlmodel import select

    # Get tag IDs for linking
    tags_result = await async_session.execute(select(Tag))
    tags = {f"{t.namespace}:{t.value}": t for t in tags_result.scalars().all()}

    transactions_data = [
        {
            "date": date(2025, 11, 1),
            "amount": 3500.00,
            "description": "Paycheck Deposit",
            "merchant": "Employer",
            "account_source": "BOFA-1234",
            "category": "Income",
            "reconciliation_status": "matched",
            "reference_id": "tx_income_1",
            "bucket_tag": "bucket:income",
            "account_tag": "account:bofa-1234"
        },
        {
            "date": date(2025, 11, 5),
            "amount": -45.50,
            "description": "Whole Foods Market",
            "merchant": "Whole Foods",
            "account_source": "AMEX-5678",
            "card_member": "JOHN DOE",
            "category": "Groceries",
            "reconciliation_status": "matched",
            "reference_id": "tx_grocery_1",
            "bucket_tag": "bucket:groceries",
            "account_tag": "account:amex-5678"
        },
        {
            "date": date(2025, 11, 10),
            "amount": -12.50,
            "description": "Starbucks",
            "merchant": "Starbucks",
            "account_source": "AMEX-5678",
            "card_member": "JOHN DOE",
            "category": "Dining & Coffee",
            "reconciliation_status": "unreconciled",
            "reference_id": "tx_coffee_1",
            "bucket_tag": "bucket:dining",
            "account_tag": "account:amex-5678"
        },
        {
            "date": date(2025, 11, 15),
            "amount": -199.99,
            "description": "Amazon.com",
            "merchant": "Amazon",
            "account_source": "AMEX-5678",
            "card_member": "JANE DOE",
            "category": "Shopping",
            "reconciliation_status": "unreconciled",
            "reference_id": "tx_shopping_1",
            "bucket_tag": "bucket:shopping",
            "account_tag": "account:amex-5678"
        },
        {
            "date": date(2025, 10, 1),
            "amount": 3500.00,
            "description": "Paycheck Deposit",
            "merchant": "Employer",
            "account_source": "BOFA-1234",
            "category": "Income",
            "reconciliation_status": "matched",
            "reference_id": "tx_income_2",
            "bucket_tag": "bucket:income",
            "account_tag": "account:bofa-1234"
        },
        {
            "date": date(2025, 10, 10),
            "amount": -35.00,
            "description": "Target",
            "merchant": "Target",
            "account_source": "AMEX-5678",
            "card_member": "JOHN DOE",
            "category": "Shopping",
            "reconciliation_status": "matched",
            "reference_id": "tx_shopping_2",
            "bucket_tag": "bucket:shopping",
            "account_tag": "account:amex-5678"
        },
    ]

    created_transactions = []
    for txn_data in transactions_data:
        bucket_tag_key = txn_data.pop("bucket_tag")
        account_tag_key = txn_data.pop("account_tag")

        # Set account_tag_id FK for proper filtering
        if account_tag_key in tags:
            txn_data["account_tag_id"] = tags[account_tag_key].id

        txn = Transaction(**txn_data)
        async_session.add(txn)
        await async_session.flush()

        # Link to bucket tag via junction table
        if bucket_tag_key in tags:
            txn_tag = TransactionTag(transaction_id=txn.id, tag_id=tags[bucket_tag_key].id)
            async_session.add(txn_tag)

        created_transactions.append(txn)

    await async_session.commit()
    return created_transactions
