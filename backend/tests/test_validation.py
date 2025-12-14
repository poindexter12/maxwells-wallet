"""
Tests for API validation layer - parameter validation, error handling, and edge cases.

These tests ensure the API properly validates inputs and returns appropriate errors.
"""

import pytest
from httpx import AsyncClient


class TestTransactionEndpointValidation:
    """Validation tests for transaction endpoints"""

    @pytest.mark.asyncio
    async def test_pagination_params_validated(self, client: AsyncClient, seed_transactions):
        """Pagination params are validated"""
        # skip must be >= 0
        response = await client.get("/api/v1/transactions?skip=-1")
        assert response.status_code == 422

        # limit must be >= 1
        response = await client.get("/api/v1/transactions?limit=0")
        assert response.status_code == 422

        # limit must be <= 500
        response = await client.get("/api/v1/transactions?limit=1000")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_date_format_rejected(self, client: AsyncClient, seed_transactions):
        """Invalid date format is rejected"""
        response = await client.get("/api/v1/transactions?start_date=invalid-date")
        assert response.status_code == 422

        response = await client.get("/api/v1/transactions?end_date=13/45/2025")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_valid_date_format_accepted(self, client: AsyncClient, seed_transactions):
        """Valid ISO date format is accepted"""
        response = await client.get("/api/v1/transactions?start_date=2025-01-01&end_date=2025-12-31")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_invalid_reconciliation_status_rejected(self, client: AsyncClient, seed_transactions):
        """Invalid reconciliation status is rejected"""
        response = await client.get("/api/v1/transactions?reconciliation_status=invalid_status")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_valid_reconciliation_status_accepted(self, client: AsyncClient, seed_transactions):
        """Valid reconciliation status values are accepted"""
        valid_statuses = ["unreconciled", "matched", "manually_entered", "ignored"]
        for status in valid_statuses:
            response = await client.get(f"/api/v1/transactions?reconciliation_status={status}")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_amount_filters_accept_floats(self, client: AsyncClient, seed_transactions):
        """Amount filters accept float values"""
        response = await client.get("/api/v1/transactions?amount_min=-100.50&amount_max=500.25")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_amount_filters_accept_negative(self, client: AsyncClient, seed_transactions):
        """Amount filters accept negative values (for expenses)"""
        response = await client.get("/api/v1/transactions?amount_max=-10")
        assert response.status_code == 200
        data = response.json()
        # All returned transactions should have amount <= -10
        for txn in data:
            assert txn["amount"] <= -10

    @pytest.mark.asyncio
    async def test_get_nonexistent_transaction(self, client: AsyncClient, seed_transactions):
        """Getting nonexistent transaction returns 404"""
        response = await client.get("/api/v1/transactions/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_transaction(self, client: AsyncClient, seed_transactions):
        """Deleting nonexistent transaction returns 404"""
        response = await client.delete("/api/v1/transactions/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_nonexistent_transaction(self, client: AsyncClient, seed_transactions):
        """Updating nonexistent transaction returns 404"""
        response = await client.patch("/api/v1/transactions/99999", json={"notes": "test"})
        assert response.status_code == 404


class TestTagEndpointValidation:
    """Validation tests for tag endpoints"""

    @pytest.mark.asyncio
    async def test_create_tag_missing_required_fields(self, client: AsyncClient, seed_tags):
        """Creating tag without required fields fails"""
        # Missing namespace
        response = await client.post("/api/v1/tags/", json={"value": "test"})
        assert response.status_code == 422

        # Missing value
        response = await client.post("/api/v1/tags/", json={"namespace": "bucket"})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_duplicate_tag_fails(self, client: AsyncClient, seed_tags):
        """Creating duplicate namespace:value fails with 400"""
        response = await client.post(
            "/api/v1/tags/",
            json={
                "namespace": "bucket",
                "value": "groceries",  # Already exists in seed_tags
            },
        )
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "TAG_ALREADY_EXISTS"

    @pytest.mark.asyncio
    async def test_get_nonexistent_tag(self, client: AsyncClient, seed_tags):
        """Getting nonexistent tag returns 404"""
        response = await client.get("/api/v1/tags/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_tag(self, client: AsyncClient, seed_tags):
        """Deleting nonexistent tag returns 404"""
        response = await client.delete("/api/v1/tags/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_add_invalid_tag_format(self, client: AsyncClient, seed_transactions):
        """Adding tag without colon separator fails"""
        txn_id = (await client.get("/api/v1/transactions")).json()[0]["id"]
        response = await client.post(f"/api/v1/transactions/{txn_id}/tags", json={"tag": "invalid_no_colon"})
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_add_nonexistent_tag_to_transaction(self, client: AsyncClient, seed_transactions):
        """Adding nonexistent tag to transaction fails"""
        txn_id = (await client.get("/api/v1/transactions")).json()[0]["id"]
        response = await client.post(f"/api/v1/transactions/{txn_id}/tags", json={"tag": "bucket:nonexistent-bucket"})
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_remove_unapplied_tag_fails(self, client: AsyncClient, seed_transactions):
        """Removing tag not applied to transaction fails"""
        txn_id = (await client.get("/api/v1/transactions")).json()[0]["id"]
        response = await client.delete(f"/api/v1/transactions/{txn_id}/tags/bucket:healthcare")
        assert response.status_code == 404


class TestTransactionCreateValidation:
    """Validation tests for transaction creation"""

    @pytest.mark.asyncio
    async def test_create_transaction_missing_required_fields(self, client: AsyncClient, seed_categories):
        """Creating transaction without required fields fails"""
        # Missing date
        response = await client.post(
            "/api/v1/transactions", json={"amount": -50.0, "description": "Test", "account_source": "TEST-123"}
        )
        assert response.status_code == 422

        # Missing amount
        response = await client.post(
            "/api/v1/transactions", json={"date": "2025-11-15", "description": "Test", "account_source": "TEST-123"}
        )
        assert response.status_code == 422

        # Missing description
        response = await client.post(
            "/api/v1/transactions", json={"date": "2025-11-15", "amount": -50.0, "account_source": "TEST-123"}
        )
        assert response.status_code == 422

        # Missing account_source
        response = await client.post(
            "/api/v1/transactions", json={"date": "2025-11-15", "amount": -50.0, "description": "Test"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_transaction_valid_minimal(self, client: AsyncClient, seed_categories):
        """Creating transaction with minimal required fields succeeds"""
        response = await client.post(
            "/api/v1/transactions",
            json={
                "date": "2025-11-15",
                "amount": -50.0,
                "description": "Test transaction",
                "account_source": "TEST-123",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["reconciliation_status"] == "manually_entered"


class TestAccountStatsValidation:
    """Validation tests for account stats endpoint"""

    @pytest.mark.asyncio
    async def test_account_stats_returns_valid_structure(self, client: AsyncClient, seed_transactions):
        """Account stats returns expected structure"""
        response = await client.get("/api/v1/tags/accounts/stats")
        assert response.status_code == 200
        data = response.json()

        assert "accounts" in data
        assert isinstance(data["accounts"], list)

        # Each account should have required fields
        for account in data["accounts"]:
            assert "id" in account
            assert "value" in account
            assert "transaction_count" in account
            assert "total_amount" in account
            assert isinstance(account["transaction_count"], int)
            assert isinstance(account["total_amount"], (int, float))


class TestBucketStatsValidation:
    """Validation tests for bucket stats endpoint"""

    @pytest.mark.asyncio
    async def test_bucket_stats_returns_valid_structure(self, client: AsyncClient, seed_transactions):
        """Bucket stats returns expected structure"""
        response = await client.get("/api/v1/tags/buckets/stats")
        assert response.status_code == 200
        data = response.json()

        assert "buckets" in data
        assert isinstance(data["buckets"], list)

        # Each bucket should have required fields
        for bucket in data["buckets"]:
            assert "id" in bucket
            assert "value" in bucket
            assert "transaction_count" in bucket
            assert "total_amount" in bucket


class TestOccasionStatsValidation:
    """Validation tests for occasion stats endpoint"""

    @pytest.mark.asyncio
    async def test_occasion_stats_returns_valid_structure(self, client: AsyncClient, seed_transactions):
        """Occasion stats returns expected structure"""
        response = await client.get("/api/v1/tags/occasions/stats")
        assert response.status_code == 200
        data = response.json()

        assert "occasions" in data
        assert isinstance(data["occasions"], list)
