"""Content hashing utilities for transaction deduplication"""
import hashlib
from datetime import date as date_type
from typing import Optional


def compute_transaction_content_hash(
    date: date_type,
    amount: float,
    description: str,
    account_source: str,
    include_account: bool = True
) -> str:
    """
    Compute SHA256 content hash for a transaction.

    The hash is computed from normalized transaction fields:
    - date: ISO format (YYYY-MM-DD)
    - amount: rounded to 2 decimal places
    - description: lowercase, stripped whitespace
    - account_source: lowercase, stripped whitespace (if include_account=True)

    Args:
        date: Transaction date
        amount: Transaction amount
        description: Transaction description
        account_source: Account source identifier
        include_account: If True, include account_source in hash (default).
                        If False, exclude account for cross-account duplicate detection.

    Returns:
        Hexadecimal SHA256 hash string (64 characters)
    """
    # Normalize inputs
    date_str = date.isoformat()  # YYYY-MM-DD format
    amount_str = f"{amount:.2f}"  # Round to 2 decimal places
    description_normalized = description.lower().strip()

    # Create hash input: with or without account_source
    if include_account:
        account_source_normalized = account_source.lower().strip()
        hash_input = f"{date_str}|{amount_str}|{description_normalized}|{account_source_normalized}"
    else:
        hash_input = f"{date_str}|{amount_str}|{description_normalized}"

    # Compute SHA256 hash
    hash_obj = hashlib.sha256(hash_input.encode('utf-8'))
    return hash_obj.hexdigest()


def compute_transaction_hash_from_dict(
    txn_data: dict,
    include_account: bool = True
) -> Optional[str]:
    """
    Compute content hash from a transaction dictionary.

    Convenience function for computing hash from parsed CSV or API data.

    Args:
        txn_data: Dictionary with keys: date, amount, description, account_source
        include_account: If True, include account_source in hash (default).
                        If False, exclude account for cross-account duplicate detection.

    Returns:
        Hexadecimal SHA256 hash string, or None if required fields are missing
    """
    try:
        return compute_transaction_content_hash(
            date=txn_data['date'],
            amount=txn_data['amount'],
            description=txn_data['description'],
            account_source=txn_data['account_source'],
            include_account=include_account
        )
    except (KeyError, TypeError, AttributeError):
        return None
