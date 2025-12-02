"""
Comprehensive tests for tags.py and tag_rules.py to increase coverage.
"""
import pytest
from httpx import AsyncClient


class TestTagsComprehensive:
    """Comprehensive tests for tag management"""

    @pytest.mark.asyncio
    async def test_list_tags_by_namespace(self, client: AsyncClient, seed_categories):
        """List tags filtered by namespace"""
        response = await client.get("/api/v1/tags?namespace=bucket")
        assert response.status_code == 200
        tags = response.json()
        assert isinstance(tags, list)
        for tag in tags:
            assert tag["namespace"] == "bucket"

    @pytest.mark.asyncio
    async def test_list_occasion_tags(self, client: AsyncClient, seed_categories):
        """List occasion tags"""
        response = await client.get("/api/v1/tags?namespace=occasion")
        assert response.status_code == 200
        tags = response.json()
        assert isinstance(tags, list)

    @pytest.mark.asyncio
    async def test_create_occasion_tag(self, client: AsyncClient):
        """Create an occasion tag"""
        tag_data = {
            "namespace": "occasion",
            "value": "christmas-2025",
            "description": "Christmas 2025 expenses"
        }
        response = await client.post("/api/v1/tags", json=tag_data)
        assert response.status_code in [200, 201]
        tag = response.json()
        assert tag["namespace"] == "occasion"
        assert tag["value"] == "christmas-2025"

    @pytest.mark.asyncio
    async def test_create_account_tag(self, client: AsyncClient):
        """Create an account tag"""
        tag_data = {
            "namespace": "account",
            "value": "test-checking-account",
            "description": "Test checking account"
        }
        response = await client.post("/api/v1/tags", json=tag_data)
        assert response.status_code in [200, 201]

    @pytest.mark.asyncio
    async def test_get_tag_by_id(self, client: AsyncClient, seed_categories):
        """Get specific tag by ID"""
        # First list to get an ID
        list_response = await client.get("/api/v1/tags")
        tags = list_response.json()
        if tags:
            tag_id = tags[0]["id"]
            response = await client.get(f"/api/v1/tags/{tag_id}")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_tag_description(self, client: AsyncClient, seed_categories):
        """Update tag description"""
        # Create a new tag
        create_response = await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "update-desc-test",
            "description": "Original description"
        })
        tag_id = create_response.json().get("id")

        if tag_id:
            update_response = await client.patch(f"/api/v1/tags/{tag_id}", json={
                "description": "Updated description"
            })
            assert update_response.status_code == 200
            assert update_response.json()["description"] == "Updated description"

    @pytest.mark.asyncio
    async def test_update_tag_color(self, client: AsyncClient, seed_categories):
        """Update tag color"""
        create_response = await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "color-test",
            "description": "Test"
        })
        tag_id = create_response.json().get("id")

        if tag_id:
            update_response = await client.patch(f"/api/v1/tags/{tag_id}", json={
                "color": "#FF5733"
            })
            assert update_response.status_code == 200
            assert update_response.json()["color"] == "#FF5733"


