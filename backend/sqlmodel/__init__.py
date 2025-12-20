"""
Compatibility shim for SQLModel migration files.

This module provides the minimal SQLModel-compatible types needed
for historical Alembic migrations to continue working after
migrating to pure SQLAlchemy.

DO NOT USE IN NEW CODE - use app.orm and app.schemas instead.
"""

from . import sql  # noqa: F401
