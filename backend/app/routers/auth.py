"""
Authentication router for user login, setup, and password management.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_session
from app.errors import ErrorCode, bad_request, conflict, not_found, unauthorized
from app.orm import ApiToken, User
from app.schemas import (
    ApiTokenCreate,
    ApiTokenCreatedResponse,
    ApiTokenResponse,
    PasswordChange,
    UserCreate,
    UserResponse,
)
from app.services.api_tokens import create_api_token, revoke_api_token
from app.utils.auth import hash_password, verify_password, create_access_token, verify_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class AuthStatus(BaseModel):
    """Response for auth status check."""
    initialized: bool  # True if at least one user exists
    authenticated: bool  # True if valid token provided


class LoginRequest(BaseModel):
    """Login request body."""
    username: str
    password: str = Field(max_length=72)


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


@router.post("/tokens", response_model=ApiTokenCreatedResponse, status_code=201)
async def create_personal_api_token(
    data: ApiTokenCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a personal API token and return its raw value exactly once."""
    scopes = set(data.scopes)
    if not scopes or not scopes.issubset({"read", "write"}):
        raise bad_request(ErrorCode.INVALID_TOKEN, "Scopes must be a non-empty subset of read and write")
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)
        if data.expires_in_days is not None
        else None
    )
    token, raw_token = await create_api_token(
        session,
        user_id=user.id,
        name=data.name,
        scopes=scopes,
        expires_at=expires_at,
    )
    return ApiTokenCreatedResponse(
        id=token.id,
        name=token.name,
        token_prefix=token.token_prefix,
        scopes=token.scopes.split(","),
        expires_at=token.expires_at,
        revoked_at=token.revoked_at,
        last_used_at=token.last_used_at,
        created_at=token.created_at,
        updated_at=token.updated_at,
        token=raw_token,
    )


@router.get("/tokens", response_model=list[ApiTokenResponse])
async def list_personal_api_tokens(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List the caller's personal API tokens without secret material."""
    result = await session.execute(select(ApiToken).where(ApiToken.user_id == user.id))
    tokens = result.scalars().all()
    return [
        ApiTokenResponse(
            id=token.id,
            name=token.name,
            token_prefix=token.token_prefix,
            scopes=token.scopes.split(","),
            expires_at=token.expires_at,
            revoked_at=token.revoked_at,
            last_used_at=token.last_used_at,
            created_at=token.created_at,
            updated_at=token.updated_at,
        )
        for token in tokens
    ]


@router.delete("/tokens/{token_id}", status_code=204)
async def revoke_personal_api_token(
    token_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Soft-revoke one of the caller's personal API tokens."""
    if not await revoke_api_token(session, user_id=user.id, token_id=token_id):
        raise not_found(ErrorCode.API_TOKEN_NOT_FOUND)
    return Response(status_code=204)


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
