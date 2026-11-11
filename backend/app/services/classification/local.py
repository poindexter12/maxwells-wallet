"""Deterministic local classifier based on existing rules and tag inference."""

from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from app.orm import TagRule, Transaction
from app.routers.tag_rules import match_rule
from app.tag_inference import infer_bucket_tag

from .base import Suggestion, TxnFeatures


class LocalClassifier:
    """Suggest tags from enabled rules before falling back to bucket inference."""

    name = "local"

    def __init__(self, rules: Sequence[TagRule] | None = None) -> None:
        self._rules = sorted(
            (rule for rule in (rules or ()) if rule.enabled),
            key=lambda rule: rule.priority,
            reverse=True,
        )

    async def classify(self, txns: Sequence[TxnFeatures], labels: Sequence[str]) -> list[Suggestion]:
        """Classify each transaction without mutating database state."""
        valid_labels = set(labels)
        suggestions: list[Suggestion] = []
        for txn in txns:
            rule = next((rule for rule in self._rules if match_rule(cast(Transaction, txn), rule)), None)
            if rule is not None:
                if rule.tag in valid_labels:
                    suggestions.append(
                        Suggestion(
                            transaction_id=txn.id,
                            tag=rule.tag,
                            confidence=0.9,
                            source=f"rule:{rule.id}",
                        )
                    )
                continue

            inferred = infer_bucket_tag(txn.merchant or "", txn.description, txn.amount)
            if inferred and inferred[0][0] in valid_labels:
                tag, confidence = inferred[0]
                suggestions.append(
                    Suggestion(
                        transaction_id=txn.id,
                        tag=tag,
                        confidence=confidence if confidence is not None else 0.5,
                        source="inference",
                    )
                )
        return suggestions
