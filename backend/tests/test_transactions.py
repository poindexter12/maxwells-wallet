"""
Tests for FR-002: Transaction Management
"""

import pytest
from httpx import AsyncClient


class TestTransactionManagement:
    """FR-002: Transaction Management"""

    @pytest.mark.asyncio
    async def test_list_transactions(self, client: AsyncClient, seed_transactions):
        """FR-002.1: List Transactions"""
        response = await client.get("/api/v1/transactions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 6  # Should return all seeded transactions

    @pytest.mark.asyncio
    async def test_search_transactions(self, client: AsyncClient, seed_transactions):
        """FR-002.2: Search & Filter - Text search"""
        response = await client.get("/api/v1/transactions?search=Starbucks")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["merchant"] == "Starbucks"

    @pytest.mark.asyncio
    async def test_filter_by_category(self, client: AsyncClient, seed_transactions):
        """FR-002.2: Search & Filter - Category filter"""
        response = await client.get("/api/v1/transactions?category=Groceries")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["category"] == "Groceries"

    @pytest.mark.asyncio
    async def test_filter_by_account(self, client: AsyncClient, seed_transactions):
        """FR-002.2: Search & Filter - Account filter"""
        response = await client.get("/api/v1/transactions?account_source=BOFA-1234")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # Both income transactions
        for item in data:
            assert item["account_source"] == "BOFA-1234"

    @pytest.mark.asyncio
    async def test_filter_by_reconciliation_status(self, client: AsyncClient, seed_transactions):
        """FR-002.2: Search & Filter - Reconciliation status"""
        response = await client.get("/api/v1/transactions?reconciliation_status=unreconciled")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for item in data:
            assert item["reconciliation_status"] == "unreconciled"

    @pytest.mark.asyncio
    async def test_manual_entry(self, client: AsyncClient, seed_categories):
        """FR-002.3: Manual Entry"""
        new_transaction = {
            "date": "2025-11-20",
            "amount": -25.00,
            "description": "Gas Station",
            "merchant": "Shell",
            "account_source": "BOFA-1234",
            "category": "Transportation",
            "reconciliation_status": "manually_entered",
            "reference_id": "manual_1",
        }

        response = await client.post("/api/v1/transactions", json=new_transaction)
        assert response.status_code == 201  # Created status
        data = response.json()
        assert data["merchant"] == "Shell"
        assert data["reconciliation_status"] == "manually_entered"

    @pytest.mark.asyncio
    async def test_edit_transaction(self, client: AsyncClient, seed_transactions):
        """FR-002.4: Edit Transaction"""
        # Get first transaction
        list_response = await client.get("/api/v1/transactions")
        transaction_id = list_response.json()[0]["id"]

        # Update category
        update_data = {"category": "Other"}
        response = await client.patch(f"/api/v1/transactions/{transaction_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Other"

    @pytest.mark.asyncio
    async def test_delete_transaction(self, client: AsyncClient, seed_transactions):
        """FR-002.5: Delete Transaction"""
        # Get first transaction
        list_response = await client.get("/api/v1/transactions")
        transaction_id = list_response.json()[0]["id"]

        # Delete
        response = await client.delete(f"/api/v1/transactions/{transaction_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/v1/transactions/{transaction_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_color_coding(self, client: AsyncClient, seed_transactions):
        """FR-002.1: Verify income/expense differentiation"""
        response = await client.get("/api/v1/transactions")
        assert response.status_code == 200
        data = response.json()

        income_transactions = [t for t in data if t["amount"] > 0]
        expense_transactions = [t for t in data if t["amount"] < 0]

        assert len(income_transactions) == 2
        assert len(expense_transactions) == 4

    @pytest.mark.asyncio
    async def test_bulk_update_nonexistent_transactions(self, client: AsyncClient):
        """Bulk update with nonexistent transaction IDs returns 404"""
        response = await client.post(
            "/api/v1/transactions/bulk-update",
            json={"transaction_ids": [99998, 99999], "updates": {"category": "Other"}},
        )
        assert response.status_code == 404
        assert response.json()["detail"]["error_code"] == "TRANSACTIONS_NOT_FOUND"
