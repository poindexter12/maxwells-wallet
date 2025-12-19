"""
Authentication router for user login, setup, and password management.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.errors import ErrorCode, bad_request, conflict, unauthorized
from app.models import User, UserCreate, UserResponse, PasswordChange
from app.utils.auth import hash_password, verify_password, create_access_token, verify_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class AuthStatus(BaseModel):
    """Response for auth status check."""
    initialized: bool  # True if at least one user exists
    authenticated: bool  # True if valid token provided


class LoginRequest(BaseModel):
    """Login request body."""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Login response with token."""
    token: str
    user: UserResponse


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_session),
) -> Optional[User]:
    """Get current user from token, or None if not authenticated."""
    if not authorization:
        return None

    # Expect "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]
    user_id = verify_token(token)
    if user_id is None:
        return None

    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_current_user(
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Get current user from token, or raise 401 if not authenticated."""
    user = await get_current_user_optional(authorization, session)
    if user is None:
        raise unauthorized(ErrorCode.NOT_AUTHENTICATED)
    return user


@router.get("/status", response_model=AuthStatus)
async def get_auth_status(
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_session),
):
    """
    Check authentication status.
    Returns whether the app is initialized (user exists) and if current request is authenticated.
    """
    # Check if any user exists
    result = await session.execute(select(User).limit(1))
    user_exists = result.scalar_one_or_none() is not None

    # Check if authenticated
    authenticated = False
    if authorization:
        user = await get_current_user_optional(authorization, session)
        authenticated = user is not None

    return AuthStatus(initialized=user_exists, authenticated=authenticated)


@router.post("/setup", response_model=LoginResponse)
async def setup_first_user(
    data: UserCreate,
    session: AsyncSession = Depends(get_session),
):
    """
    Create the first user during initial setup.
    Only works if no users exist yet.
    """
    # Check if any user already exists
    result = await session.execute(select(User).limit(1))
    if result.scalar_one_or_none() is not None:
        raise conflict(ErrorCode.SETUP_ALREADY_COMPLETE)

    # Create the user
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Return token for auto-login
    assert user.id is not None  # Set by database after commit
    token = create_access_token(user.id)
    return LoginResponse(
        token=token,
        user=UserResponse(id=user.id, username=user.username, created_at=user.created_at),
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """Authenticate user and return JWT token."""
    # Find user by username
    result = await session.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(data.password, user.password_hash):
        raise unauthorized(ErrorCode.INVALID_CREDENTIALS)

    assert user.id is not None  # User exists, so id is set
    token = create_access_token(user.id)
    return LoginResponse(
        token=token,
        user=UserResponse(id=user.id, username=user.username, created_at=user.created_at),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: User = Depends(get_current_user),
):
    """Get current authenticated user info."""
    return UserResponse(id=user.id, username=user.username, created_at=user.created_at)


@router.put("/password")
async def change_password(
    data: PasswordChange,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Change password for current user."""
    # Verify current password
    if not verify_password(data.current_password, user.password_hash):
        raise bad_request(ErrorCode.INVALID_PASSWORD)

    # Update password
    user.password_hash = hash_password(data.new_password)
    session.add(user)
    await session.commit()

    return {"message": "Password changed successfully"}


@router.delete("/test-reset")
async def test_reset_users(
    confirm: str,
    session: AsyncSession = Depends(get_session),
):
    """
    ⚠️ TEST ONLY: Delete all users to simulate fresh install.

    This endpoint is for E2E testing of fresh install scenarios.
    Pass confirm='RESET_USERS' to confirm.
    """
    import os

    # Only allow in test/development environments
    env = os.environ.get("ENV", "development")
    if env not in ("test", "development"):
        raise bad_request(ErrorCode.OPERATION_NOT_ALLOWED, "Only available in test environment")

    if confirm != "RESET_USERS":
        raise bad_request(ErrorCode.CONFIRMATION_REQUIRED, "Must pass confirm='RESET_USERS'")

    # Delete all users
    result = await session.execute(select(User))
    users = result.scalars().all()
    count = len(users)
    for user in users:
        await session.delete(user)

    await session.commit()

    return {"deleted_users": count, "message": "All users deleted - app is now uninitialized"}
