"""Settings router for application-wide configuration including i18n preferences."""

from fastapi import APIRouter, Depends, Request
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import AppSettings, AppSettingsUpdate, LanguagePreference

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

# Supported locales for i18n (BCP 47 codes)
SUPPORTED_LOCALES = ["en-US", "en-GB", "es-ES", "fr-FR", "it-IT", "pt-PT", "de-DE", "nl-NL", "pseudo"]
DEFAULT_LOCALE = "en-US"


def parse_accept_language(accept_language: str) -> str:
    """Parse Accept-Language header and return best matching locale.

    The Accept-Language header follows the format: "en-US,en;q=0.9,es;q=0.8"
    where q values indicate preference weight (1.0 if omitted).
    """
    if not accept_language:
        return DEFAULT_LOCALE

    # Parse and sort by quality value
    parts = []
    for part in accept_language.split(","):
        part = part.strip()
        if not part:
            continue

        # Extract locale and quality
        if ";q=" in part:
            locale, q = part.split(";q=")
            try:
                quality = float(q)
            except ValueError:
                quality = 1.0
        else:
            locale = part
            quality = 1.0

        parts.append((locale.strip(), quality))

    # Sort by quality descending
    parts.sort(key=lambda x: x[1], reverse=True)

    # Find best matching locale
    for locale, _ in parts:
        # Try exact match first
        if locale in SUPPORTED_LOCALES:
            return locale

        # Try language-only match (e.g., "en" -> "en-US")
        lang = locale.split("-")[0]
        for supported in SUPPORTED_LOCALES:
            if supported.lower().startswith(lang.lower()):
                return supported

    return DEFAULT_LOCALE


@router.get("")
async def get_settings(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Get application settings with resolved effective locale.

    Returns the stored language preference and the effective locale
    (resolved from Accept-Language header if preference is 'browser').
    """
    result = await session.execute(select(AppSettings))
    settings = result.scalar_one_or_none()

    # Create default settings if none exist (upsert pattern)
    if not settings:
        settings = AppSettings()
        session.add(settings)
        await session.commit()
        await session.refresh(settings)

    # Resolve effective locale based on preference
    if settings.language == LanguagePreference.browser:
        accept_lang = request.headers.get("Accept-Language", "")
        effective_locale = parse_accept_language(accept_lang)
    else:
        effective_locale = settings.language.value

    return {
        "language": settings.language.value,
        "effective_locale": effective_locale,
        "supported_locales": SUPPORTED_LOCALES
    }


@router.patch("")
async def update_settings(
    updates: AppSettingsUpdate,
    session: AsyncSession = Depends(get_session)
):
    """Update application settings.

    Uses upsert pattern - creates settings row if it doesn't exist.
    """
    result = await session.execute(select(AppSettings))
    settings = result.scalar_one_or_none()

    if not settings:
        settings = AppSettings()
        session.add(settings)

    # Apply updates
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)

    settings.updated_at = __import__("datetime").datetime.utcnow()

    await session.commit()
    await session.refresh(settings)

    return {
        "language": settings.language.value,
        "updated_at": settings.updated_at.isoformat()
    }
