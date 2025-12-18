"""
Authentication utilities for password hashing and JWT tokens.
"""

from datetime import datetime, timedelta
from typing import Optional, cast

from jose import jwt, JWTError  # type: ignore[import-untyped]
from passlib.context import CryptContext  # type: ignore[import-untyped]

from app.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return cast(str, pwd_context.hash(password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return cast(bool, pwd_context.verify(plain_password, hashed_password))


def create_access_token(user_id: int) -> str:
    """Create a JWT access token for a user."""
    expire = datetime.utcnow() + timedelta(hours=settings.token_expire_hours)
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
    }
    return cast(str, jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM))


def verify_token(token: str) -> Optional[int]:
    """
    Verify a JWT token and return the user ID.
    Returns None if token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except JWTError:
        return None
