"""
Tests for FR-004: Reconciliation
"""
import pytest
from httpx import AsyncClient


class TestReconciliation:
    """FR-004: Reconciliation"""

    @pytest.mark.asyncio
    async def test_filter_unreconciled(self, client: AsyncClient, seed_transactions):
        """FR-004.1: Unreconciled View"""
        response = await client.get("/api/v1/transactions?reconciliation_status=unreconciled")
        assert response.status_code == 200
        data = response.json()

        # Should only return unreconciled transactions
        assert all(
            txn["reconciliation_status"] == "unreconciled"
            for txn in data
        )
        assert len(data) == 2  # Two unreconciled in seed data

    @pytest.mark.asyncio
    async def test_bulk_categorize(self, client: AsyncClient, seed_transactions):
        """FR-004.2: Bulk Operations - Bulk categorize"""
        # Get unreconciled transactions
        list_response = await client.get("/api/v1/transactions?reconciliation_status=unreconciled")
        transaction_ids = [txn["id"] for txn in list_response.json()]

        # Bulk update category
        bulk_data = {
            "transaction_ids": transaction_ids,
            "updates": {
                "category": "Other"
            }
        }

        response = await client.post("/api/v1/transactions/bulk-update", json=bulk_data)
        assert response.status_code == 200
        data = response.json()

        assert data["updated"] == len(transaction_ids)

        # Verify all transactions updated
        for txn_id in transaction_ids:
            get_response = await client.get(f"/api/v1/transactions/{txn_id}")
            assert get_response.json()["category"] == "Other"

    @pytest.mark.asyncio
    async def test_bulk_mark_reconciled(self, client: AsyncClient, seed_transactions):
        """FR-004.2: Bulk Operations - Mark as reconciled"""
        # Get unreconciled transactions
        list_response = await client.get("/api/v1/transactions?reconciliation_status=unreconciled")
        transaction_ids = [txn["id"] for txn in list_response.json()]

        # Bulk mark as reconciled
        bulk_data = {
            "transaction_ids": transaction_ids,
            "updates": {
                "reconciliation_status": "matched"
            }
        }

        response = await client.post("/api/v1/transactions/bulk-update", json=bulk_data)
        assert response.status_code == 200

        # Verify status changed
        for txn_id in transaction_ids:
            get_response = await client.get(f"/api/v1/transactions/{txn_id}")
            assert get_response.json()["reconciliation_status"] == "matched"

    @pytest.mark.asyncio
    async def test_bulk_ignore(self, client: AsyncClient, seed_transactions):
        """FR-004.2: Bulk Operations - Mark as ignored"""
        # Get first transaction
        list_response = await client.get("/api/v1/transactions")
        transaction_id = list_response.json()[0]["id"]

        # Mark as ignored
        bulk_data = {
            "transaction_ids": [transaction_id],
            "updates": {
                "reconciliation_status": "ignored"
            }
        }

        response = await client.post("/api/v1/transactions/bulk-update", json=bulk_data)
        assert response.status_code == 200

        # Verify status
        get_response = await client.get(f"/api/v1/transactions/{transaction_id}")
        assert get_response.json()["reconciliation_status"] == "ignored"

    @pytest.mark.asyncio
    async def test_status_transitions(self, client: AsyncClient, seed_transactions):
        """FR-004.4: Status Transitions - Valid status values"""
        valid_statuses = ["unreconciled", "matched", "manually_entered", "ignored"]

        # Get first transaction
        list_response = await client.get("/api/v1/transactions")
        transaction_id = list_response.json()[0]["id"]

        # Test each status transition
        for status in valid_statuses:
            update_data = {"reconciliation_status": status}
            response = await client.patch(
                f"/api/v1/transactions/{transaction_id}",
                json=update_data
            )
            assert response.status_code == 200
            assert response.json()["reconciliation_status"] == status

    @pytest.mark.asyncio
    async def test_quick_categorize_workflow(self, client: AsyncClient, seed_transactions):
        """FR-004.3: Quick Categorize - Fast categorization workflow"""
        # Get unreconciled transaction
        list_response = await client.get("/api/v1/transactions?reconciliation_status=unreconciled")
        transaction = list_response.json()[0]
        transaction_id = transaction["id"]

        # Quick categorize and reconcile in one request
        update_data = {
            "category": "Transportation",
            "reconciliation_status": "matched"
        }

        response = await client.patch(
            f"/api/v1/transactions/{transaction_id}",
            json=update_data
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["category"] == "Transportation"
        assert updated["reconciliation_status"] == "matched"

    @pytest.mark.asyncio
    async def test_reconciliation_count(self, client: AsyncClient, seed_transactions):
        """FR-004.1: Show count of unreconciled items"""
        response = await client.get("/api/v1/transactions?reconciliation_status=unreconciled")
        assert response.status_code == 200
        data = response.json()

        # API returns list, count is the length
        assert len(data) == 2  # Should match count of unreconciled
