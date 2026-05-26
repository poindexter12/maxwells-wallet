"""Resolve the assistant's runtime configuration from the environment.

The assistant is configured only at startup (via env / Docker Compose) — nothing
is persisted. Provide a key for the provider you want; the provider auto-detects
from whichever key is present, or set ``ASSISTANT_PROVIDER`` to pick explicitly.
``ASSISTANT_MODEL`` optionally overrides the per-provider default.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.config import settings as app_config

from . import DEFAULT_MODELS, SUPPORTED_PROVIDERS


@dataclass
class AssistantEnvConfig:
    provider: Optional[str]
    model: Optional[str]
    api_key: Optional[str]

    @property
    def configured(self) -> bool:
        return bool(self.provider and self.api_key)


def _env_key_for(provider: Optional[str]) -> str:
    if provider == "anthropic":
        return app_config.anthropic_api_key
    if provider == "openai":
        return app_config.openai_api_key
    return ""


def resolve_assistant_config() -> AssistantEnvConfig:
    """Effective (provider, model, api_key) from env, or unconfigured."""
    # Explicit provider override if valid, else auto-detect from the present key.
    provider: Optional[str] = (app_config.assistant_provider or "").strip().lower() or None
    if provider not in SUPPORTED_PROVIDERS:
        provider = None
    if provider is None:
        if app_config.anthropic_api_key:
            provider = "anthropic"
        elif app_config.openai_api_key:
            provider = "openai"
    if provider is None:
        return AssistantEnvConfig(provider=None, model=None, api_key=None)

    api_key = _env_key_for(provider) or None
    model = (app_config.assistant_model or "").strip() or DEFAULT_MODELS.get(provider)
    return AssistantEnvConfig(provider=provider, model=model, api_key=api_key)
