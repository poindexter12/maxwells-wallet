"""Deterministic, local rule proposals based on repeated uncategorized transactions."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Sequence

from app.orm import TagRule, Transaction
from app.routers.tag_rules import match_rule
from app.tag_inference import normalize_text


def _group_key(transaction: Transaction) -> tuple[str, str]:
    merchant = normalize_text(transaction.merchant or "").strip()
    if merchant:
        return "merchant", merchant
    description = normalize_text(transaction.description or "").strip()
    return "description", " ".join(description.split()[:4])


def _bucket_agreement(transactions: Sequence[Transaction], merchant_key: str) -> str | None:
    buckets: Counter[str] = Counter()
    for transaction in transactions:
        if normalize_text(transaction.merchant or "").strip() != merchant_key:
            continue
        buckets.update(f"bucket:{tag.value}" for tag in transaction.tags if tag.namespace == "bucket")
    if not buckets:
        return None
    tag, count = buckets.most_common(1)[0]
    return tag if count >= 3 and count / sum(buckets.values()) >= 0.8 else None


def mine_rule_suggestions(
    transactions: Sequence[Transaction], rules: Sequence[TagRule], *, min_support: int, limit: int
) -> list[dict[str, Any]]:
    """Return rule payloads whose conditions reproduce each proposed support group."""
    uncategorized = [
        transaction for transaction in transactions if not any(tag.namespace == "bucket" for tag in transaction.tags)
    ]
    groups: dict[tuple[str, str], list[Transaction]] = defaultdict(list)
    for transaction in uncategorized:
        key = _group_key(transaction)
        if key[1]:
            groups[key].append(transaction)

    proposals: list[dict[str, Any]] = []
    for (kind, value), group in groups.items():
        if len(group) < min_support or any(match_rule(transaction, rule) for rule in rules if rule.enabled for transaction in group):
            continue
        accounts = {transaction.account_source for transaction in group}
        conditions: dict[str, Any] = {
            "merchant_pattern" if kind == "merchant" else "description_pattern": value,
            "match_all": bool(len(accounts) == 1),
        }
        if len(accounts) == 1:
            conditions["account_source"] = next(iter(accounts))
        support_set = [transaction.id for transaction in group]
        proposals.append(
            {
                "conditions": conditions,
                "support": len(support_set),
                "sample_transaction_ids": support_set[:3],
                "suggested_tag": _bucket_agreement(transactions, value) if kind == "merchant" else None,
            }
        )
    return sorted(proposals, key=lambda proposal: (-proposal["support"], proposal["sample_transaction_ids"]))[:limit]
