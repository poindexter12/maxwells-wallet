"""
Comprehensive tests for filters.py router to increase coverage.
"""
import pytest
from httpx import AsyncClient


class TestFiltersComprehensive:
    """Comprehensive tests for saved filters"""

    @pytest.mark.asyncio
    async def test_list_filters_empty(self, client: AsyncClient):
        """List filters when none exist"""
        response = await client.get("/api/v1/filters")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_filter_minimal(self, client: AsyncClient):
        """Create filter with minimal criteria"""
        filter_data = {
            "name": "Minimal Test Filter"
        }
        response = await client.post("/api/v1/filters", json=filter_data)
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["name"] == "Minimal Test Filter"

    @pytest.mark.asyncio
    async def test_create_filter_amount_range(self, client: AsyncClient):
        """Create filter with amount range"""
        filter_data = {
            "name": "Amount Range Filter",
            "min_amount": -1000.0,
            "max_amount": -100.0
        }
        response = await client.post("/api/v1/filters", json=filter_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_create_filter_date_range(self, client: AsyncClient):
        """Create filter with date range"""
        filter_data = {
            "name": "Date Range Filter",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31"
        }
        response = await client.post("/api/v1/filters", json=filter_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_create_filter_search_query(self, client: AsyncClient):
        """Create filter with search query"""
        filter_data = {
            "name": "Search Query Filter",
            "search": "AMAZON"
        }
        response = await client.post("/api/v1/filters", json=filter_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_create_filter_account(self, client: AsyncClient):
        """Create filter with account source"""
        filter_data = {
            "name": "Account Filter",
            "account_source": "AMEX-5678"
        }
        response = await client.post("/api/v1/filters", json=filter_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_create_filter_bucket(self, client: AsyncClient, seed_categories):
        """Create filter with bucket tag"""
        filter_data = {
            "name": "Bucket Filter",
            "bucket": "groceries"
        }
        response = await client.post("/api/v1/filters", json=filter_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_create_filter_reconciliation(self, client: AsyncClient):
        """Create filter with reconciliation status"""
        filter_data = {
            "name": "Unreconciled Filter",
            "reconciliation_status": "unreconciled"
        }
        response = await client.post("/api/v1/filters", json=filter_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_create_filter_complex(self, client: AsyncClient, seed_categories):
        """Create filter with multiple criteria"""
        filter_data = {
            "name": "Complex Filter",
            "min_amount": -500.0,
            "max_amount": 0,
            "start_date": "2025-11-01",
            "end_date": "2025-11-30",
            "account_source": "AMEX-5678",
            "search": "STORE"
        }
        response = await client.post("/api/v1/filters", json=filter_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_get_filter_by_id(self, client: AsyncClient):
        """Get specific filter by ID"""
        # First create a filter
        create_response = await client.post("/api/v1/filters", json={
            "name": "Get Test Filter"
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            response = await client.get(f"/api/v1/filters/{filter_id}")
            assert response.status_code == 200
            assert response.json()["name"] == "Get Test Filter"

    @pytest.mark.asyncio
    async def test_get_nonexistent_filter(self, client: AsyncClient):
        """Get nonexistent filter returns 404"""
        response = await client.get("/api/v1/filters/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_filter(self, client: AsyncClient):
        """Update an existing filter"""
        create_response = await client.post("/api/v1/filters", json={
            "name": "Update Test Filter"
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            response = await client.patch(f"/api/v1/filters/{filter_id}", json={
                "name": "Updated Filter Name",
                "min_amount": -200.0
            })
            assert response.status_code == 200
            assert response.json()["name"] == "Updated Filter Name"

    @pytest.mark.asyncio
    async def test_update_nonexistent_filter(self, client: AsyncClient):
        """Update nonexistent filter returns 404"""
        response = await client.patch("/api/v1/filters/99999", json={
            "name": "Updated"
        })
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_filter(self, client: AsyncClient):
        """Delete a filter"""
        create_response = await client.post("/api/v1/filters", json={
            "name": "Delete Test Filter"
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            response = await client.delete(f"/api/v1/filters/{filter_id}")
            assert response.status_code in [200, 204]

            # Verify deleted
            get_response = await client.get(f"/api/v1/filters/{filter_id}")
            assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_apply_filter(self, client: AsyncClient, seed_transactions):
        """Apply a saved filter to get transactions"""
        # Create a filter
        create_response = await client.post("/api/v1/filters", json={
            "name": "Apply Test Filter",
            "min_amount": -1000.0,
            "max_amount": 0
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            # Apply the filter (POST, not GET)
            response = await client.post(f"/api/v1/filters/{filter_id}/apply")
            assert response.status_code == 200
            # Should return transactions matching the filter
            data = response.json()
            assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_toggle_pin_filter(self, client: AsyncClient):
        """Toggle pin status on a filter"""
        create_response = await client.post("/api/v1/filters", json={
            "name": "Pin Test Filter"
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            response = await client.post(f"/api/v1/filters/{filter_id}/toggle-pin")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_toggle_pin_nonexistent_filter(self, client: AsyncClient):
        """Toggle pin on nonexistent filter returns 404"""
        response = await client.post("/api/v1/filters/99999/toggle-pin")
        assert response.status_code == 404
        assert response.json()["detail"]["error_code"] == "FILTER_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_apply_nonexistent_filter(self, client: AsyncClient):
        """Apply nonexistent filter returns 404"""
        response = await client.post("/api/v1/filters/99999/apply")
        assert response.status_code == 404
        assert response.json()["detail"]["error_code"] == "FILTER_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_update_filter_with_accounts_list(self, client: AsyncClient):
        """Update filter with accounts list"""
        create_response = await client.post("/api/v1/filters", json={
            "name": "Accounts List Test"
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            response = await client.patch(f"/api/v1/filters/{filter_id}", json={
                "accounts": ["account1", "account2"]
            })
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_filter_with_reconciliation_status(self, client: AsyncClient):
        """Update filter with reconciliation status"""
        create_response = await client.post("/api/v1/filters", json={
            "name": "Reconciliation Test"
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            response = await client.patch(f"/api/v1/filters/{filter_id}", json={
                "reconciliation_status": "matched"
            })
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_create_and_apply_relative_date_filter(self, client: AsyncClient, seed_transactions):
        """Create and apply filter with relative date range"""
        create_response = await client.post("/api/v1/filters", json={
            "name": "Relative Date Filter",
            "date_range_type": "relative",
            "relative_days": 30
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            # Apply the filter - should calculate dates from relative_days
            response = await client.post(f"/api/v1/filters/{filter_id}/apply")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_apply_filter_with_reconciliation_status(self, client: AsyncClient, seed_transactions):
        """Apply filter with reconciliation status"""
        create_response = await client.post("/api/v1/filters", json={
            "name": "Reconciliation Apply Test",
            "reconciliation_status": "unreconciled"
        })
        filter_id = create_response.json().get("id")

        if filter_id:
            response = await client.post(f"/api/v1/filters/{filter_id}/apply")
            assert response.status_code == 200
