"""Adapter for TypeSafe AI's hosted Jev System One API.

The documented API accepts ``POST /v1/systemone`` with a JSON ``state``, a
``model`` name, and named ``choice`` questions. Each question's ``criteria`` is
a caller-provided mapping of option names to descriptions. The service returns
an ``answers`` mapping with the selected ``choice`` and ``confidence``.

The public documentation does not establish API rate limits, data retention,
or a feedback API. This adapter therefore keeps Jev opt-in and confines wire
assumptions to :meth:`_build_request` and :meth:`_parse_response`. It sends no
transaction IDs: question names are opaque per-request indexes and the feature
state contains only merchant, description, amount, date, and account source.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

import httpx

from .base import ClassifierError, Suggestion, TxnFeatures

_TIMEOUT = httpx.Timeout(connect=10.0, read=30.0, write=30.0, pool=10.0)
_MAX_LABELS = 255


class JevClassifier:
    """Classify transactions through the hosted Jev System One choice API."""

    name = "jev"

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.typesafe.ai",
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._url = f"{base_url.rstrip('/')}/v1/systemone"
        self._transport = transport

    async def classify(self, txns: Sequence[TxnFeatures], labels: Sequence[str]) -> list[Suggestion]:
        """Return complete Jev suggestions, filtered to the supplied labels."""
        if not txns or not labels:
            return []

        suggestions: list[Suggestion] = []
        for label_batch in _batches(list(dict.fromkeys(labels)), _MAX_LABELS):
            request, indexes = self._build_request(txns, label_batch)
            response = await self._post(request)
            suggestions.extend(self._parse_response(response, indexes, set(label_batch)))
        return _best_suggestions(suggestions)

    def _build_request(
        self, txns: Sequence[TxnFeatures], labels: Sequence[str]
    ) -> tuple[dict[str, Any], dict[str, int]]:
        """Build the documented System One choice request using opaque indexes."""
        indexes: dict[str, int] = {}
        questions: dict[str, dict[str, Any]] = {}
        state: list[dict[str, str | float | None]] = []
        criteria = {label: f"Existing wallet label: {label}" for label in labels}

        for index, txn in enumerate(txns):
            question = f"q{index}"
            indexes[question] = txn.id
            state.append(
                {
                    "merchant": txn.merchant,
                    "description": txn.description,
                    "amount": txn.amount,
                    "date": txn.date.isoformat(),
                    "account_source": txn.account_source,
                }
            )
            questions[question] = {
                "type": "choice",
                "instructions": (
                    f"The state is a JSON array of transactions. Choose the best existing "
                    f"wallet label for the transaction at zero-based index {index}."
                ),
                "criteria": criteria,
            }

        return (
            {
                "state": json.dumps(state, separators=(",", ":")),
                "model": "jev-latest",
                "questions": questions,
            },
            indexes,
        )

    def _parse_response(
        self, payload: Any, indexes: dict[str, int], labels: set[str]
    ) -> list[Suggestion]:
        """Parse the documented answer mapping or raise a typed payload error."""
        if not isinstance(payload, dict) or not isinstance(payload.get("answers"), dict):
            raise ClassifierError("Jev returned an invalid response payload.")

        answers = payload["answers"]
        suggestions: list[Suggestion] = []
        for question, transaction_id in indexes.items():
            answer = answers.get(question)
            if not isinstance(answer, dict):
                raise ClassifierError("Jev response omitted an expected answer.")
            choice = answer.get("choice")
            confidence = answer.get("confidence")
            if not isinstance(choice, str) or choice not in labels:
                continue
            if not isinstance(confidence, (int, float)) or not 0.0 <= confidence <= 1.0:
                raise ClassifierError("Jev response contained an invalid confidence.")
            suggestions.append(
                Suggestion(
                    transaction_id=transaction_id,
                    tag=choice,
                    confidence=float(confidence),
                    source="jev",
                )
            )
        return suggestions

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT, transport=self._transport) as client:
                for attempt in range(2):
                    response = await client.post(self._url, json=payload, headers=headers)
                    if response.status_code != 429 and response.status_code < 500:
                        break
                    if attempt == 1:
                        raise ClassifierError(f"Jev API error {response.status_code}.")
                else:  # pragma: no cover - loop always breaks or raises
                    raise ClassifierError("Jev request did not complete.")
        except httpx.TimeoutException as error:
            raise ClassifierError("Jev request timed out.") from error
        except httpx.HTTPError as error:
            raise ClassifierError("Jev request failed.") from error

        if response.status_code >= 400:
            raise ClassifierError(f"Jev API error {response.status_code}.")
        try:
            body = response.json()
        except ValueError as error:
            raise ClassifierError("Jev returned invalid JSON.") from error
        if not isinstance(body, dict):
            raise ClassifierError("Jev returned an invalid response payload.")
        return body


def _batches(values: list[str], size: int) -> list[list[str]]:
    """Split values into the API's documented maximum choice criteria size."""
    return [values[index : index + size] for index in range(0, len(values), size)]


def _best_suggestions(suggestions: Sequence[Suggestion]) -> list[Suggestion]:
    """Keep the highest-confidence label if labels had to be chunked."""
    by_transaction: dict[int, Suggestion] = {}
    for suggestion in suggestions:
        previous = by_transaction.get(suggestion.transaction_id)
        if previous is None or suggestion.confidence > previous.confidence:
            by_transaction[suggestion.transaction_id] = suggestion
    return list(by_transaction.values())
