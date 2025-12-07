"""
Cursor-based pagination utilities for efficient deep pagination.

Cursors encode (date, id) pairs for keyset pagination, which:
- Maintains O(1) performance regardless of page depth
- Provides stable results even when data changes
- Works efficiently with date-ordered transaction queries
"""

import base64
from datetime import date
from typing import Optional, Tuple


def encode_cursor(txn_date: date, txn_id: int) -> str:
    """Encode a (date, id) pair into an opaque cursor string."""
    cursor_data = f"{txn_date.isoformat()}|{txn_id}"
    return base64.urlsafe_b64encode(cursor_data.encode()).decode()


def decode_cursor(cursor: str) -> Optional[Tuple[date, int]]:
    """
    Decode a cursor string back to (date, id) pair.

    Returns None if cursor is invalid.
    """
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode()).decode()
        date_str, id_str = decoded.split("|", 1)
        return date.fromisoformat(date_str), int(id_str)
    except (ValueError, UnicodeDecodeError):
        return None
