"""Personal API token creation, authentication, and revocation."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac
import secrets
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.orm import ApiToken, User

TOKEN_PREFIX = "mw_pat_"
_HASH_KEY_CONTEXT = b"maxwells-wallet/api-token-hash/v1"


def _hash_key() -> bytes:
    """Derive the token-hash key from the app secret.

    The context string keeps this key distinct from the one that signs login
    JWTs, so neither use can stand in for the other.
    """
    return hmac.new(settings.secret_key.encode(), _HASH_KEY_CONTEXT, sha256).digest()


def hash_token(raw_token: str) -> str:
    """Return the keyed digest stored for a raw token.

    Tokens carry 256 bits of randomness, so a slow password hash would add
    nothing. Keying the digest with a server-side secret means a leaked
    database alone cannot be used to test candidate tokens. Rotating
    SECRET_KEY therefore invalidates every issued token.
    """
    return hmac.new(_hash_key(), raw_token.encode(), sha256).hexdigest()


@dataclass(frozen=True)
class TokenPrincipal:
    user_id: int
    token_id: int
    scopes: frozenset[str]


def generate_token() -> tuple[str, str, str]:
    """Generate a raw token and its display prefix and database hash."""
    raw_token = f"{TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
    return raw_token, raw_token[:16], hash_token(raw_token)


async def create_api_token(
    session: AsyncSession,
    *,
    user_id: int,
    name: str,
    scopes: Iterable[str],
    expires_at: datetime | None,
) -> tuple[ApiToken, str]:
    """Persist a new personal API token and return it with its one-time raw value."""
    raw_token, token_prefix, token_hash = generate_token()
    token = ApiToken(
        user_id=user_id,
        name=name,
        token_prefix=token_prefix,
        token_hash=token_hash,
        scopes=",".join(sorted(set(scopes))),
        expires_at=expires_at,
    )
    session.add(token)
    await session.commit()
    await session.refresh(token)
    return token, raw_token


async def authenticate_api_token(
    session: AsyncSession, raw_token: str
) -> TokenPrincipal | None:
    """Validate a raw personal token, throttling its last-used write to once a minute."""
    if not raw_token.startswith(TOKEN_PREFIX):
        return None
    token_hash = hash_token(raw_token)
    result = await session.execute(
        select(ApiToken, User)
        .join(User, User.id == ApiToken.user_id)
        .where(ApiToken.token_hash == token_hash)
    )
    row = result.one_or_none()
    if row is None:
        return None
    token, user = row
    now = datetime.now(timezone.utc)
    expires_at = token.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if token.revoked_at is not None or (expires_at is not None and expires_at <= now):
        return None
    last_used_at = token.last_used_at
    if last_used_at is not None and last_used_at.tzinfo is None:
        last_used_at = last_used_at.replace(tzinfo=timezone.utc)
    if last_used_at is None or last_used_at + timedelta(minutes=1) <= now:
        token.last_used_at = now
        await session.commit()
    return TokenPrincipal(user_id=user.id, token_id=token.id, scopes=frozenset(token.scopes.split(",")))


async def revoke_api_token(session: AsyncSession, *, user_id: int, token_id: int) -> bool:
    """Soft-revoke an owned token, returning false when it is not owned by the caller."""
    result = await session.execute(
        select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == user_id)
    )
    token = result.scalar_one_or_none()
    if token is None:
        return False
    if token.revoked_at is None:
        token.revoked_at = datetime.now(timezone.utc)
        await session.commit()
    return True
