"""
OpenTelemetry tracing setup and custom span decorators.

Provides automatic instrumentation for FastAPI and SQLAlchemy,
plus decorators for adding custom spans to business logic.
"""

from functools import wraps
from typing import TYPE_CHECKING, Callable, TypeVar, ParamSpec

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

if TYPE_CHECKING:
    from fastapi import FastAPI
    from app.observability.config import ObservabilitySettings

# Type variables for decorator
P = ParamSpec("P")
T = TypeVar("T")

# Global tracer - initialized during setup
_tracer: trace.Tracer | None = None


def setup_tracing(app: "FastAPI", settings: "ObservabilitySettings") -> None:
    """
    Initialize OpenTelemetry tracing.

    Sets up:
    - TracerProvider with sampling configuration
    - FastAPI auto-instrumentation
    - SQLAlchemy auto-instrumentation

    Args:
        app: FastAPI application instance
        settings: ObservabilitySettings instance
    """
    global _tracer

    if not settings.enabled or not settings.tracing_enabled:
        return

    # Create resource with service info
    resource = Resource.create(
        {
            SERVICE_NAME: settings.service_name,
            SERVICE_VERSION: settings.service_version,
        }
    )

    # Create tracer provider with sampling
    sampler = TraceIdRatioBased(settings.trace_sample_rate)
    provider = TracerProvider(resource=resource, sampler=sampler)
    trace.set_tracer_provider(provider)

    # Get tracer for custom spans
    _tracer = trace.get_tracer(settings.service_name)

    # Instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)

    # Instrument SQLAlchemy
    # Note: We need to instrument the sync_engine for async SQLAlchemy
    try:
        from app.database import engine

        SQLAlchemyInstrumentor().instrument(
            engine=engine.sync_engine,
            enable_commenter=True,  # Adds trace context as SQL comments
        )
    except Exception:
        # Database may not be initialized yet during testing
        pass


def get_tracer() -> trace.Tracer:
    """
    Get the configured tracer instance.

    Returns:
        OpenTelemetry Tracer, or NoOpTracer if not configured
    """
    if _tracer is None:
        return trace.get_tracer(__name__)
    return _tracer


def traced(span_name: str | None = None) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator to add a custom span to a function.

    Usage:
        @traced("import.preview")
        async def preview_import(...):
            ...

    Args:
        span_name: Name for the span (defaults to function name)

    Returns:
        Decorated function with tracing
    """

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        name = span_name or func.__name__

        @wraps(func)
        async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            tracer = get_tracer()
            with tracer.start_as_current_span(name) as span:
                span.set_attribute("function", func.__name__)
                span.set_attribute("module", func.__module__)
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.StatusCode.ERROR, str(e))
                    raise

        @wraps(func)
        def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            tracer = get_tracer()
            with tracer.start_as_current_span(name) as span:
                span.set_attribute("function", func.__name__)
                span.set_attribute("module", func.__module__)
                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.StatusCode.ERROR, str(e))
                    raise

        # Check if function is async
        import asyncio

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def add_span_attribute(key: str, value: str | int | float | bool) -> None:
    """
    Add an attribute to the current span.

    Useful for adding context to spans from within traced functions.

    Args:
        key: Attribute key
        value: Attribute value
    """
    span = trace.get_current_span()
    if span:
        span.set_attribute(key, value)


def add_span_event(name: str, attributes: dict | None = None) -> None:
    """
    Add an event to the current span.

    Useful for marking significant points within a traced operation.

    Args:
        name: Event name
        attributes: Optional event attributes
    """
    span = trace.get_current_span()
    if span:
        span.add_event(name, attributes=attributes or {})
