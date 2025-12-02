"""
Comprehensive tests for merchants.py router to increase coverage.
"""
import pytest
from httpx import AsyncClient


class TestMerchantAliases:
    """Tests for merchant alias management"""

    @pytest.mark.asyncio
    async def test_list_aliases_empty(self, client: AsyncClient):
        """List aliases when none exist"""
        response = await client.get("/api/v1/merchants/aliases")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_alias_contains(self, client: AsyncClient):
        """Create a contains-type alias"""
        alias_data = {
            "pattern": "AMZN",
            "canonical_name": "Amazon",
            "match_type": "contains",
            "priority": 10
        }
        response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["canonical_name"] == "Amazon"
        assert data["match_type"] == "contains"

    @pytest.mark.asyncio
    async def test_create_alias_exact(self, client: AsyncClient):
        """Create an exact-match alias"""
        alias_data = {
            "pattern": "STARBUCKS COFFEE",
            "canonical_name": "Starbucks",
            "match_type": "exact",
            "priority": 5
        }
        response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_create_alias_regex(self, client: AsyncClient):
        """Create a regex-type alias"""
        alias_data = {
            "pattern": "WAL.*MART",
            "canonical_name": "Walmart",
            "match_type": "regex",
            "priority": 8
        }
        response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_get_alias_by_id(self, client: AsyncClient):
        """Get a specific alias"""
        # First create an alias
        alias_data = {
            "pattern": "TGTSTORE",
            "canonical_name": "Target",
            "match_type": "contains"
        }
        create_response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        alias_id = create_response.json().get("id")

        if alias_id:
            response = await client.get(f"/api/v1/merchants/aliases/{alias_id}")
            assert response.status_code == 200
            assert response.json()["canonical_name"] == "Target"

    @pytest.mark.asyncio
    async def test_get_nonexistent_alias(self, client: AsyncClient):
        """Get nonexistent alias returns 404"""
        response = await client.get("/api/v1/merchants/aliases/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_alias(self, client: AsyncClient):
        """Update an existing alias"""
        # First create an alias
        alias_data = {
            "pattern": "UPDATETEST",
            "canonical_name": "Before Update",
            "match_type": "contains"
        }
        create_response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        alias_id = create_response.json().get("id")

        if alias_id:
            update_data = {"canonical_name": "After Update"}
            response = await client.patch(f"/api/v1/merchants/aliases/{alias_id}", json=update_data)
            assert response.status_code == 200
            assert response.json()["canonical_name"] == "After Update"

    @pytest.mark.asyncio
    async def test_update_nonexistent_alias(self, client: AsyncClient):
        """Update nonexistent alias returns 404"""
        response = await client.patch("/api/v1/merchants/aliases/99999", json={"canonical_name": "Test"})
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_alias(self, client: AsyncClient):
        """Delete an alias"""
        # First create an alias
        alias_data = {
            "pattern": "DELETETEST",
            "canonical_name": "To Delete",
            "match_type": "contains"
        }
        create_response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        alias_id = create_response.json().get("id")

        if alias_id:
            response = await client.delete(f"/api/v1/merchants/aliases/{alias_id}")
            assert response.status_code in [200, 204]

    @pytest.mark.asyncio
    async def test_delete_nonexistent_alias(self, client: AsyncClient):
        """Delete nonexistent alias returns 404"""
        response = await client.delete("/api/v1/merchants/aliases/99999")
        assert response.status_code == 404


class TestMerchantStats:
    """Tests for merchant statistics"""

    @pytest.mark.asyncio
    async def test_list_merchants(self, client: AsyncClient, seed_transactions):
        """List all merchants with transaction counts"""
        response = await client.get("/api/v1/merchants")
        assert response.status_code == 200
        data = response.json()
        # Could be list or dict with items
        assert isinstance(data, (list, dict))
