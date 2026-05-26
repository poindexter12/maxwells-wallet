"""Reversible PII tokenizer.

Real human-readable identifiers (account names, merchant/payee names, person
names) are replaced with stable, generic tokens before any data reaches the
LLM, and mapped back afterwards. Tokens are deterministic *within a
conversation*: the same real value always yields the same token, so the model
can reason about it ("you spend most at Merchant 3") without ever seeing it.

What is NOT tokenized (and why it is safe to send):
- numeric IDs (transaction/account/budget/dashboard ids) — opaque, not PII, and
  passing them through verbatim makes approved actions execute against the real
  record with zero ambiguity.
- amounts and dates — figures, not identifying on their own.

Generic labels ("Merchant 1") are used rather than fake names: they fully
anonymize, can never be mistaken for a real value, and round-trip exactly.

The tokenizer is serializable (``to_dict``/``from_dict``) so it can be persisted
with a conversation and reused across turns and when executing an approved plan.
"""

from __future__ import annotations

from typing import Optional

# Kinds of PII we tokenize, mapped to the human-readable label used in tokens.
_LABELS: dict[str, str] = {
    "account": "Account",
    "merchant": "Merchant",
    "person": "Person",
}
_DEFAULT_KIND = "merchant"


class Tokenizer:
    """Bidirectional map between real PII values and stable tokens."""

    def __init__(self, forward: Optional[dict[str, dict[str, str]]] = None) -> None:
        # forward: kind -> {real_value: token}
        self._forward: dict[str, dict[str, str]] = {kind: {} for kind in _LABELS}
        # reverse: token -> real_value (flat; tokens are globally unique)
        self._reverse: dict[str, str] = {}
        if forward:
            for kind, mapping in forward.items():
                bucket = self._forward.setdefault(kind, {})
                for real, token in mapping.items():
                    bucket[real] = token
                    self._reverse[token] = real

    def tokenize(self, value: Optional[str], kind: str = _DEFAULT_KIND) -> Optional[str]:
        """Return a stable token for ``value``. Empty/None values pass through."""
        if value is None:
            return None
        text = str(value)
        if not text.strip():
            return text
        if kind not in self._forward:
            kind = _DEFAULT_KIND
        bucket = self._forward[kind]
        existing = bucket.get(text)
        if existing is not None:
            return existing
        token = f"{_LABELS[kind]} {len(bucket) + 1}"
        bucket[text] = token
        self._reverse[token] = text
        return token

    def detokenize(self, text: Optional[str]) -> Optional[str]:
        """Replace any known tokens in ``text`` with their real values.

        Tokens are substituted longest-first so that "Merchant 1" never
        corrupts "Merchant 10".
        """
        if not text:
            return text
        result = text
        for token in sorted(self._reverse, key=len, reverse=True):
            if token in result:
                result = result.replace(token, self._reverse[token])
        return result

    def resolve(self, token: str) -> Optional[str]:
        """Return the real value for an exact token, or None if unknown."""
        return self._reverse.get(token)

    def to_dict(self) -> dict[str, dict[str, str]]:
        """Serialize the forward map for persistence with a conversation."""
        return {kind: dict(mapping) for kind, mapping in self._forward.items()}

    @classmethod
    def from_dict(cls, data: Optional[dict[str, dict[str, str]]]) -> "Tokenizer":
        return cls(forward=data)

    def __len__(self) -> int:
        return len(self._reverse)
