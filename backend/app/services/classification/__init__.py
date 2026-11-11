"""Transaction classifier provider selection and public service types."""

from __future__ import annotations

import os

from app.config import settings

from .base import Classifier, ClassifierError, Suggestion, TxnFeatures
from .jev import JevClassifier
from .local import LocalClassifier


def _config() -> tuple[str, str, str]:
    """Read current environment overrides without persisting any configuration."""
    return (
        os.getenv("CLASSIFIER_PROVIDER", settings.classifier_provider).strip().lower(),
        os.getenv("JEV_API_KEY", settings.jev_api_key).strip(),
        os.getenv("JEV_BASE_URL", settings.jev_base_url).strip(),
    )


def get_classifier() -> Classifier:
    """Build the configured classifier, falling back safely when Jev lacks a key."""
    provider, api_key, base_url = _config()
    if provider == "jev" and api_key:
        return JevClassifier(api_key=api_key, base_url=base_url)
    return LocalClassifier()


def classifier_status() -> str:
    """Describe the effective provider without exposing secret configuration."""
    provider, api_key, _ = _config()
    if provider == "jev":
        if not api_key:
            return "local: JEV_API_KEY is not configured; using local classifier"
        return "jev: unverified integration"
    if provider != "local":
        return f"local: unsupported CLASSIFIER_PROVIDER '{provider}'; using local classifier"
    return "local: ready"


__all__ = [
    "Classifier",
    "ClassifierError",
    "JevClassifier",
    "LocalClassifier",
    "Suggestion",
    "TxnFeatures",
    "classifier_status",
    "get_classifier",
]
