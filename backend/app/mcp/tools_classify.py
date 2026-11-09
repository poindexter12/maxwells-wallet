"""Read-only MCP tools for classification suggestions and rule mining."""

from __future__ import annotations

from typing import Any

from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy import select
from sqlalchemy.orm import selectinload

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
    """Suggest bucket tags without writing. Show suggestions to the user, then use add_tag_to_transactions with dry_run before applying; use apply_rules only after user approval."""
    require_scope("read")
    if transaction_ids is not None and len(transaction_ids) > 100:
        raise ToolError("transaction_ids may contain at most 100 IDs.")
    selected_limit = _clamp(limit, 50, 100)
    threshold = max(0.0, min(min_confidence, 1.0))
    async with tool_session() as session:
        transaction_stmt = select(Transaction).options(selectinload(Transaction.tags))
        if transaction_ids is not None:
            transaction_stmt = transaction_stmt.where(Transaction.id.in_(transaction_ids))
        else:
            transaction_stmt = transaction_stmt.where(~Transaction.tags.any(Tag.namespace == "bucket"))
        transactions = (await session.execute(
            transaction_stmt.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(selected_limit)
        )).scalars().all()
        labels = [
            f"bucket:{tag.value}"
            for tag in (await session.execute(select(Tag).where(Tag.namespace == "bucket"))).scalars().all()
        ]
        rules = (await session.execute(select(TagRule).where(TagRule.enabled.is_(True)))).scalars().all()

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
    return {
        "provider": classifier.name,
        "suggestions": suggestions,
        "unclassified_ids": [transaction.id for transaction in transactions if transaction.id not in suggested_ids],
    }


@mcp_server.tool()
async def suggest_rules(min_support: int = 3, limit: int = 20) -> dict[str, Any]:
    """Mine repeatable tag-rule conditions without writing. Show proposals to the user, then use create_rule with dry_run first and apply_rules only after approval."""
    require_scope("read")
    async with tool_session() as session:
        transactions = (await session.execute(
            select(Transaction).options(selectinload(Transaction.tags)).order_by(Transaction.date.desc(), Transaction.id.desc())
        )).scalars().all()
        rules = (await session.execute(select(TagRule))).scalars().all()
    return {
        "suggestions": mine_rule_suggestions(
            transactions,
            rules,
            min_support=_clamp(min_support, 3, 100),
            limit=_clamp(limit, 20, 100),
        )
    }


@mcp_server.tool()
async def classifier_status() -> dict[str, str]:
    """Show classifier availability without writing. After suggesting tags or rules, show the user and dry-run any write before applying rules."""
    require_scope("read")
    return {"status": service_classifier_status()}
