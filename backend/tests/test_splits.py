"""
Tests for Transaction Split functionality
"""
import pytest
from httpx import AsyncClient


class TestTransactionSplits:
    """Tests for splitting transactions across multiple buckets"""

    @pytest.mark.asyncio
    async def test_get_splits_empty(self, client: AsyncClient, seed_categories):
        """Get splits for transaction with no splits returns empty list"""
        # Create a transaction
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test purchase",
            "merchant": "Costco",
            "account_source": "TEST",
            "reference_id": "test_splits_empty"
        })
        txn_id = txn_response.json()["id"]

        response = await client.get(f"/api/v1/transactions/{txn_id}/splits")
        assert response.status_code == 200
        data = response.json()

        assert data["transaction_id"] == txn_id
        assert data["total_amount"] == 100.00
        assert data["splits"] == []
        assert data["unallocated"] == 100.00

    @pytest.mark.asyncio
    async def test_set_single_split(self, client: AsyncClient, seed_categories):
        """Set a single split allocation"""
        # Create a transaction
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test purchase",
            "merchant": "Costco",
            "account_source": "TEST",
            "reference_id": "test_single_split"
        })
        txn_id = txn_response.json()["id"]

        # Set split
        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [
                {"tag": "bucket:groceries", "amount": 50.00}
            ]
        })
        assert response.status_code == 200
        data = response.json()

        assert data["transaction_id"] == txn_id
        assert len(data["splits"]) == 1
        assert data["splits"][0]["tag"] == "bucket:groceries"
        assert data["splits"][0]["amount"] == 50.00
        assert data["unallocated"] == 50.00

    @pytest.mark.asyncio
    async def test_set_multiple_splits(self, client: AsyncClient, seed_categories):
        """Set multiple split allocations"""
        # Create a transaction
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Costco run",
            "merchant": "Costco",
            "account_source": "TEST",
            "reference_id": "test_multi_split"
        })
        txn_id = txn_response.json()["id"]

        # Set splits
        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [
                {"tag": "bucket:groceries", "amount": 60.00},
                {"tag": "bucket:shopping", "amount": 30.00}
            ]
        })
        assert response.status_code == 200
        data = response.json()

        assert len(data["splits"]) == 2
        assert data["unallocated"] == 10.00

    @pytest.mark.asyncio
    async def test_partial_split_allowed(self, client: AsyncClient, seed_categories):
        """Partial allocation (not 100%) is allowed"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_partial_split"
        })
        txn_id = txn_response.json()["id"]

        # Set split for only 25%
        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [
                {"tag": "bucket:groceries", "amount": 25.00}
            ]
        })
        assert response.status_code == 200
        data = response.json()

        assert data["unallocated"] == 75.00

    @pytest.mark.asyncio
    async def test_over_allocation_allowed(self, client: AsyncClient, seed_categories):
        """Over-allocation (>100%) is allowed - no enforcement"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_over_allocation"
        })
        txn_id = txn_response.json()["id"]

        # Set split for more than 100%
        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [
                {"tag": "bucket:groceries", "amount": 80.00},
                {"tag": "bucket:shopping", "amount": 80.00}
            ]
        })
        assert response.status_code == 200
        data = response.json()

        # unallocated is capped at 0 for display (negative doesn't make sense)
        assert data["unallocated"] == 0

    @pytest.mark.asyncio
    async def test_replace_splits(self, client: AsyncClient, seed_categories):
        """Setting new splits replaces existing ones"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_replace_splits"
        })
        txn_id = txn_response.json()["id"]

        # Set initial split
        await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [{"tag": "bucket:groceries", "amount": 50.00}]
        })

        # Replace with different split
        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [{"tag": "bucket:shopping", "amount": 75.00}]
        })
        assert response.status_code == 200
        data = response.json()

        assert len(data["splits"]) == 1
        assert data["splits"][0]["tag"] == "bucket:shopping"
        assert data["splits"][0]["amount"] == 75.00

    @pytest.mark.asyncio
    async def test_clear_splits(self, client: AsyncClient, seed_categories):
        """Clear all splits from a transaction"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_clear_splits"
        })
        txn_id = txn_response.json()["id"]

        # Set splits
        await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [{"tag": "bucket:groceries", "amount": 50.00}]
        })

        # Clear splits
        response = await client.delete(f"/api/v1/transactions/{txn_id}/splits")
        assert response.status_code == 200
        assert response.json()["removed"] >= 1

        # Verify cleared
        get_response = await client.get(f"/api/v1/transactions/{txn_id}/splits")
        assert get_response.json()["splits"] == []

    @pytest.mark.asyncio
    async def test_set_empty_splits(self, client: AsyncClient, seed_categories):
        """Setting empty splits array clears all splits"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_empty_splits"
        })
        txn_id = txn_response.json()["id"]

        # Set splits then clear with empty array
        await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [{"tag": "bucket:groceries", "amount": 50.00}]
        })

        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": []
        })
        assert response.status_code == 200
        assert response.json()["splits"] == []

    @pytest.mark.asyncio
    async def test_split_invalid_tag_format(self, client: AsyncClient, seed_categories):
        """Setting split with invalid tag format fails"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_invalid_split_tag"
        })
        txn_id = txn_response.json()["id"]

        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [{"tag": "invalid-no-colon", "amount": 50.00}]
        })
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_split_non_bucket_tag_fails(self, client: AsyncClient, seed_categories):
        """Splits must use bucket namespace"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_non_bucket_split"
        })
        txn_id = txn_response.json()["id"]

        # Create an occasion tag first
        await client.post("/api/v1/tags/", json={
            "namespace": "occasion",
            "value": "birthday"
        })

        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [{"tag": "occasion:birthday", "amount": 50.00}]
        })
        assert response.status_code == 400
        assert "bucket" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_split_nonexistent_bucket_fails(self, client: AsyncClient, seed_categories):
        """Split with non-existent bucket fails"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_nonexistent_bucket"
        })
        txn_id = txn_response.json()["id"]

        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [{"tag": "bucket:nonexistent", "amount": 50.00}]
        })
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_split_nonexistent_transaction(self, client: AsyncClient, seed_categories):
        """Split operations on non-existent transaction return 404"""
        response = await client.get("/api/v1/transactions/99999/splits")
        assert response.status_code == 404

        response = await client.put("/api/v1/transactions/99999/splits", json={
            "splits": []
        })
        assert response.status_code == 404

        response = await client.delete("/api/v1/transactions/99999/splits")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_positive_transaction_splits(self, client: AsyncClient, seed_categories):
        """Splits work with positive (income) transactions"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": 500.00,  # Positive amount (income)
            "description": "Bonus",
            "merchant": "Employer",
            "account_source": "TEST",
            "reference_id": "test_positive_split"
        })
        txn_id = txn_response.json()["id"]

        response = await client.put(f"/api/v1/transactions/{txn_id}/splits", json={
            "splits": [
                {"tag": "bucket:savings", "amount": 200.00}
            ]
        })
        assert response.status_code == 200
        data = response.json()

        assert data["total_amount"] == 500.00
        assert data["unallocated"] == 300.00
