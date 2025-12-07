"""
Alerting system for observability thresholds.

Sends webhook notifications when error rates or latency exceed configured thresholds.
"""

import time
import asyncio
from typing import TYPE_CHECKING, Literal
from datetime import datetime, timezone

import httpx
from pydantic import BaseModel

from app.observability.logging_config import get_logger

if TYPE_CHECKING:
    from app.observability.config import ObservabilitySettings

logger = get_logger(__name__)


class AlertPayload(BaseModel):
    """Webhook alert payload."""

    alert_type: Literal["error_rate_high", "latency_high"]
    threshold: float
    current_value: float
    timestamp: str
    message: str
    service: str = "maxwells-wallet"


# Track last alert times to implement cooldown
_last_alert_times: dict[str, float] = {}

# Settings reference
_settings: "ObservabilitySettings | None" = None


def setup_alerting(settings: "ObservabilitySettings") -> None:
    """
    Initialize alerting with settings.

    Args:
        settings: ObservabilitySettings instance
    """
    global _settings
    _settings = settings


def _can_send_alert(alert_type: str) -> bool:
    """
    Check if alert can be sent (respecting cooldown).

    Args:
        alert_type: Type of alert to check

    Returns:
        True if cooldown has passed
    """
    if _settings is None:
        return False

    last_time = _last_alert_times.get(alert_type, 0)
    current_time = time.time()

    if current_time - last_time < _settings.alert_cooldown_seconds:
        return False

    return True


def _record_alert_sent(alert_type: str) -> None:
    """Record that an alert was sent."""
    _last_alert_times[alert_type] = time.time()


async def send_alert(payload: AlertPayload) -> bool:
    """
    Send alert webhook.

    Args:
        payload: Alert payload to send

    Returns:
        True if alert was sent successfully
    """
    if _settings is None or not _settings.alert_webhook_url:
        return False

    if not _can_send_alert(payload.alert_type):
        logger.debug(
            "alert_cooldown",
            alert_type=payload.alert_type,
            cooldown_seconds=_settings.alert_cooldown_seconds,
        )
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                _settings.alert_webhook_url,
                json=payload.model_dump(),
                headers={"Content-Type": "application/json"},
            )

            if response.is_success:
                _record_alert_sent(payload.alert_type)
                logger.info(
                    "alert_sent",
                    alert_type=payload.alert_type,
                    threshold=payload.threshold,
                    current_value=payload.current_value,
                )
                return True
            else:
                logger.error(
                    "alert_send_failed",
                    status_code=response.status_code,
                    response_body=response.text[:200],
                )
                return False

    except Exception as e:
        logger.exception("alert_send_error", error=str(e))
        return False


async def check_and_alert_error_rate(error_rate: float) -> None:
    """
    Check error rate against threshold and send alert if exceeded.

    Args:
        error_rate: Current error rate as percentage (0-100)
    """
    if _settings is None:
        return

    threshold_percent = _settings.alert_error_rate_threshold * 100

    if error_rate > threshold_percent:
        payload = AlertPayload(
            alert_type="error_rate_high",
            threshold=threshold_percent,
            current_value=error_rate,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message=f"Error rate {error_rate:.1f}% exceeds threshold {threshold_percent:.1f}%",
        )
        await send_alert(payload)


async def check_and_alert_latency(p99_latency_ms: float) -> None:
    """
    Check P99 latency against threshold and send alert if exceeded.

    Args:
        p99_latency_ms: P99 latency in milliseconds
    """
    if _settings is None:
        return

    threshold_ms = _settings.alert_latency_p99_threshold_ms

    if p99_latency_ms > threshold_ms:
        payload = AlertPayload(
            alert_type="latency_high",
            threshold=threshold_ms,
            current_value=p99_latency_ms,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message=f"P99 latency {p99_latency_ms:.0f}ms exceeds threshold {threshold_ms}ms",
        )
        await send_alert(payload)


def check_alerts_sync(error_rate: float, p99_latency_ms: float) -> None:
    """
    Synchronous wrapper to check all alerts.

    Spawns async tasks for alert checking without blocking.

    Args:
        error_rate: Current error rate as percentage
        p99_latency_ms: P99 latency in milliseconds
    """
    if _settings is None or not _settings.alert_webhook_url:
        return

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Schedule as background tasks
            asyncio.create_task(check_and_alert_error_rate(error_rate))
            asyncio.create_task(check_and_alert_latency(p99_latency_ms))
        else:
            # Run synchronously (e.g., in tests)
            loop.run_until_complete(check_and_alert_error_rate(error_rate))
            loop.run_until_complete(check_and_alert_latency(p99_latency_ms))
    except RuntimeError:
        # No event loop, skip alerting
        pass
