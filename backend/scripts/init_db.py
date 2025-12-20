"""
Initialize database schema by creating all tables from SQLAlchemy Base metadata.

This ensures base tables exist before Alembic migrations run.
Migrations only add/alter columns on existing tables.

Usage:
    python -m scripts.init_db
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine

from app.orm import Base
# Import all models to register them with Base.metadata
import app.orm  # noqa: F401


async def init_db():
    """Create all tables from SQLAlchemy Base metadata."""
    database_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./wallet.db")
    print(f"Initializing database: {database_url}")

    engine = create_async_engine(database_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await engine.dispose()
    print("Database schema created successfully.")


def main():
    asyncio.run(init_db())


if __name__ == "__main__":
    main()
