"""Shared helpers for report routes (core + analytics)."""

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.orm import Tag, Transaction, TransactionTag


async def get_transaction_tags(session: AsyncSession, transaction_ids: List[int]) -> dict:
    """Helper to get bucket tags for a list of transaction IDs.
    Returns a dict mapping transaction_id -> bucket tag value (or None)
    """
    if not transaction_ids:
        return {}

    result = await session.execute(
        select(TransactionTag.transaction_id, Tag.value)
        .join(Tag)
        .where(and_(TransactionTag.transaction_id.in_(transaction_ids), Tag.namespace == "bucket"))
    )
    return {row[0]: row[1] for row in result.all()}


async def get_transaction_ids_by_buckets(session: AsyncSession, buckets: List[str]) -> set:
    """Get transaction IDs that have any of the specified bucket tags."""
    if not buckets:
        return set()

    result = await session.execute(
        select(TransactionTag.transaction_id).join(Tag).where(and_(Tag.namespace == "bucket", Tag.value.in_(buckets)))
    )
    return {row[0] for row in result.all()}


def filter_transactions_by_accounts(transactions: List[Transaction], accounts: List[str]) -> List[Transaction]:
    """Filter transactions to only those from specified accounts."""
    if not accounts:
        return transactions
    return [txn for txn in transactions if txn.account_source in accounts]


def filter_transactions_by_merchants(transactions: List[Transaction], merchants: List[str]) -> List[Transaction]:
    """Filter transactions to only those from specified merchants."""
    if not merchants:
        return transactions
    # Case-insensitive match
    merchants_lower = [m.lower() for m in merchants]
    return [txn for txn in transactions if txn.merchant and txn.merchant.lower() in merchants_lower]


def parse_filter_param(param: Optional[str]) -> List[str]:
    """Parse comma-separated filter parameter into a list."""
    if not param:
        return []
    return [v.strip() for v in param.split(",") if v.strip()]


async def apply_transaction_filters(
    transactions: List[Transaction],
    session: AsyncSession,
    buckets: Optional[str] = None,
    accounts: Optional[str] = None,
    merchants: Optional[str] = None,
) -> List[Transaction]:
    """Apply bucket, account, and merchant filters to a list of transactions."""
    # Filter by buckets
    bucket_list = parse_filter_param(buckets)
    if bucket_list:
        valid_txn_ids = await get_transaction_ids_by_buckets(session, bucket_list)
        transactions = [txn for txn in transactions if txn.id in valid_txn_ids]

    # Filter by accounts
    account_list = parse_filter_param(accounts)
    if account_list:
        transactions = filter_transactions_by_accounts(transactions, account_list)

    # Filter by merchants
    merchant_list = parse_filter_param(merchants)
    if merchant_list:
        transactions = filter_transactions_by_merchants(transactions, merchant_list)

    return transactions
