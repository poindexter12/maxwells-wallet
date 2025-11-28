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
from app.models import Category, Transaction, ImportFormat


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
async def seed_categories(async_session: AsyncSession):
    """Seed default categories"""
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
    """Seed sample transactions"""
    from datetime import date

    transactions = [
        Transaction(
            date=date(2025, 11, 1),
            amount=3500.00,
            description="Paycheck Deposit",
            merchant="Employer",
            account_source="BOFA-1234",
            category="Income",
            reconciliation_status="matched",
            reference_id="tx_income_1"
        ),
        Transaction(
            date=date(2025, 11, 5),
            amount=-45.50,
            description="Whole Foods Market",
            merchant="Whole Foods",
            account_source="AMEX-5678",
            card_member="JOHN DOE",
            category="Groceries",
            reconciliation_status="matched",
            reference_id="tx_grocery_1"
        ),
        Transaction(
            date=date(2025, 11, 10),
            amount=-12.50,
            description="Starbucks",
            merchant="Starbucks",
            account_source="AMEX-5678",
            card_member="JOHN DOE",
            category="Dining & Coffee",
            reconciliation_status="unreconciled",
            reference_id="tx_coffee_1"
        ),
        Transaction(
            date=date(2025, 11, 15),
            amount=-199.99,
            description="Amazon.com",
            merchant="Amazon",
            account_source="AMEX-5678",
            card_member="JANE DOE",
            category="Shopping",
            reconciliation_status="unreconciled",
            reference_id="tx_shopping_1"
        ),
        Transaction(
            date=date(2025, 10, 1),
            amount=3500.00,
            description="Paycheck Deposit",
            merchant="Employer",
            account_source="BOFA-1234",
            category="Income",
            reconciliation_status="matched",
            reference_id="tx_income_2"
        ),
        Transaction(
            date=date(2025, 10, 10),
            amount=-35.00,
            description="Target",
            merchant="Target",
            account_source="AMEX-5678",
            card_member="JOHN DOE",
            category="Shopping",
            reconciliation_status="matched",
            reference_id="tx_shopping_2"
        ),
    ]

    for txn in transactions:
        async_session.add(txn)

    await async_session.commit()
    return transactions
