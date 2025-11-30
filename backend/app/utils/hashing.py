"""Content hashing utilities for transaction deduplication"""
import hashlib
from datetime import date as date_type
from typing import Optional


def compute_transaction_content_hash(
    date: date_type,
    amount: float,
    description: str,
    account_source: str
) -> str:
    """
    Compute SHA256 content hash for a transaction.

    The hash is computed from normalized transaction fields:
    - date: ISO format (YYYY-MM-DD)
    - amount: rounded to 2 decimal places
    - description: lowercase, stripped whitespace
    - account_source: lowercase, stripped whitespace

    Args:
        date: Transaction date
        amount: Transaction amount
        description: Transaction description
        account_source: Account source identifier

    Returns:
        Hexadecimal SHA256 hash string (64 characters)
    """
    # Normalize inputs
    date_str = date.isoformat()  # YYYY-MM-DD format
    amount_str = f"{amount:.2f}"  # Round to 2 decimal places
    description_normalized = description.lower().strip()
    account_source_normalized = account_source.lower().strip()

    # Create hash input: date|amount|description|account_source
    hash_input = f"{date_str}|{amount_str}|{description_normalized}|{account_source_normalized}"

    # Compute SHA256 hash
    hash_obj = hashlib.sha256(hash_input.encode('utf-8'))
    return hash_obj.hexdigest()


def compute_transaction_hash_from_dict(txn_data: dict) -> Optional[str]:
    """
    Compute content hash from a transaction dictionary.

    Convenience function for computing hash from parsed CSV or API data.

    Args:
        txn_data: Dictionary with keys: date, amount, description, account_source

    Returns:
        Hexadecimal SHA256 hash string, or None if required fields are missing
    """
    try:
        return compute_transaction_content_hash(
            date=txn_data['date'],
            amount=txn_data['amount'],
            description=txn_data['description'],
            account_source=txn_data['account_source']
        )
    except (KeyError, TypeError, AttributeError):
        return None
