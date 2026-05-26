"""In-memory TTL stores for assistant conversations and pending proposals.

Single-user, local app: in-memory is sufficient (state is lost on restart,
which is fine for ephemeral chat sessions). Two things are kept server-side:

- **Conversations** — the tokenized neutral history plus the conversation's
  tokenizer. Keeping the tokenizer server-side means the model only ever sees
  tokens across turns, and replies are detokenized only for display.
- **Proposals** — approved-action plans assembled during chat. Stored with the
  already-detokenized (real) arguments so /execute never needs the tokenizer,
  and re-validated against the tool allowlist before running.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Generic, Optional, TypeVar

T = TypeVar("T")


@dataclass
class _Entry(Generic[T]):
    value: T
    expires_at: float


class TTLStore(Generic[T]):
    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._items: dict[str, _Entry[T]] = {}

    def _purge(self) -> None:
        now = time.monotonic()
        expired = [k for k, e in self._items.items() if e.expires_at <= now]
        for k in expired:
            del self._items[k]

    def put(self, value: T, key: Optional[str] = None) -> str:
        self._purge()
        key = key or uuid.uuid4().hex
        self._items[key] = _Entry(value=value, expires_at=time.monotonic() + self._ttl)
        return key

    def get(self, key: str) -> Optional[T]:
        self._purge()
        entry = self._items.get(key)
        return entry.value if entry else None

    def delete(self, key: str) -> None:
        self._items.pop(key, None)


@dataclass
class Conversation:
    """Server-side state for a chat session."""

    history: list[dict] = field(default_factory=list)  # neutral, tokenized
    tokenizer_map: dict[str, dict[str, str]] = field(default_factory=dict)


@dataclass
class ProposedAction:
    """A single pending write, with already-detokenized (real) arguments."""

    tool: str
    arguments: dict[str, Any]
    summary: str


@dataclass
class Proposal:
    actions: list[ProposedAction] = field(default_factory=list)


# Conversations live an hour; proposals expire faster (approve soon or re-ask).
conversations: TTLStore[Conversation] = TTLStore(ttl_seconds=3600)
proposals: TTLStore[Proposal] = TTLStore(ttl_seconds=900)
