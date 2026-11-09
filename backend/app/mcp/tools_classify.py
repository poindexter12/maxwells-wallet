"""Read-only MCP tools for classification suggestions and rule mining."""

from __future__ import annotations

import os
from typing import Any, Sequence

from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.mcp.context import require_scope, tool_session
from app.mcp.server import mcp_server
from app.orm import Tag, TagRule, Transaction
from app.services.classification import (
    ClassifierError,
    LocalClassifier,
    TxnFeatures,
    classifier_status as service_classifier_status,
    get_classifier,
)
from app.services.classification.rule_mining import mine_rule_suggestions


def _clamp(value: int, default: int, maximum: int) -> int:
    return max(1, min(value if value > 0 else default, maximum))


def _features(transaction: Transaction) -> TxnFeatures:
    return TxnFeatures(
        id=transaction.id,
        merchant=transaction.merchant,
        description=transaction.description,
        amount=transaction.amount,
        account_source=transaction.account_source,
        date=transaction.date,
    )


@mcp_server.tool()
async def suggest_tags(
    transaction_ids: list[int] | None = None, limit: int = 50, min_confidence: float = 0.0
) -> dict[str, Any]:
    """Suggest bucket tags without writing.

    Show suggestions to the user, then use add_tag_to_transactions or set_bucket with
    dry_run=True before applying for real. With the jev provider, merchant, description,
    and amount are sent to a third party.
    """
    require_scope("read")
    if transaction_ids is not None and len(transaction_ids) > 100:
        raise ToolError("transaction_ids may contain at most 100 IDs.")
    requested_ids = list(dict.fromkeys(transaction_ids or []))
    selected_limit = _clamp(limit, 50, 100)
    threshold = max(0.0, min(min_confidence, 1.0))
    async with tool_session() as session:
        transaction_stmt = select(Transaction).options(selectinload(Transaction.tags))
        if transaction_ids is not None:
            transaction_stmt = transaction_stmt.where(Transaction.id.in_(requested_ids))
        else:
            transaction_stmt = transaction_stmt.where(~Transaction.tags.any(Tag.namespace == "bucket")).limit(selected_limit)
        transactions = (await session.execute(
            transaction_stmt.order_by(Transaction.date.desc(), Transaction.id.desc())
        )).scalars().all()
        labels = [
            f"bucket:{tag.value}"
            for tag in (await session.execute(select(Tag).where(Tag.namespace == "bucket"))).scalars().all()
        ]
        rules = (await session.execute(select(TagRule).where(TagRule.enabled.is_(True)))).scalars().all()
    if not labels:
        raise ToolError("No bucket tags exist. Create bucket tags before requesting classification suggestions.")

    classifier = get_classifier()
    if isinstance(classifier, LocalClassifier):
        classifier = LocalClassifier(rules)
    try:
        classified = await classifier.classify([_features(transaction) for transaction in transactions], labels)
    except ClassifierError as exc:
        raise ToolError(f"Classifier '{classifier.name}' could not provide suggestions.") from exc

    transaction_by_id = {transaction.id: transaction for transaction in transactions}
    suggestions = []
    suggested_ids = set()
    for suggestion in classified:
        transaction = transaction_by_id.get(suggestion.transaction_id)
        if transaction is None or suggestion.confidence < threshold:
            continue
        suggested_ids.add(transaction.id)
        suggestions.append(
            {
                "transaction_id": transaction.id,
                "merchant": transaction.merchant,
                "description": transaction.description,
                "amount": transaction.amount,
                "date": transaction.date.isoformat(),
                "suggested_tag": suggestion.tag,
                "confidence": suggestion.confidence,
                "source": suggestion.source,
                "rationale": suggestion.rationale,
            }
        )
    found_ids = set(transaction_by_id)
    return {
        "provider": classifier.name,
        "suggestions": suggestions,
        "unclassified_ids": [transaction.id for transaction in transactions if transaction.id not in suggested_ids],
        "not_found_ids": [transaction_id for transaction_id in requested_ids if transaction_id not in found_ids],
    }


@mcp_server.tool()
async def suggest_rules(min_support: int = 3, limit: int = 20) -> dict[str, Any]:
    """Mine repeatable rule conditions without writing.

    Show proposals to the user, then use preview_rule to confirm matches, create_rule,
    apply_rules(dry_run=True), and finally apply_rules after approval.
    """
    require_scope("read")
    async with tool_session() as session:
        uncategorized = (await session.execute(
            select(Transaction)
            .options(selectinload(Transaction.tags))
            .where(~Transaction.tags.any(Tag.namespace == "bucket"))
            .order_by(Transaction.date.desc(), Transaction.id.desc())
        )).scalars().all()
        candidate_merchants = {transaction.merchant for transaction in uncategorized if transaction.merchant}
        tagged_transactions: Sequence[Transaction] = []
        if candidate_merchants:
            tagged_transactions = (await session.execute(
                select(Transaction)
                .options(selectinload(Transaction.tags))
                .where(Transaction.merchant.in_(candidate_merchants))
                .where(Transaction.tags.any(Tag.namespace == "bucket"))
            )).scalars().all()
        rules = (await session.execute(select(TagRule))).scalars().all()
    return {
        "suggestions": mine_rule_suggestions(
            uncategorized,
            rules,
            min_support=_clamp(min_support, 3, 100),
            limit=_clamp(limit, 20, 100),
            tagged_transactions=tagged_transactions,
        )
    }


@mcp_server.tool()
async def classifier_status() -> dict[str, Any]:
    """Show classifier availability without writing or exposing credentials."""
    require_scope("read")
    requested_provider = os.getenv("CLASSIFIER_PROVIDER", settings.classifier_provider).strip().lower()
    jev_configured = bool(os.getenv("JEV_API_KEY", settings.jev_api_key).strip())
    classifier = get_classifier()
    return {
        "provider": classifier.name,
        "requested_provider": requested_provider,
        "jev_configured": jev_configured,
        "detail": service_classifier_status(),
        "sends_data_to_third_party": classifier.name == "jev",
    }
