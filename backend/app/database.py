from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from alembic.config import Config
from alembic import command
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./wallet.db")

engine = create_async_engine(DATABASE_URL, echo=True)

async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

def run_migrations():
    """Run alembic migrations to head."""
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")

async def init_db():
    # Run alembic migrations instead of create_all
    # This ensures schema matches migrations, not just models
    run_migrations()

async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
