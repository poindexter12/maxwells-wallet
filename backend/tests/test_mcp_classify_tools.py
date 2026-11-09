"""MCP endpoint contracts for classification suggestions and rule mining."""

from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.mcp import tools_classify
from app.orm import Tag, TagRule, Transaction, TransactionTag, User
from app.services.api_tokens import create_api_token
from app.services.classification import ClassifierError, Suggestion
from app.services.classification.rule_mining import mine_rule_suggestions
from app.utils.auth import hash_password


def _transaction(transaction_id: int, merchant: str, *, bucket: str | None = None) -> Transaction:
    transaction = Transaction(id=transaction_id, date=date(2025, 1, transaction_id), amount=-10.0,
                              description=f"{merchant} purchase", merchant=merchant, account_source="checking")
    transaction.tags = [Tag(namespace="bucket", value=bucket)] if bucket else []
    return transaction


def test_rule_mining_proposes_repeat_group_with_tag_agreement():
    transactions = [*[_transaction(index, "Coffee Shop") for index in range(1, 4)],
                    *[_transaction(index, "Coffee Shop", bucket="dining") for index in range(4, 7)]]
    suggestion = mine_rule_suggestions(transactions, [], min_support=3, limit=20)[0]
    assert suggestion["conditions"] == {"merchant_pattern": "Coffee Shop", "account_source": "checking", "match_all": True}
    assert suggestion["support"] == 3
    assert suggestion["suggested_tag"] == "bucket:dining"


def test_rule_mining_requires_80_percent_tag_agreement():
    transactions = [*[_transaction(index, "Coffee Shop") for index in range(1, 4)],
                    *[_transaction(index, "Coffee Shop", bucket="dining") for index in range(4, 7)],
                    _transaction(7, "Coffee Shop", bucket="shopping")]
    assert mine_rule_suggestions(transactions, [], min_support=3, limit=20)[0]["suggested_tag"] is None


async def _token(session, scopes=("read",)):
    user = User(username=f"classification-mcp-{uuid4().hex}", password_hash=hash_password("password123"))
    session.add(user)
    await session.commit()
    _, raw = await create_api_token(session, user_id=user.id, name="MCP", scopes=scopes, expires_at=None)
    return {"Authorization": f"Bearer {raw}", "Accept": "application/json, text/event-stream"}


async def _call(client, headers, name, arguments, request_id=2):
    response = await client.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": request_id,
        "method": "tools/call", "params": {"name": name, "arguments": arguments}})
    assert response.status_code == 200
    return response.json()["result"]


async def _initialize(client, headers):
    response = await client.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "pytest", "version": "1"}}})
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_suggest_tags_uses_provider_filters_confidence_and_reports_missing(client, async_session, seed_tags, mcp_running, monkeypatch):
    transactions = [Transaction(date=date(2025, 1, 1), amount=-10, description=f"Purchase {index}", merchant="Shop", account_source="checking") for index in range(60)]
    async_session.add_all(transactions)
    await async_session.commit()
    ids = [transaction.id for transaction in transactions]

    class FakeClassifier:
        name = "fake"
        async def classify(self, features, labels):
            assert len(features) == 60
            assert labels
            return [Suggestion(transaction_id=feature.id, tag="bucket:dining", confidence=0.9 if index else 0.1, source="fake") for index, feature in enumerate(features)]

    monkeypatch.setattr(tools_classify, "get_classifier", lambda: FakeClassifier())
    headers = await _token(async_session)
    async with mcp_running():
        await _initialize(client, headers)
        result = await _call(client, headers, "suggest_tags", {"transaction_ids": ids + [999999], "min_confidence": 0.5})
    content = result["structuredContent"]
    assert content["provider"] == "fake"
    assert len(content["suggestions"]) == 59
    assert content["not_found_ids"] == [999999]
    assert ids[-1] in content["unclassified_ids"]


@pytest.mark.asyncio
async def test_classify_tools_enforce_read_scope_and_keep_database_unchanged(client, async_session, seed_tags, mcp_running):
    transaction = Transaction(date=date(2025, 1, 1), amount=-10, description="McDonald's order", merchant="McDonald's", account_source="checking")
    async_session.add(transaction)
    await async_session.commit()
    before = (
        (await async_session.execute(select(Transaction.id, Transaction.merchant))).all(),
        (await async_session.execute(select(Tag.id, Tag.namespace, Tag.value))).all(),
        (await async_session.execute(select(TransactionTag.transaction_id, TransactionTag.tag_id))).all(),
        (await async_session.execute(select(TagRule.id, TagRule.name))).all(),
    )
    headers = await _token(async_session)
    async with mcp_running():
        await _initialize(client, headers)
        await _call(client, headers, "suggest_tags", {"transaction_ids": [transaction.id]})
        await _call(client, headers, "suggest_rules", {"min_support": 3})
        status = await _call(client, headers, "classifier_status", {})
    assert set(status["structuredContent"]) == {"provider", "requested_provider", "jev_configured", "detail", "sends_data_to_third_party"}
    after = (
        (await async_session.execute(select(Transaction.id, Transaction.merchant))).all(),
        (await async_session.execute(select(Tag.id, Tag.namespace, Tag.value))).all(),
        (await async_session.execute(select(TransactionTag.transaction_id, TransactionTag.tag_id))).all(),
        (await async_session.execute(select(TagRule.id, TagRule.name))).all(),
    )
    assert after == before
    no_read_headers = await _token(async_session, scopes=("write",))
    async with mcp_running():
        await _initialize(client, no_read_headers)
        result = await _call(client, no_read_headers, "classifier_status", {})
    assert result["isError"] is True


@pytest.mark.asyncio
async def test_classifier_error_does_not_expose_secret(client, async_session, seed_tags, mcp_running, monkeypatch):
    transaction = Transaction(date=date(2025, 1, 1), amount=-10, description="Purchase", merchant="Shop", account_source="checking")
    async_session.add(transaction)
    await async_session.commit()
    class FailingClassifier:
        name = "jev"
        async def classify(self, features, labels):
            raise ClassifierError("secret-super-secret")
    monkeypatch.setattr(tools_classify, "get_classifier", lambda: FailingClassifier())
    monkeypatch.setenv("JEV_API_KEY", "secret-super-secret")
    headers = await _token(async_session)
    async with mcp_running():
        await _initialize(client, headers)
        result = await _call(client, headers, "suggest_tags", {"transaction_ids": [transaction.id]})
    assert result["isError"] is True
    assert "jev" in str(result)
    assert "secret-super-secret" not in str(result)
