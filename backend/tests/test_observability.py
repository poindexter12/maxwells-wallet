"""Tests for observability module."""

import pytest


class TestObservabilityConfig:
    """Test configuration loading."""

    def test_default_settings(self):
        """Default settings should have observability disabled in tests."""
        from app.observability.config import ObservabilitySettings

        # In tests, OTEL_ENABLED is set to false in conftest
        settings = ObservabilitySettings()
        assert settings.enabled is False

    def test_settings_from_env(self, monkeypatch):
        """Settings should load from environment variables."""
        monkeypatch.setenv("OTEL_ENABLED", "true")
        monkeypatch.setenv("OTEL_LOG_LEVEL", "DEBUG")
        monkeypatch.setenv("OTEL_SLOW_QUERY_THRESHOLD_MS", "200")

        from app.observability.config import ObservabilitySettings

        settings = ObservabilitySettings()
        assert settings.enabled is True
        assert settings.log_level == "DEBUG"
        assert settings.slow_query_threshold_ms == 200


class TestMetrics:
    """Test metrics recording."""

    def test_normalize_endpoint(self):
        """Endpoint normalization should replace IDs."""
        from app.observability.metrics import normalize_endpoint

        assert normalize_endpoint("/api/v1/transactions/123") == "/api/v1/transactions/{id}"
        assert normalize_endpoint("/api/v1/tags/456/usage-count") == "/api/v1/tags/{id}/usage-count"
        assert normalize_endpoint("/api/v1/transactions") == "/api/v1/transactions"

    def test_metrics_disabled_noop(self):
        """Metrics should be no-op when disabled."""
        from app.observability.metrics import record_request, get_metrics_enabled

        # Metrics are disabled in tests
        assert get_metrics_enabled() is False

        # Should not raise even when disabled
        record_request("GET", "/api/v1/test", 200, 0.05)


class TestHealth:
    """Test health check functionality."""

    @pytest.mark.asyncio
    async def test_database_health_check(self, async_session):
        """Database health check should return status."""
        from app.observability.health import check_database

        health = await check_database()
        assert health.status == "up"
        assert health.latency_ms is not None
        assert health.latency_ms >= 0

    @pytest.mark.asyncio
    async def test_health_status(self, async_session):
        """Health status should aggregate component checks."""
        from app.observability.health import get_health_status

        status = await get_health_status()
        assert status.status == "healthy"
        assert status.database.status == "up"


class TestAlerting:
    """Test alerting functionality."""

    def test_can_send_alert_respects_cooldown(self):
        """Alert cooldown should prevent rapid-fire alerts."""
        from app.observability.alerting import _can_send_alert, _record_alert_sent, setup_alerting
        from app.observability.config import ObservabilitySettings

        # Set up alerting with settings
        settings = ObservabilitySettings()
        settings.alert_cooldown_seconds = 300
        setup_alerting(settings)

        # First alert should be allowed
        assert _can_send_alert("error_rate_high") is True

        # Record that we sent it
        _record_alert_sent("error_rate_high")

        # Second alert within cooldown should be blocked
        assert _can_send_alert("error_rate_high") is False

        # Different alert type should still be allowed
        assert _can_send_alert("latency_high") is True

    @pytest.mark.asyncio
    async def test_send_alert_without_webhook_url(self):
        """Alert should not be sent if no webhook URL configured."""
        from app.observability.alerting import send_alert, AlertPayload, setup_alerting
        from app.observability.config import ObservabilitySettings

        settings = ObservabilitySettings()
        settings.alert_webhook_url = None
        setup_alerting(settings)

        payload = AlertPayload(
            alert_type="error_rate_high",
            threshold=5.0,
            current_value=10.0,
            timestamp="2024-01-15T10:00:00Z",
            message="Test alert",
        )

        result = await send_alert(payload)
        assert result is False


class TestTracing:
    """Test tracing functionality."""

    def test_traced_decorator_sync(self):
        """Traced decorator should work with sync functions."""
        from app.observability.tracing import traced

        @traced("test.sync_function")
        def sync_function(x: int) -> int:
            return x * 2

        result = sync_function(5)
        assert result == 10

    @pytest.mark.asyncio
    async def test_traced_decorator_async(self):
        """Traced decorator should work with async functions."""
        from app.observability.tracing import traced

        @traced("test.async_function")
        async def async_function(x: int) -> int:
            return x * 2

        result = await async_function(5)
        assert result == 10

    def test_add_span_attribute_no_span(self):
        """Adding span attributes without active span should not raise."""
        from app.observability.tracing import add_span_attribute

        # Should not raise even without active span
        add_span_attribute("test_key", "test_value")


class TestObservabilityEndpoints:
    """Test observability API endpoints.

    Note: These tests verify endpoint behavior when observability is disabled.
    The endpoints return 404 because the router is not registered.
    """

    @pytest.mark.asyncio
    async def test_metrics_endpoint_not_found_when_disabled(self, client):
        """Metrics endpoint should return 404 when observability is disabled."""
        response = await client.get("/metrics")
        # Observability is disabled in tests, so router is not registered
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_health_endpoint_not_found_when_disabled(self, client, async_session):
        """Health endpoint should return 404 when observability is disabled."""
        response = await client.get("/api/v1/observability/health")
        # Observability is disabled in tests, so router is not registered
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_stats_endpoint_not_found_when_disabled(self, client, async_session):
        """Stats endpoint should return 404 when observability is disabled."""
        response = await client.get("/api/v1/observability/stats")
        # Observability is disabled in tests, so router is not registered
        assert response.status_code == 404


class TestObservabilityRouter:
    """Test observability router directly (bypassing disabled state)."""

    @pytest.mark.asyncio
    async def test_metrics_generates_output(self):
        """Metrics should generate Prometheus format output."""
        from app.observability.metrics import generate_metrics

        output = generate_metrics()
        assert isinstance(output, bytes)
        # Should contain at least the metric definitions
        assert b"http_request" in output or len(output) > 0

    @pytest.mark.asyncio
    async def test_health_status_model(self, async_session):
        """Health status should return valid model."""
        from app.observability.health import get_health_status

        status = await get_health_status()
        assert status.status in ["healthy", "degraded", "unhealthy"]
        assert status.database is not None

    @pytest.mark.asyncio
    async def test_stats_calculations(self):
        """Stats calculations should not raise."""
        from app.observability.health import (
            calculate_latency_percentiles,
            calculate_error_rates,
            get_active_request_count,
            get_total_request_count,
        )

        latency = calculate_latency_percentiles()
        assert "p50" in latency
        assert "p95" in latency
        assert "p99" in latency

        error_rates = calculate_error_rates()
        assert "last_hour" in error_rates
        assert "last_24h" in error_rates

        active = get_active_request_count()
        assert isinstance(active, int)

        total = get_total_request_count()
        assert isinstance(total, int)
