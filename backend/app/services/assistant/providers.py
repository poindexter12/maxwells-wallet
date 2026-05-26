"""LLM provider abstraction over httpx (no vendor SDKs).

The agent loop speaks a provider-neutral conversation format; each provider
translates it to/from its wire format. A provider call returns an
``AssistantTurn`` (assistant text plus any tool calls); the loop decides what to
do next, so providers stay thin and easy to test.

Neutral history item shapes (list[dict]):
    {"role": "user", "content": str}
    {"role": "assistant", "text": str, "tool_calls": [ToolCall, ...]}
    {"role": "tool", "results": [{"id": str, "name": str, "content": str}, ...]}
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.errors import ErrorCode, bad_request
from app.services.assistant import DEFAULT_MODELS

_TIMEOUT = httpx.Timeout(60.0)
_MAX_TOKENS = 1024


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class AssistantTurn:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)

    @property
    def wants_tools(self) -> bool:
        return bool(self.tool_calls)


class LLMProvider(ABC):
    """Common interface for a single chat completion with tool use."""

    name: str

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    @abstractmethod
    async def complete(self, *, system: str, history: list[dict], tools: list[dict]) -> AssistantTurn:
        """One model turn. May return text, tool calls, or both."""

    @staticmethod
    def _raise(detail: str) -> None:
        raise bad_request(ErrorCode.ASSISTANT_PROVIDER_ERROR, detail)


# ---------------------------------------------------------------------------
# Anthropic (Messages API)
# ---------------------------------------------------------------------------


class AnthropicProvider(LLMProvider):
    name = "anthropic"
    _URL = "https://api.anthropic.com/v1/messages"
    _VERSION = "2023-06-01"

    def _wire_messages(self, history: list[dict]) -> list[dict]:
        messages: list[dict] = []
        for item in history:
            role = item["role"]
            if role == "user":
                messages.append({"role": "user", "content": item["content"]})
            elif role == "assistant":
                blocks: list[dict] = []
                if item.get("text"):
                    blocks.append({"type": "text", "text": item["text"]})
                for call in item.get("tool_calls", []):
                    blocks.append({
                        "type": "tool_use",
                        "id": call.id,
                        "name": call.name,
                        "input": call.arguments,
                    })
                messages.append({"role": "assistant", "content": blocks})
            elif role == "tool":
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": r["id"], "content": r["content"]}
                        for r in item["results"]
                    ],
                })
        return messages

    async def complete(self, *, system: str, history: list[dict], tools: list[dict]) -> AssistantTurn:
        body = {
            "model": self.model,
            "max_tokens": _MAX_TOKENS,
            "system": system,
            "messages": self._wire_messages(history),
            "tools": [
                {"name": t["name"], "description": t["description"], "input_schema": t["parameters"]}
                for t in tools
            ],
        }
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": self._VERSION,
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(self._URL, json=body, headers=headers)
        if resp.status_code >= 400:
            self._raise(f"Anthropic API error {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        turn = AssistantTurn()
        for block in data.get("content", []):
            if block.get("type") == "text":
                turn.text += block.get("text", "")
            elif block.get("type") == "tool_use":
                turn.tool_calls.append(
                    ToolCall(id=block["id"], name=block["name"], arguments=block.get("input") or {})
                )
        return turn


# ---------------------------------------------------------------------------
# OpenAI (Chat Completions API)
# ---------------------------------------------------------------------------


class OpenAIProvider(LLMProvider):
    name = "openai"
    _URL = "https://api.openai.com/v1/chat/completions"

    def _wire_messages(self, system: str, history: list[dict]) -> list[dict]:
        messages: list[dict] = [{"role": "system", "content": system}]
        for item in history:
            role = item["role"]
            if role == "user":
                messages.append({"role": "user", "content": item["content"]})
            elif role == "assistant":
                msg: dict[str, Any] = {"role": "assistant", "content": item.get("text") or None}
                if item.get("tool_calls"):
                    msg["tool_calls"] = [
                        {
                            "id": call.id,
                            "type": "function",
                            "function": {"name": call.name, "arguments": json.dumps(call.arguments)},
                        }
                        for call in item["tool_calls"]
                    ]
                messages.append(msg)
            elif role == "tool":
                for r in item["results"]:
                    messages.append({"role": "tool", "tool_call_id": r["id"], "content": r["content"]})
        return messages

    async def complete(self, *, system: str, history: list[dict], tools: list[dict]) -> AssistantTurn:
        body = {
            "model": self.model,
            "messages": self._wire_messages(system, history),
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t["description"],
                        "parameters": t["parameters"],
                    },
                }
                for t in tools
            ],
            "tool_choice": "auto",
            "max_tokens": _MAX_TOKENS,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(self._URL, json=body, headers=headers)
        if resp.status_code >= 400:
            self._raise(f"OpenAI API error {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message", {})
        turn = AssistantTurn(text=message.get("content") or "")
        for call in message.get("tool_calls") or []:
            fn = call.get("function", {})
            try:
                arguments = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                arguments = {}
            turn.tool_calls.append(ToolCall(id=call.get("id", ""), name=fn.get("name", ""), arguments=arguments))
        return turn


_PROVIDERS: dict[str, type[LLMProvider]] = {
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
}


def build_provider(provider: str, api_key: str, model: str | None) -> LLMProvider:
    """Instantiate the configured provider, defaulting the model if unset."""
    cls = _PROVIDERS.get(provider)
    if cls is None:
        raise bad_request(ErrorCode.ASSISTANT_PROVIDER_ERROR, f"Unsupported provider '{provider}'.")
    return cls(api_key=api_key, model=model or DEFAULT_MODELS[provider])
