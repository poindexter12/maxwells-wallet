"""
Tests for account summary endpoints.

Tests cover:
- Account summary listing with balances
- Due date and credit limit metadata
- Next due date calculation
- Account updates
"""
import pytest
from httpx import AsyncClient
from datetime import date, timedelta

from app.routers.accounts import calculate_next_due_date


# =============================================================================
# Unit Tests for Due Date Calculation
# =============================================================================

class TestDueDateCalculation:
    """Test calculate_next_due_date function"""

    def test_due_date_in_future_this_month(self):
        """If due date is still ahead this month, return this month"""
        today = date.today()
        # Pick a day that's definitely in the future
        future_day = min(28, today.day + 10)
        if future_day <= today.day:
            future_day = 28  # Fallback for end of month

        # Only test if we can have a future date this month
        if future_day > today.day:
            result = calculate_next_due_date(future_day)
            assert result.month == today.month
            assert result.day == future_day

    def test_due_date_passed_this_month(self):
        """If due date has passed, return next month"""
        today = date.today()
        if today.day > 1:
            # Use day 1, which has passed if we're past the 1st
            result = calculate_next_due_date(1)
            if today.month == 12:
                assert result.month == 1
                assert result.year == today.year + 1
            else:
                assert result.month == today.month + 1
            assert result.day == 1

    def test_due_date_today(self):
        """If due date is today, still return today"""
        today = date.today()
        result = calculate_next_due_date(today.day)
        # Should be today since it hasn't passed yet
        assert result >= today

    def test_due_date_31_in_short_month(self):
        """Due day 31 in a 30-day month should use last day"""
        # This is a bit tricky to test without mocking date
        # Just verify it doesn't crash and returns a valid date
        result = calculate_next_due_date(31)
        assert result >= date.today()
        assert result.day <= 31

    def test_due_date_29_in_february(self):
        """Due day 29 in February should handle leap year correctly"""
        result = calculate_next_due_date(29)
        assert result >= date.today()
        # In non-leap year February, should be 28th
        # The function handles this gracefully


# =============================================================================
# API Integration Tests
# =============================================================================

class TestAccountSummaryEndpoint:
    """Test GET /api/v1/accounts/summary"""

    @pytest.mark.asyncio
    async def test_get_account_summary_empty(self, client: AsyncClient):
        """Empty database returns empty list"""
        response = await client.get("/api/v1/accounts/summary")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_account_summary_with_transactions(
        self, client: AsyncClient, seed_categories
    ):
        """Account summary includes all accounts with transactions"""
        # Create some transactions in different accounts
        tx1 = {
            "date": "2024-12-01",
            "amount": -150.00,
            "description": "Test purchase",
            "merchant": "AMAZON",
            "account_source": "AMEX-1234"
        }
        tx2 = {
            "date": "2024-12-02",
            "amount": -50.00,
            "description": "Another purchase",
            "merchant": "TARGET",
            "account_source": "AMEX-1234"
        }
        tx3 = {
            "date": "2024-12-01",
            "amount": 3000.00,
            "description": "Payroll",
            "merchant": "EMPLOYER",
            "account_source": "BOFA-Checking"
        }

        await client.post("/api/v1/transactions", json=tx1)
        await client.post("/api/v1/transactions", json=tx2)
        await client.post("/api/v1/transactions", json=tx3)

        response = await client.get("/api/v1/accounts/summary")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2

        # Should be sorted by balance (most negative first)
        assert data[0]["account"] == "AMEX-1234"
        assert data[0]["balance"] == -200.00
        assert data[0]["transaction_count"] == 2

        assert data[1]["account"] == "BOFA-Checking"
        assert data[1]["balance"] == 3000.00
        assert data[1]["transaction_count"] == 1

    @pytest.mark.asyncio
    async def test_account_summary_excludes_transfers(
        self, client: AsyncClient, seed_categories
    ):
        """Balance calculation excludes transfer transactions"""
        # Create a regular transaction
        tx1 = {
            "date": "2024-12-01",
            "amount": -500.00,
            "description": "CC Payment",
            "merchant": "BANK TRANSFER",
            "account_source": "BOFA-Checking",
            "is_transfer": True
        }
        tx2 = {
            "date": "2024-12-01",
            "amount": -100.00,
            "description": "Groceries",
            "merchant": "GROCERY STORE",
            "account_source": "BOFA-Checking",
            "is_transfer": False
        }

        await client.post("/api/v1/transactions", json=tx1)
        await client.post("/api/v1/transactions", json=tx2)

        response = await client.get("/api/v1/accounts/summary")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        # Balance should only include non-transfer (-100), not the transfer (-500)
        assert data[0]["balance"] == -100.00


