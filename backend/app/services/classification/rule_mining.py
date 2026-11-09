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


def _common_raw_substring(values: Sequence[str]) -> str | None:
    """Return a case-insensitive substring shared by every value, if useful."""
    normalized_values = [value.lower() for value in values if value]
    if len(normalized_values) != len(values):
        return None
    if len(set(normalized_values)) == 1:
        return values[0]
    shortest = min(normalized_values, key=len)
    for length in range(len(shortest), 2, -1):
        for start in range(len(shortest) - length + 1):
            candidate = shortest[start : start + length]
            if all(candidate in value for value in normalized_values):
                return candidate
    return None


def _rule_pattern(kind: str, group: Sequence[Transaction]) -> str | None:
    if kind == "merchant":
        return _common_raw_substring([transaction.merchant or "" for transaction in group])
    return _common_raw_substring([transaction.description or "" for transaction in group])


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
    transactions: Sequence[Transaction],
    rules: Sequence[TagRule],
    *,
    min_support: int,
    limit: int,
    tagged_transactions: Sequence[Transaction] | None = None,
) -> list[dict[str, Any]]:
    """Return rule payloads whose conditions reproduce each proposed support group."""
    uncategorized = [
        transaction
        for transaction in transactions
        if not any(tag.namespace == "bucket" for tag in transaction.tags)
        and not any(match_rule(transaction, rule) for rule in rules if rule.enabled)
    ]
    groups: dict[tuple[str, str], list[Transaction]] = defaultdict(list)
    for transaction in uncategorized:
        key = _group_key(transaction)
        if key[1]:
            groups[key].append(transaction)

    agreement_transactions = tagged_transactions if tagged_transactions is not None else transactions
    proposals: list[dict[str, Any]] = []
    for (kind, value), group in groups.items():
        if len(group) < min_support:
            continue
        pattern = _rule_pattern(kind, group)
        if pattern is None:
            continue
        accounts = {transaction.account_source for transaction in group}
        conditions: dict[str, Any] = {
            "merchant_pattern" if kind == "merchant" else "description_pattern": pattern,
            "match_all": True,
        }
        if len(accounts) == 1:
            conditions["account_source"] = next(iter(accounts))
        proposal_rule = TagRule(name="MCP suggestion", tag="bucket:pending", **conditions)
        support_transactions = [
            transaction for transaction in uncategorized if match_rule(transaction, proposal_rule)
        ]
        if len(support_transactions) < min_support:
            continue
        support_ids = [transaction.id for transaction in support_transactions]
        proposals.append(
            {
                "conditions": conditions,
                "support": len(support_ids),
                "support_transaction_ids": support_ids,
                "sample_transaction_ids": support_ids[:3],
                "suggested_tag": _bucket_agreement(agreement_transactions, value) if kind == "merchant" else None,
            }
        )
    return sorted(proposals, key=lambda proposal: (-proposal["support"], proposal["sample_transaction_ids"]))[:limit]
