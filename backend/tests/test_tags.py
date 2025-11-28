"""
Tests for Tags API (v0.4)
"""
import pytest
from httpx import AsyncClient


class TestTags:
    """Tags API Tests"""

    @pytest.mark.asyncio
    async def test_list_tags(self, client: AsyncClient, seed_tags):
        """List all tags"""
        response = await client.get("/api/v1/tags/")
        assert response.status_code == 200
        data = response.json()

        assert len(data) > 0
        assert any(t["namespace"] == "bucket" and t["value"] == "groceries" for t in data)

    @pytest.mark.asyncio
    async def test_list_tags_by_namespace(self, client: AsyncClient, seed_tags):
        """List tags filtered by namespace"""
        response = await client.get("/api/v1/tags/?namespace=bucket")
        assert response.status_code == 200
        data = response.json()

        assert len(data) > 0
        assert all(t["namespace"] == "bucket" for t in data)

    @pytest.mark.asyncio
    async def test_list_buckets(self, client: AsyncClient, seed_tags):
        """List bucket tags via convenience endpoint"""
        response = await client.get("/api/v1/tags/buckets")
        assert response.status_code == 200
        data = response.json()

        assert len(data) > 0
        assert all(t["namespace"] == "bucket" for t in data)

    @pytest.mark.asyncio
    async def test_get_tag_by_id(self, client: AsyncClient, seed_tags):
        """Get a tag by ID"""
        # First get the list to find an ID
        list_response = await client.get("/api/v1/tags/")
        tags = list_response.json()
        tag_id = tags[0]["id"]

        response = await client.get(f"/api/v1/tags/{tag_id}")
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == tag_id
        assert "namespace" in data
        assert "value" in data

    @pytest.mark.asyncio
    async def test_get_tag_by_name(self, client: AsyncClient, seed_tags):
        """Get a tag by namespace and value"""
        response = await client.get("/api/v1/tags/by-name/bucket/groceries")
        assert response.status_code == 200
        data = response.json()

        assert data["namespace"] == "bucket"
        assert data["value"] == "groceries"

    @pytest.mark.asyncio
    async def test_get_nonexistent_tag(self, client: AsyncClient, seed_tags):
        """Get non-existent tag returns 404"""
        response = await client.get("/api/v1/tags/by-name/bucket/nonexistent")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_tag(self, client: AsyncClient, seed_tags):
        """Create a new tag"""
        tag_data = {
            "namespace": "occasion",
            "value": "vacation",
            "description": "Vacation-related expenses"
        }

        response = await client.post("/api/v1/tags/", json=tag_data)
        assert response.status_code == 201
        data = response.json()

        assert data["namespace"] == "occasion"
        assert data["value"] == "vacation"
        assert data["description"] == "Vacation-related expenses"

    @pytest.mark.asyncio
    async def test_create_duplicate_tag(self, client: AsyncClient, seed_tags):
        """Creating duplicate tag fails"""
        tag_data = {
            "namespace": "bucket",
            "value": "groceries",  # Already exists in seed
        }

        response = await client.post("/api/v1/tags/", json=tag_data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_update_tag(self, client: AsyncClient, seed_tags):
        """Update tag description"""
        # Get a tag ID
        list_response = await client.get("/api/v1/tags/by-name/bucket/groceries")
        tag_id = list_response.json()["id"]

        update_data = {"description": "Updated description"}
        response = await client.patch(f"/api/v1/tags/{tag_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()

        assert data["description"] == "Updated description"

    @pytest.mark.asyncio
    async def test_delete_unused_tag(self, client: AsyncClient, seed_tags):
        """Delete an unused tag"""
        # Create a new tag to delete
        create_response = await client.post("/api/v1/tags/", json={
            "namespace": "test",
            "value": "delete-me"
        })
        tag_id = create_response.json()["id"]

        # Delete it
        response = await client.delete(f"/api/v1/tags/{tag_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/v1/tags/{tag_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_used_tag_fails(self, client: AsyncClient, seed_transactions):
        """Cannot delete a tag that is in use"""
        # The seed_transactions fixture creates transactions with bucket:groceries
        groceries_response = await client.get("/api/v1/tags/by-name/bucket/groceries")
        tag_id = groceries_response.json()["id"]

        response = await client.delete(f"/api/v1/tags/{tag_id}")
        assert response.status_code == 400
        assert "used by" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_tag_usage_count(self, client: AsyncClient, seed_transactions):
        """Get usage count for a tag"""
        groceries_response = await client.get("/api/v1/tags/by-name/bucket/groceries")
        tag_id = groceries_response.json()["id"]

        response = await client.get(f"/api/v1/tags/{tag_id}/usage-count")
        assert response.status_code == 200
        data = response.json()

        assert data["tag_id"] == tag_id
        assert data["usage_count"] >= 1  # At least one transaction has this tag


class TestTransactionTags:
    """Tests for transaction-tag management"""

    @pytest.mark.asyncio
    async def test_add_tag_to_transaction(self, client: AsyncClient, seed_categories):
        """Add a tag to a transaction"""
        # Create a transaction
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -50.00,
            "description": "Test purchase",
            "merchant": "Test Store",
            "account_source": "TEST",
            "reference_id": "test_add_tag"
        })
        txn_id = txn_response.json()["id"]

        # Add tag
        response = await client.post(f"/api/v1/transactions/{txn_id}/tags", json={
            "tag": "bucket:shopping"
        })
        assert response.status_code == 200
        assert "tag added" in response.json()["message"].lower()

        # Verify tag was added
        tags_response = await client.get(f"/api/v1/transactions/{txn_id}/tags")
        tags = tags_response.json()["tags"]
        assert any(t["full"] == "bucket:shopping" for t in tags)

    @pytest.mark.asyncio
    async def test_add_second_bucket_replaces_first(self, client: AsyncClient, seed_categories):
        """Adding a second bucket tag replaces the first (only one bucket allowed)"""
        # Create a transaction
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -50.00,
            "description": "Test purchase",
            "merchant": "Test Store",
            "account_source": "TEST",
            "reference_id": "test_replace_bucket"
        })
        txn_id = txn_response.json()["id"]

        # Add first bucket tag
        await client.post(f"/api/v1/transactions/{txn_id}/tags", json={"tag": "bucket:shopping"})

        # Add second bucket tag
        await client.post(f"/api/v1/transactions/{txn_id}/tags", json={"tag": "bucket:groceries"})

        # Verify only one bucket tag exists
        tags_response = await client.get(f"/api/v1/transactions/{txn_id}/tags")
        tags = tags_response.json()["tags"]
        bucket_tags = [t for t in tags if t["namespace"] == "bucket"]
        assert len(bucket_tags) == 1
        assert bucket_tags[0]["value"] == "groceries"

    @pytest.mark.asyncio
    async def test_remove_tag_from_transaction(self, client: AsyncClient, seed_categories):
        """Remove a tag from a transaction"""
        # Create a transaction and add a tag
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -50.00,
            "description": "Test purchase",
            "merchant": "Test Store",
            "account_source": "TEST",
            "reference_id": "test_remove_tag"
        })
        txn_id = txn_response.json()["id"]
        await client.post(f"/api/v1/transactions/{txn_id}/tags", json={"tag": "bucket:shopping"})

        # Remove tag
        response = await client.delete(f"/api/v1/transactions/{txn_id}/tags/bucket:shopping")
        assert response.status_code == 200

        # Verify tag was removed
        tags_response = await client.get(f"/api/v1/transactions/{txn_id}/tags")
        tags = tags_response.json()["tags"]
        assert not any(t["full"] == "bucket:shopping" for t in tags)

    @pytest.mark.asyncio
    async def test_get_transaction_tags(self, client: AsyncClient, seed_transactions):
        """Get all tags for a transaction"""
        # Get a transaction with tags
        txns_response = await client.get("/api/v1/transactions")
        txn = txns_response.json()[0]  # First transaction

        response = await client.get(f"/api/v1/transactions/{txn['id']}/tags")
        assert response.status_code == 200
        data = response.json()

        assert "transaction_id" in data
        assert "tags" in data
        assert isinstance(data["tags"], list)

    @pytest.mark.asyncio
    async def test_add_invalid_tag(self, client: AsyncClient, seed_categories):
        """Adding invalid tag format fails"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -50.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_invalid_tag"
        })
        txn_id = txn_response.json()["id"]

        response = await client.post(f"/api/v1/transactions/{txn_id}/tags", json={
            "tag": "invalid-no-colon"
        })
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_add_nonexistent_tag(self, client: AsyncClient, seed_categories):
        """Adding non-existent tag fails"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -50.00,
            "description": "Test",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_nonexistent_tag"
        })
        txn_id = txn_response.json()["id"]

        response = await client.post(f"/api/v1/transactions/{txn_id}/tags", json={
            "tag": "bucket:nonexistent"
        })
        assert response.status_code == 400
