"""
SQLAlchemy query logging middleware for N+1 detection and performance debugging.

Usage:
    ENABLE_QUERY_LOGGING=1 make backend

This middleware logs all SQL queries with execution time to help identify:
- N+1 query patterns (repeated queries with different parameters)
- Slow queries (>500ms)
- Missing indexes (sequential scans on large tables)

Only enable in development - adds overhead and produces verbose logs.
"""

import logging
import time
from typing import Optional
from sqlalchemy import event
from sqlalchemy.engine import Engine
from contextvars import ContextVar

logger = logging.getLogger(__name__)

# Context var to track request ID for correlating queries
request_context: ContextVar[Optional[str]] = ContextVar("request_context", default=None)


def setup_query_logging(engine: Engine) -> None:
    """
    Register SQLAlchemy event listeners for query logging.

    Logs:
    - All queries at DEBUG level
    - Slow queries (>500ms) at INFO level with WARNING flag
    - Query execution time in milliseconds
    - Request context if available (from middleware)
    """

    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, _cursor, _statement, _parameters, _context, _executemany):
        """Record query start time."""
        conn.info.setdefault("query_start_time", []).append(time.time())

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, _cursor, statement, _parameters, _context, _executemany):
        """Log query with execution time."""
        total_time = None

        # Calculate execution time
        if conn.info.get("query_start_time"):
            start = conn.info["query_start_time"].pop(-1)
            total_time = (time.time() - start) * 1000  # Convert to milliseconds

        # Get request context for correlation
        ctx = request_context.get()
        ctx_str = f" [request={ctx}]" if ctx else ""

        # Format query (collapse whitespace for readability)
        formatted_query = " ".join(statement.split())

        # Log level based on execution time
        if total_time and total_time > 500:
            logger.info(
                f"⚠️  SLOW QUERY ({total_time:.2f}ms){ctx_str}: {formatted_query[:200]}..."
            )
        else:
            time_str = f"{total_time:.2f}ms" if total_time else "N/A"
            logger.debug(
                f"Query ({time_str}){ctx_str}: {formatted_query[:200]}..."
            )


def set_request_context(request_id: str) -> None:
    """Set request context for query correlation."""
    request_context.set(request_id)


def clear_request_context() -> None:
    """Clear request context after request completes."""
    request_context.set(None)
