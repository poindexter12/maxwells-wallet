"""
Tests for advanced search features.

Tests cover:
- Search including notes field
- Saved filters CRUD
- Saved filter apply
- CSV export
"""
import pytest
from httpx import AsyncClient
from datetime import date, timedelta


# =============================================================================
# Search Tests (including notes)
# =============================================================================

class TestSearchIncludesNotes:
    """Test that search includes the notes field"""

    @pytest.mark.asyncio
    async def test_search_finds_in_notes(self, client: AsyncClient, seed_categories):
        """Search should find text in notes field"""
        # Create transaction with unique text in notes
        tx = {
            "date": "2024-12-01",
            "amount": -50.00,
            "description": "Regular purchase",
            "merchant": "STORE",
            "account_source": "TEST-ACCT",
            "notes": "special_keyword_in_notes"
        }
        await client.post("/api/v1/transactions", json=tx)

        # Search for text in notes
        response = await client.get(
            "/api/v1/transactions/",
            params={"search": "special_keyword_in_notes"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["notes"] == "special_keyword_in_notes"

    @pytest.mark.asyncio
    async def test_search_still_finds_in_merchant(self, client: AsyncClient, seed_categories):
        """Search should still find text in merchant"""
        tx = {
            "date": "2024-12-01",
            "amount": -30.00,
            "description": "Test",
            "merchant": "UNIQUE_MERCHANT_NAME",
            "account_source": "TEST-ACCT"
        }
        await client.post("/api/v1/transactions", json=tx)

        response = await client.get(
            "/api/v1/transactions/",
            params={"search": "UNIQUE_MERCHANT"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["merchant"] == "UNIQUE_MERCHANT_NAME"

    @pytest.mark.asyncio
    async def test_search_still_finds_in_description(self, client: AsyncClient, seed_categories):
        """Search should still find text in description"""
        tx = {
            "date": "2024-12-01",
            "amount": -40.00,
            "description": "DISTINCTIVE_DESCRIPTION_HERE",
            "merchant": "STORE",
            "account_source": "TEST-ACCT"
        }
        await client.post("/api/v1/transactions", json=tx)

        response = await client.get(
            "/api/v1/transactions/",
            params={"search": "DISTINCTIVE_DESCRIPTION"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "DISTINCTIVE_DESCRIPTION" in data[0]["description"]


# =============================================================================
# Saved Filters Tests
# =============================================================================

class TestSavedFiltersCreate:
    """Test saved filter creation"""

    @pytest.mark.asyncio
    async def test_create_simple_filter(self, client: AsyncClient):
        """Create a basic saved filter"""
        filter_data = {
            "name": "Amazon Purchases",
            "description": "All purchases from Amazon",
            "search": "Amazon"
        }
        response = await client.post("/api/v1/filters/", json=filter_data)
        assert response.status_code == 201

        data = response.json()
        assert data["name"] == "Amazon Purchases"
        assert data["search"] == "Amazon"
        assert data["use_count"] == 0
        assert data["is_pinned"] is False

    @pytest.mark.asyncio
    async def test_create_filter_with_all_options(self, client: AsyncClient):
        """Create a filter with all options"""
        filter_data = {
            "name": "Complex Filter",
            "description": "Test all options",
            "accounts": ["AMEX-1234"],
            "accounts_exclude": ["BOFA-Checking"],
            "tags": ["bucket:groceries"],
            "tags_exclude": ["occasion:vacation"],
            "search": "test",
            "search_regex": False,
            "amount_min": -100.0,
            "amount_max": -10.0,
            "is_transfer": False,
            "date_range_type": "relative",
            "relative_days": 30,
            "is_pinned": True
        }
        response = await client.post("/api/v1/filters/", json=filter_data)
        assert response.status_code == 201

        data = response.json()
        assert data["accounts"] == ["AMEX-1234"]
        assert data["accounts_exclude"] == ["BOFA-Checking"]
        assert data["tags"] == ["bucket:groceries"]
        assert data["tags_exclude"] == ["occasion:vacation"]
        assert data["amount_min"] == -100.0
        assert data["amount_max"] == -10.0
        assert data["relative_days"] == 30
        assert data["is_pinned"] is True


class TestSavedFiltersList:
    """Test listing saved filters"""

    @pytest.mark.asyncio
    async def test_list_empty(self, client: AsyncClient):
        """Empty list when no filters exist"""
        response = await client.get("/api/v1/filters/")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_filters_ordered_by_pinned_and_use_count(self, client: AsyncClient):
        """Filters should be ordered by pinned status then use count"""
        # Create filters with different pinned/use status
        filter1 = {"name": "Unpinned Low Use", "is_pinned": False}
        filter2 = {"name": "Pinned", "is_pinned": True}
        filter3 = {"name": "Unpinned High Use", "is_pinned": False}

        await client.post("/api/v1/filters/", json=filter1)
        await client.post("/api/v1/filters/", json=filter2)
        await client.post("/api/v1/filters/", json=filter3)

        response = await client.get("/api/v1/filters/")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 3
        # Pinned should come first
        assert data[0]["name"] == "Pinned"

    @pytest.mark.asyncio
    async def test_list_pinned_only(self, client: AsyncClient):
        """Filter list to only pinned"""
        await client.post("/api/v1/filters/", json={"name": "Unpinned", "is_pinned": False})
        await client.post("/api/v1/filters/", json={"name": "Pinned", "is_pinned": True})

        response = await client.get("/api/v1/filters/", params={"pinned_only": True})
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Pinned"


class TestSavedFiltersGetUpdateDelete:
    """Test get, update, delete operations"""

    @pytest.mark.asyncio
    async def test_get_filter(self, client: AsyncClient):
        """Get a single filter by ID"""
        create_resp = await client.post(
            "/api/v1/filters/",
            json={"name": "Test Filter", "search": "test"}
        )
        filter_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/filters/{filter_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Test Filter"

    @pytest.mark.asyncio
    async def test_get_filter_not_found(self, client: AsyncClient):
        """404 for non-existent filter"""
        response = await client.get("/api/v1/filters/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_filter(self, client: AsyncClient):
        """Update a filter"""
        create_resp = await client.post(
            "/api/v1/filters/",
            json={"name": "Original Name"}
        )
        filter_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/filters/{filter_id}",
            json={"name": "Updated Name", "search": "new search"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["search"] == "new search"

    @pytest.mark.asyncio
    async def test_delete_filter(self, client: AsyncClient):
        """Delete a filter"""
        create_resp = await client.post(
            "/api/v1/filters/",
            json={"name": "To Delete"}
        )
        filter_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/filters/{filter_id}")
        assert response.status_code == 204

        # Verify deleted
        get_resp = await client.get(f"/api/v1/filters/{filter_id}")
        assert get_resp.status_code == 404


class TestSavedFiltersApply:
    """Test applying saved filters"""

    @pytest.mark.asyncio
    async def test_apply_filter(self, client: AsyncClient, seed_categories):
        """Apply a filter returns matching transactions"""
        # Create transactions
        tx1 = {
            "date": "2024-12-01",
            "amount": -50.00,
            "description": "Amazon purchase",
            "merchant": "AMAZON",
            "account_source": "TEST-ACCT"
        }
        tx2 = {
            "date": "2024-12-02",
            "amount": -30.00,
            "description": "Target purchase",
            "merchant": "TARGET",
            "account_source": "TEST-ACCT"
        }
        await client.post("/api/v1/transactions", json=tx1)
        await client.post("/api/v1/transactions", json=tx2)

        # Create filter for Amazon
        create_resp = await client.post(
            "/api/v1/filters/",
            json={"name": "Amazon Only", "search": "AMAZON"}
        )
        filter_id = create_resp.json()["id"]

        # Apply filter
        response = await client.post(f"/api/v1/filters/{filter_id}/apply")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 1
        assert data[0]["merchant"] == "AMAZON"

    @pytest.mark.asyncio
    async def test_apply_filter_increments_use_count(self, client: AsyncClient, seed_categories):
        """Applying a filter increments use_count"""
        # Create a transaction so filter has something to match
        tx = {
            "date": "2024-12-01",
            "amount": -50.00,
            "description": "Test",
            "merchant": "STORE",
            "account_source": "TEST-ACCT"
        }
        await client.post("/api/v1/transactions", json=tx)

        create_resp = await client.post(
            "/api/v1/filters/",
            json={"name": "Test Filter"}
        )
        filter_id = create_resp.json()["id"]
        assert create_resp.json()["use_count"] == 0

        # Apply filter twice
        await client.post(f"/api/v1/filters/{filter_id}/apply")
        await client.post(f"/api/v1/filters/{filter_id}/apply")

        # Check use_count
        get_resp = await client.get(f"/api/v1/filters/{filter_id}")
        assert get_resp.json()["use_count"] == 2
        assert get_resp.json()["last_used_at"] is not None


class TestSavedFiltersTogglePin:
    """Test toggle pin functionality"""

    @pytest.mark.asyncio
    async def test_toggle_pin(self, client: AsyncClient):
        """Toggle pin status"""
        create_resp = await client.post(
            "/api/v1/filters/",
            json={"name": "Test", "is_pinned": False}
        )
        filter_id = create_resp.json()["id"]
        assert create_resp.json()["is_pinned"] is False

        # Toggle on
        response = await client.post(f"/api/v1/filters/{filter_id}/toggle-pin")
        assert response.status_code == 200
        assert response.json()["is_pinned"] is True

        # Toggle off
        response = await client.post(f"/api/v1/filters/{filter_id}/toggle-pin")
        assert response.status_code == 200
        assert response.json()["is_pinned"] is False


# =============================================================================
# CSV Export Tests
# =============================================================================

class TestCSVExport:
    """Test CSV export endpoint"""

    @pytest.mark.asyncio
    async def test_export_csv_basic(self, client: AsyncClient, seed_categories):
        """Export transactions as CSV"""
        # Create transactions
        tx1 = {
            "date": "2024-12-01",
            "amount": -50.00,
            "description": "Test purchase 1",
            "merchant": "STORE1",
            "account_source": "TEST-ACCT"
        }
        tx2 = {
            "date": "2024-12-02",
            "amount": -75.00,
            "description": "Test purchase 2",
            "merchant": "STORE2",
            "account_source": "TEST-ACCT"
        }
        await client.post("/api/v1/transactions", json=tx1)
        await client.post("/api/v1/transactions", json=tx2)

        response = await client.get("/api/v1/transactions/export/csv")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment" in response.headers["content-disposition"]

        # Parse CSV content
        content = response.text
        lines = content.strip().split('\n')
        assert len(lines) == 3  # Header + 2 data rows

        # Check header
        header = lines[0]
        assert "Date" in header
        assert "Amount" in header
        assert "Merchant" in header

    @pytest.mark.asyncio
    async def test_export_csv_with_filters(self, client: AsyncClient, seed_categories):
        """Export filtered transactions"""
        tx1 = {
            "date": "2024-12-01",
            "amount": -50.00,
            "description": "Amazon",
            "merchant": "AMAZON",
            "account_source": "ACCT1"
        }
        tx2 = {
            "date": "2024-12-02",
            "amount": -30.00,
            "description": "Target",
            "merchant": "TARGET",
            "account_source": "ACCT2"
        }
        await client.post("/api/v1/transactions", json=tx1)
        await client.post("/api/v1/transactions", json=tx2)

        # Export only Amazon transactions
        response = await client.get(
            "/api/v1/transactions/export/csv",
            params={"search": "AMAZON"}
        )
        assert response.status_code == 200

        content = response.text
        lines = content.strip().split('\n')
        assert len(lines) == 2  # Header + 1 data row
        assert "AMAZON" in lines[1]

    @pytest.mark.asyncio
    async def test_export_csv_filename_includes_dates(self, client: AsyncClient, seed_categories):
        """CSV filename includes date range when specified"""
        tx = {
            "date": "2024-12-15",
            "amount": -25.00,
            "description": "Test",
            "merchant": "STORE",
            "account_source": "TEST"
        }
        await client.post("/api/v1/transactions", json=tx)

        response = await client.get(
            "/api/v1/transactions/export/csv",
            params={
                "start_date": "2024-12-01",
                "end_date": "2024-12-31"
            }
        )
        assert response.status_code == 200

        disposition = response.headers["content-disposition"]
        assert "2024-12-01" in disposition
        assert "2024-12-31" in disposition

    @pytest.mark.asyncio
    async def test_export_empty_result(self, client: AsyncClient, seed_categories):
        """Export with no matching transactions returns header only"""
        response = await client.get(
            "/api/v1/transactions/export/csv",
            params={"search": "NONEXISTENT_SEARCH_TERM_XYZ"}
        )
        assert response.status_code == 200

        content = response.text
        lines = content.strip().split('\n')
        assert len(lines) == 1  # Header only
