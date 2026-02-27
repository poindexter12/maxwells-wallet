"""
Tests for authentication workflow.

Tests cover:
- First-run setup (no user exists)
- Login flow
- Auth status checking
- Password management
- Protected route access
- Error cases
"""

import pytest
from httpx import AsyncClient

from app.models import User
from app.utils.auth import hash_password, verify_password, create_access_token, verify_token


class TestAuthUtilities:
    """Test auth utility functions."""

    def test_hash_password_creates_hash(self):
        """Password hashing creates a bcrypt hash."""
        password = "testpassword123"
        hashed = hash_password(password)

        assert hashed != password
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_verify_password_correct(self):
        """Correct password verifies successfully."""
        password = "testpassword123"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Incorrect password fails verification."""
        password = "testpassword123"
        hashed = hash_password(password)

        assert verify_password("wrongpassword", hashed) is False

    def test_create_access_token(self):
        """Token creation returns a valid JWT string."""
        token = create_access_token(user_id=1)

        assert isinstance(token, str)
        assert len(token) > 0
        # JWT has 3 parts separated by dots
        assert len(token.split(".")) == 3

    def test_verify_token_valid(self):
        """Valid token returns user ID."""
        user_id = 42
        token = create_access_token(user_id=user_id)

        result = verify_token(token)
        assert result == user_id

    def test_verify_token_invalid(self):
        """Invalid token returns None."""
        result = verify_token("invalid.token.here")
        assert result is None

    def test_verify_token_tampered(self):
        """Tampered token returns None."""
        token = create_access_token(user_id=1)
        # Tamper with the token
        tampered = token[:-5] + "xxxxx"

        result = verify_token(tampered)
        assert result is None

    def test_hash_password_at_72_byte_limit(self):
        """Passwords at exactly 72 bytes hash and verify correctly."""
        password = "a" * 72
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True


class TestAuthStatus:
    """Test GET /api/v1/auth/status endpoint."""

    @pytest.mark.asyncio
    async def test_status_not_initialized(self, client: AsyncClient):
        """Status shows not initialized when no users exist."""
        response = await client.get("/api/v1/auth/status")

        assert response.status_code == 200
        data = response.json()
        assert data["initialized"] is False
        assert data["authenticated"] is False

    @pytest.mark.asyncio
    async def test_status_initialized_not_authenticated(self, client: AsyncClient, test_user):
        """Status shows initialized but not authenticated without token."""
        response = await client.get("/api/v1/auth/status")

        assert response.status_code == 200
        data = response.json()
        assert data["initialized"] is True
        assert data["authenticated"] is False

    @pytest.mark.asyncio
    async def test_status_authenticated(self, client: AsyncClient, test_user, auth_token):
        """Status shows authenticated with valid token."""
        response = await client.get(
            "/api/v1/auth/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["initialized"] is True
        assert data["authenticated"] is True

    @pytest.mark.asyncio
    async def test_status_invalid_token(self, client: AsyncClient, test_user):
        """Status shows not authenticated with invalid token."""
        response = await client.get(
            "/api/v1/auth/status",
            headers={"Authorization": "Bearer invalid.token.here"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["initialized"] is True
        assert data["authenticated"] is False


class TestAuthSetup:
    """Test POST /api/v1/auth/setup endpoint."""

    @pytest.mark.asyncio
    async def test_setup_creates_first_user(self, client: AsyncClient):
        """Setup creates user and returns token when no users exist."""
        response = await client.post(
            "/api/v1/auth/setup",
            json={"username": "admin", "password": "password123"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["username"] == "admin"
        assert "id" in data["user"]

    @pytest.mark.asyncio
    async def test_setup_rejects_password_over_72_bytes(self, client: AsyncClient):
        """Setup rejects passwords exceeding bcrypt's 72-byte limit."""
        response = await client.post(
            "/api/v1/auth/setup",
            json={"username": "admin", "password": "a" * 73}
        )
        assert response.status_code == 422  # Pydantic validation error

    @pytest.mark.asyncio
    async def test_setup_fails_when_user_exists(self, client: AsyncClient, test_user):
        """Setup returns 409 when a user already exists."""
        response = await client.post(
            "/api/v1/auth/setup",
            json={"username": "another", "password": "password123"}
        )

        assert response.status_code == 409
        data = response.json()
        assert data["detail"]["error_code"] == "SETUP_ALREADY_COMPLETE"

    @pytest.mark.asyncio
    async def test_setup_auto_login(self, client: AsyncClient):
        """Setup token can be used immediately for authenticated requests."""
        # Create user
        setup_response = await client.post(
            "/api/v1/auth/setup",
            json={"username": "admin", "password": "password123"}
        )
        token = setup_response.json()["token"]

        # Use token to access protected endpoint
        me_response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert me_response.status_code == 200
        assert me_response.json()["username"] == "admin"


