"""Shared types for transaction classification providers."""

from __future__ import annotations

from datetime import date
from typing import Protocol, Sequence

from pydantic import BaseModel, Field


class TxnFeatures(BaseModel):
    """The minimum transaction data a classifier may inspect."""

    id: int
    merchant: str | None
    description: str
    amount: float
    account_source: str | None
    date: date


class Suggestion(BaseModel):
    """A non-persistent tag suggestion for one transaction."""

    transaction_id: int
    tag: str
    confidence: float = Field(ge=0.0, le=1.0)
    source: str
    rationale: str | None = None


class ClassifierError(RuntimeError):
    """Raised when a classifier cannot provide a complete, valid result."""


class Classifier(Protocol):
    """Interface shared by local and external classification providers."""

    name: str

    async def classify(self, txns: Sequence[TxnFeatures], labels: Sequence[str]) -> list[Suggestion]:
        """Return suggestions restricted to the supplied labels."""
