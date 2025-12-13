from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from alembic.config import Config
from alembic import command
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./wallet.db")
SQL_ECHO = os.getenv("SQL_ECHO", "").lower() in {"1", "true", "yes", "on", "debug"}
SKIP_MIGRATIONS = os.getenv("SKIP_MIGRATIONS", "").lower() in {"1", "true", "yes", "on"}

engine = create_async_engine(DATABASE_URL, echo=SQL_ECHO)

async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def run_migrations():
    """Run alembic migrations to head."""
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


async def init_db():
    # Skip migrations when SKIP_MIGRATIONS=1 (e.g., E2E tests with pre-created schema)
    if SKIP_MIGRATIONS:
        return
    # Run alembic migrations instead of create_all
    # This ensures schema matches migrations, not just models
    run_migrations()


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