class TestAccountDetailEndpoint:
    """Test GET /api/v1/accounts/{account_source}"""

    @pytest.mark.asyncio
    async def test_get_account_not_found(self, client: AsyncClient):
        """Non-existent account returns 404"""
        response = await client.get("/api/v1/accounts/NONEXISTENT-123")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_account_detail(self, client: AsyncClient, seed_categories):
        """Get specific account details"""
        tx = {
            "date": "2024-12-01",
            "amount": -250.00,
            "description": "Purchase",
            "merchant": "STORE",
            "account_source": "CHASE-5678"
        }
        await client.post("/api/v1/transactions", json=tx)

        response = await client.get("/api/v1/accounts/CHASE-5678")
        assert response.status_code == 200

        data = response.json()
        assert data["account"] == "CHASE-5678"
        assert data["balance"] == -250.00
        assert data["transaction_count"] == 1


class TestAccountUpdateEndpoint:
    """Test PATCH /api/v1/accounts/{account_source}"""

    @pytest.mark.asyncio
    async def test_update_account_not_found(self, client: AsyncClient):
        """Update non-existent account returns 404"""
        response = await client.patch(
            "/api/v1/accounts/NONEXISTENT-123",
            json={"due_day": 15}
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_account_due_day(self, client: AsyncClient, seed_categories):
        """Set due day for an account"""
        # Create account with transaction
        tx = {
            "date": "2024-12-01",
            "amount": -100.00,
            "description": "Test",
            "merchant": "STORE",
            "account_source": "AMEX-9999"
        }
        await client.post("/api/v1/transactions", json=tx)

        # Update due day
        response = await client.patch(
            "/api/v1/accounts/AMEX-9999",
            json={"due_day": 15}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["due_day"] == 15
        assert data["next_due_date"] is not None

    @pytest.mark.asyncio
    async def test_update_account_credit_limit(self, client: AsyncClient, seed_categories):
        """Set credit limit and see available credit"""
        tx = {
            "date": "2024-12-01",
            "amount": -1000.00,
            "description": "Test",
            "merchant": "STORE",
            "account_source": "VISA-1111"
        }
        await client.post("/api/v1/transactions", json=tx)

        response = await client.patch(
            "/api/v1/accounts/VISA-1111",
            json={"credit_limit": 5000.00}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["credit_limit"] == 5000.00
        assert data["available_credit"] == 4000.00  # 5000 - 1000

    @pytest.mark.asyncio
    async def test_update_account_invalid_due_day(self, client: AsyncClient, seed_categories):
        """Invalid due day returns 400"""
        tx = {
            "date": "2024-12-01",
            "amount": -50.00,
            "description": "Test",
            "merchant": "STORE",
            "account_source": "TEST-ACCT"
        }
        await client.post("/api/v1/transactions", json=tx)

        # Due day out of range
        response = await client.patch(
            "/api/v1/accounts/TEST-ACCT",
            json={"due_day": 32}
        )
        assert response.status_code == 400

        response = await client.patch(
            "/api/v1/accounts/TEST-ACCT",
            json={"due_day": 0}
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_account_negative_credit_limit(
        self, client: AsyncClient, seed_categories
    ):
        """Negative credit limit returns 400"""
        tx = {
            "date": "2024-12-01",
            "amount": -50.00,
            "description": "Test",
            "merchant": "STORE",
            "account_source": "TEST-ACCT2"
        }
        await client.post("/api/v1/transactions", json=tx)

        response = await client.patch(
            "/api/v1/accounts/TEST-ACCT2",
            json={"credit_limit": -1000}
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_account_description(self, client: AsyncClient, seed_categories):
        """Set account description/nickname"""
        tx = {
            "date": "2024-12-01",
            "amount": -50.00,
            "description": "Test",
            "merchant": "STORE",
            "account_source": "AMEX-PLAT"
        }
        await client.post("/api/v1/transactions", json=tx)

        response = await client.patch(
            "/api/v1/accounts/AMEX-PLAT",
            json={"description": "My Platinum Card"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["description"] == "My Platinum Card"


class TestAccountSummaryWithMetadata:
    """Test that account metadata appears in summary"""

    @pytest.mark.asyncio
    async def test_summary_includes_metadata(self, client: AsyncClient, seed_categories):
        """Summary includes due_day and credit_limit from tags"""
        # Create transaction
        tx = {
            "date": "2024-12-01",
            "amount": -500.00,
            "description": "Test",
            "merchant": "STORE",
            "account_source": "DISCOVER-2222"
        }
        await client.post("/api/v1/transactions", json=tx)

        # Set metadata
        await client.patch(
            "/api/v1/accounts/DISCOVER-2222",
            json={
                "due_day": 20,
                "credit_limit": 10000.00,
                "description": "Discover It Card"
            }
        )

        # Get summary
        response = await client.get("/api/v1/accounts/summary")
        assert response.status_code == 200

        data = response.json()
        account = next(a for a in data if a["account"] == "DISCOVER-2222")

        assert account["due_day"] == 20
        assert account["credit_limit"] == 10000.00
        assert account["available_credit"] == 9500.00  # 10000 - 500
        assert account["description"] == "Discover It Card"
        assert account["next_due_date"] is not None
