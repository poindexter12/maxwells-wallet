from datetime import date
import json

import httpx
import pytest

from app.orm import TagRule
from app.services.classification import (
    ClassifierError,
    JevClassifier,
    LocalClassifier,
    TxnFeatures,
    classifier_status,
    get_classifier,
)


def txn(*, merchant: str = "Merchant", description: str = "purchase", amount: float = -10.0) -> TxnFeatures:
    return TxnFeatures(
        id=42,
        merchant=merchant,
        description=description,
        amount=amount,
        account_source="checking",
        date=date(2026, 1, 2),
    )


@pytest.mark.asyncio
async def test_local_classifier_prefers_highest_priority_matching_rule() -> None:
    lower = TagRule(
        id=1,
        tag="bucket:shopping",
        priority=1,
        enabled=True,
        merchant_pattern="acme",
        match_all=False,
    )
    higher = TagRule(
        id=2,
        tag="bucket:groceries",
        priority=2,
        enabled=True,
        merchant_pattern="acme",
        match_all=False,
    )

    suggestions = await LocalClassifier([lower, higher]).classify(
        [txn(merchant="Acme market")], ["bucket:shopping", "bucket:groceries"]
    )

    assert [(item.tag, item.confidence, item.source) for item in suggestions] == [
        ("bucket:groceries", 0.9, "rule:2")
    ]


@pytest.mark.asyncio
async def test_local_classifier_uses_inference_and_drops_unknown_labels() -> None:
    classifier = LocalClassifier()

    suggestions = await classifier.classify([txn(merchant="Whole Foods")], ["bucket:groceries"])
    no_suggestions = await classifier.classify([txn(merchant="Unmatched vendor")], ["bucket:groceries"])

    assert suggestions[0].tag == "bucket:groceries"
    assert suggestions[0].source == "inference"
    assert no_suggestions == []


def test_provider_selection_uses_environment_and_falls_back_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLASSIFIER_PROVIDER", "jev")
    monkeypatch.delenv("JEV_API_KEY", raising=False)

    assert isinstance(get_classifier(), LocalClassifier)
    assert classifier_status() == "local: JEV_API_KEY is not configured; using local classifier"

    monkeypatch.setenv("JEV_API_KEY", "secret-key")

    assert isinstance(get_classifier(), JevClassifier)
    assert classifier_status() == "jev: unverified integration"


@pytest.mark.asyncio
async def test_jev_maps_response_filters_labels_and_hides_transaction_ids() -> None:
    seen: list[httpx.Request] = []

    def responder(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "answers": {
                    "q0": {"type": "choice", "choice": "bucket:groceries", "confidence": 0.8},
                    "q1": {"type": "choice", "choice": "not-an-allowed-label", "confidence": 0.9},
                }
            },
        )

    first = txn(merchant="Whole Foods")
    second = first.model_copy(update={"id": 99})
    classifier = JevClassifier("private-key", transport=httpx.MockTransport(responder))

    suggestions = await classifier.classify([first, second], ["bucket:groceries"])

    assert [(item.transaction_id, item.tag, item.confidence, item.source) for item in suggestions] == [
        (42, "bucket:groceries", 0.8, "jev")
    ]
    wire = json.loads(seen[0].content)
    assert set(wire["questions"]) == {"q0", "q1"}
    assert "id" not in wire["state"]
    assert "42" not in wire["state"]
    assert "99" not in wire["state"]


@pytest.mark.asyncio
async def test_jev_retries_rate_limit_once() -> None:
    attempts = 0

    def responder(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429)
        return httpx.Response(200, json={"answers": {"q0": {"choice": "bucket:groceries", "confidence": 1}}})

    classifier = JevClassifier("private-key", transport=httpx.MockTransport(responder))

    suggestions = await classifier.classify([txn()], ["bucket:groceries"])

    assert attempts == 2
    assert suggestions[0].source == "jev"


@pytest.mark.asyncio
async def test_jev_timeout_raises_typed_error_without_key_in_exception(caplog: pytest.LogCaptureFixture) -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("network timeout", request=request)

    classifier = JevClassifier("private-key", transport=httpx.MockTransport(responder))

    with pytest.raises(ClassifierError, match="timed out") as error:
        await classifier.classify([txn()], ["bucket:groceries"])

    assert "private-key" not in str(error.value)
    assert "private-key" not in caplog.text
