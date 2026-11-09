"""Focused contracts for MCP classification helpers."""

from datetime import date

from app.orm import Tag, Transaction
from app.services.classification.rule_mining import mine_rule_suggestions


def _transaction(transaction_id: int, merchant: str, *, bucket: str | None = None) -> Transaction:
    transaction = Transaction(
        id=transaction_id,
        date=date(2025, 1, transaction_id),
        amount=-10.0,
        description=f"{merchant} purchase",
        merchant=merchant,
        account_source="checking",
    )
    transaction.tags = [Tag(namespace="bucket", value=bucket)] if bucket else []
    return transaction


def test_rule_mining_proposes_repeat_group_with_tag_agreement():
    transactions = [
        *[_transaction(index, "Coffee Shop") for index in range(1, 4)],
        *[_transaction(index, "Coffee Shop", bucket="dining") for index in range(4, 7)],
    ]

    suggestions = mine_rule_suggestions(transactions, [], min_support=3, limit=20)

    assert suggestions == [{
        "conditions": {"merchant_pattern": "coffee shop", "account_source": "checking", "match_all": True},
        "support": 3,
        "sample_transaction_ids": [1, 2, 3],
        "suggested_tag": "bucket:dining",
    }]


def test_rule_mining_requires_80_percent_tag_agreement():
    transactions = [
        *[_transaction(index, "Coffee Shop") for index in range(1, 4)],
        *[_transaction(index, "Coffee Shop", bucket="dining") for index in range(4, 7)],
        _transaction(7, "Coffee Shop", bucket="shopping"),
    ]

    suggestion = mine_rule_suggestions(transactions, [], min_support=3, limit=20)[0]

    assert suggestion["suggested_tag"] is None