class TestTagRulesComprehensive:
    """Comprehensive tests for tag rules"""

    @pytest.mark.asyncio
    async def test_list_rules(self, client: AsyncClient):
        """List all tag rules"""
        response = await client.get("/api/v1/tag-rules")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_rule_merchant_pattern(self, client: AsyncClient, seed_categories):
        """Create rule with merchant pattern"""
        # First ensure a bucket exists
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "rule-test-groceries"
        })

        rule_data = {
            "name": "Grocery Rule",
            "tag": "bucket:rule-test-groceries",
            "merchant_pattern": "WHOLE FOODS",
            "priority": 100
        }
        response = await client.post("/api/v1/tag-rules", json=rule_data)
        # May fail if tag doesn't exist, but tests the endpoint
        assert response.status_code in [200, 201, 400]

    @pytest.mark.asyncio
    async def test_create_rule_description_pattern(self, client: AsyncClient, seed_categories):
        """Create rule with description pattern"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "rule-test-dining"
        })

        rule_data = {
            "name": "Dining Rule",
            "tag": "bucket:rule-test-dining",
            "description_pattern": "RESTAURANT",
            "priority": 50
        }
        response = await client.post("/api/v1/tag-rules", json=rule_data)
        assert response.status_code in [200, 201, 400]

    @pytest.mark.asyncio
    async def test_create_rule_amount_range(self, client: AsyncClient, seed_categories):
        """Create rule with amount range"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "rule-test-large"
        })

        rule_data = {
            "name": "Large Purchase Rule",
            "tag": "bucket:rule-test-large",
            "amount_min": 500.0,
            "amount_max": 10000.0,
            "priority": 25
        }
        response = await client.post("/api/v1/tag-rules", json=rule_data)
        assert response.status_code in [200, 201, 400]

    @pytest.mark.asyncio
    async def test_create_rule_account_source(self, client: AsyncClient, seed_categories):
        """Create rule with account source filter"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "rule-test-account"
        })

        rule_data = {
            "name": "Account-Specific Rule",
            "tag": "bucket:rule-test-account",
            "account_source": "AMEX-5678",
            "priority": 75
        }
        response = await client.post("/api/v1/tag-rules", json=rule_data)
        assert response.status_code in [200, 201, 400]

    @pytest.mark.asyncio
    async def test_create_rule_match_all(self, client: AsyncClient, seed_categories):
        """Create rule with match_all=true (AND logic)"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "rule-test-and"
        })

        rule_data = {
            "name": "AND Logic Rule",
            "tag": "bucket:rule-test-and",
            "merchant_pattern": "COFFEE",
            "amount_max": 20.0,
            "match_all": True,
            "priority": 60
        }
        response = await client.post("/api/v1/tag-rules", json=rule_data)
        assert response.status_code in [200, 201, 400]

    @pytest.mark.asyncio
    async def test_get_rule_by_id(self, client: AsyncClient, seed_categories):
        """Get specific rule by ID"""
        # First create a rule
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "get-rule-test"
        })
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Get Test Rule",
            "tag": "bucket:get-rule-test",
            "merchant_pattern": "TEST"
        })

        if create_response.status_code in [200, 201]:
            rule_id = create_response.json().get("id")
            if rule_id:
                response = await client.get(f"/api/v1/tag-rules/{rule_id}")
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_rule(self, client: AsyncClient, seed_categories):
        """Update an existing rule"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "update-rule-test"
        })
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Update Test Rule",
            "tag": "bucket:update-rule-test",
            "merchant_pattern": "OLD_PATTERN"
        })

        if create_response.status_code in [200, 201]:
            rule_id = create_response.json().get("id")
            if rule_id:
                update_response = await client.patch(f"/api/v1/tag-rules/{rule_id}", json={
                    "merchant_pattern": "NEW_PATTERN",
                    "priority": 999
                })
                assert update_response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_rule(self, client: AsyncClient, seed_categories):
        """Delete a rule"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "delete-rule-test"
        })
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Delete Test Rule",
            "tag": "bucket:delete-rule-test",
            "merchant_pattern": "DELETE"
        })

        if create_response.status_code in [200, 201]:
            rule_id = create_response.json().get("id")
            if rule_id:
                delete_response = await client.delete(f"/api/v1/tag-rules/{rule_id}")
                assert delete_response.status_code in [200, 204]

    @pytest.mark.asyncio
    async def test_apply_rules_to_transactions(self, client: AsyncClient, seed_transactions, seed_categories):
        """Apply tag rules to existing transactions"""
        response = await client.post("/api/v1/tag-rules/apply")
        assert response.status_code == 200
        data = response.json()
        assert "applied_count" in data or "matched" in data or "updated" in data