class TestAuthLogin:
    """Test POST /api/v1/auth/login endpoint."""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user):
        """Login with correct credentials returns token."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "testpass123"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["username"] == "testuser"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        """Login with wrong password returns 401."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "wrongpassword"}
        )

        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["error_code"] == "INVALID_CREDENTIALS"

    @pytest.mark.asyncio
    async def test_login_wrong_username(self, client: AsyncClient, test_user):
        """Login with wrong username returns 401."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "nonexistent", "password": "testpass123"}
        )

        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["error_code"] == "INVALID_CREDENTIALS"

    @pytest.mark.asyncio
    async def test_login_rejects_password_over_72_bytes(self, client: AsyncClient, test_user):
        """Login rejects passwords exceeding bcrypt's 72-byte limit."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "a" * 73}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_no_users_exist(self, client: AsyncClient):
        """Login returns 401 when no users exist."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "password"}
        )

        assert response.status_code == 401


class TestAuthMe:
    """Test GET /api/v1/auth/me endpoint."""

    @pytest.mark.asyncio
    async def test_me_authenticated(self, client: AsyncClient, test_user, auth_token):
        """Me endpoint returns user info with valid token."""
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_me_not_authenticated(self, client: AsyncClient):
        """Me endpoint returns 401 without token."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["error_code"] == "NOT_AUTHENTICATED"

    @pytest.mark.asyncio
    async def test_me_invalid_token(self, client: AsyncClient):
        """Me endpoint returns 401 with invalid token."""
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token"}
        )

        assert response.status_code == 401


class TestPasswordChange:
    """Test PUT /api/v1/auth/password endpoint."""

    @pytest.mark.asyncio
    async def test_change_password_success(self, client: AsyncClient, test_user, auth_token):
        """Password change with correct current password succeeds."""
        response = await client.put(
            "/api/v1/auth/password",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "current_password": "testpass123",
                "new_password": "newpassword456"
            }
        )

        assert response.status_code == 200

        # Verify new password works
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "newpassword456"}
        )
        assert login_response.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, client: AsyncClient, test_user, auth_token):
        """Password change with wrong current password fails."""
        response = await client.put(
            "/api/v1/auth/password",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword456"
            }
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["error_code"] == "INVALID_PASSWORD"

    @pytest.mark.asyncio
    async def test_change_password_rejects_new_password_over_72_bytes(self, client: AsyncClient, test_user, auth_token):
        """Password change rejects new passwords exceeding bcrypt's 72-byte limit."""
        response = await client.put(
            "/api/v1/auth/password",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "current_password": "testpass123",
                "new_password": "a" * 73
            }
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_change_password_not_authenticated(self, client: AsyncClient):
        """Password change without token returns 401."""
        response = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": "old",
                "new_password": "new"
            }
        )

        assert response.status_code == 401


class TestAuthWorkflow:
    """Test complete authentication workflows."""

    @pytest.mark.asyncio
    async def test_first_run_workflow(self, client: AsyncClient):
        """Complete first-run workflow: check status -> setup -> use app."""
        # 1. Check status - should not be initialized
        status_response = await client.get("/api/v1/auth/status")
        assert status_response.json()["initialized"] is False

        # 2. Setup first user
        setup_response = await client.post(
            "/api/v1/auth/setup",
            json={"username": "admin", "password": "adminpass"}
        )
        assert setup_response.status_code == 200
        token = setup_response.json()["token"]

        # 3. Status should now be initialized and authenticated
        status_response = await client.get(
            "/api/v1/auth/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = status_response.json()
        assert data["initialized"] is True
        assert data["authenticated"] is True

        # 4. Can access protected endpoint
        me_response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200

    @pytest.mark.asyncio
    async def test_login_workflow(self, client: AsyncClient, test_user):
        """Complete login workflow: check status -> login -> use app."""
        # 1. Check status - initialized but not authenticated
        status_response = await client.get("/api/v1/auth/status")
        data = status_response.json()
        assert data["initialized"] is True
        assert data["authenticated"] is False

        # 2. Login
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "testpass123"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]

        # 3. Status should now show authenticated
        status_response = await client.get(
            "/api/v1/auth/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = status_response.json()
        assert data["authenticated"] is True

        # 4. Can access protected endpoints
        me_response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200

    @pytest.mark.asyncio
    async def test_logout_workflow(self, client: AsyncClient, test_user, auth_token):
        """Logout workflow: authenticated -> clear token -> no access."""
        # 1. Start authenticated
        me_response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert me_response.status_code == 200

        # 2. "Logout" is client-side (clear token), verify no access without it
        me_response = await client.get("/api/v1/auth/me")
        assert me_response.status_code == 401

        # 3. Status shows not authenticated
        status_response = await client.get("/api/v1/auth/status")
        assert status_response.json()["authenticated"] is False


# Fixtures for auth tests
@pytest.fixture
async def test_user(async_session):
    """Create a test user."""
    from app.utils.auth import hash_password

    user = User(
        username="testuser",
        password_hash=hash_password("testpass123")
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user):
    """Create an auth token for the test user."""
    return create_access_token(test_user.id)
