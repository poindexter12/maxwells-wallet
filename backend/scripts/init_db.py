"""
Initialize database schema by creating all tables from SQLModel metadata.

This ensures base tables exist before Alembic migrations run.
Migrations only add/alter columns on existing tables.

Usage:
    python -m scripts.init_db
"""

import asyncio
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine
import os

# Import all models to register them with SQLModel.metadata
from app.models import (  # noqa: F401
    Tag,
    Transaction,
    TransactionTag,
    Budget,
    Dashboard,
    DashboardWidget,
    TagRule,
    RecurringPattern,
    ImportSession,
    CustomFormatConfig,
    MerchantAlias,
)


async def init_db():
    """Create all tables from SQLModel metadata."""
    database_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/wallet.db")
    print(f"Initializing database: {database_url}")

    engine = create_async_engine(database_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    await engine.dispose()
    print("Database schema created successfully.")


def main():
    asyncio.run(init_db())


if __name__ == "__main__":
    main()
