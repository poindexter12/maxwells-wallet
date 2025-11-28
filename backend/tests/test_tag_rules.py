"""
Tests for Tag Rules Engine (v0.4)
"""
import pytest
from httpx import AsyncClient
from datetime import date


class TestTagRules:
    """Tag Rules Engine Tests"""

    @pytest.mark.asyncio
    async def test_create_rule(self, client: AsyncClient, seed_categories):
        """Create a new tag rule"""
        rule_data = {
            "name": "Starbucks to Dining",
            "tag": "bucket:dining",
            "merchant_pattern": "starbucks",
            "priority": 10,
            "enabled": True,
            "match_all": False
        }

        response = await client.post("/api/v1/tag-rules", json=rule_data)
        assert response.status_code == 201
        data = response.json()

        assert data["name"] == "Starbucks to Dining"
        assert data["tag"] == "bucket:dining"
        assert data["merchant_pattern"] == "starbucks"
        assert data["priority"] == 10
        assert data["enabled"] is True
        assert data["match_count"] == 0

    @pytest.mark.asyncio
    async def test_list_rules(self, client: AsyncClient, seed_categories):
        """List all rules ordered by priority"""
        rules = [
            {"name": "High Priority", "tag": "bucket:shopping", "merchant_pattern": "target", "priority": 100},
            {"name": "Low Priority", "tag": "bucket:groceries", "merchant_pattern": "kroger", "priority": 10},
            {"name": "Medium Priority", "tag": "bucket:dining", "merchant_pattern": "mcdonalds", "priority": 50},
        ]

        for rule in rules:
            await client.post("/api/v1/tag-rules", json=rule)

        response = await client.get("/api/v1/tag-rules")
        assert response.status_code == 200
        data = response.json()

        assert len(data) == 3
        assert data[0]["priority"] == 100
        assert data[1]["priority"] == 50
        assert data[2]["priority"] == 10

    @pytest.mark.asyncio
    async def test_get_rule(self, client: AsyncClient, seed_categories):
        """Get a single rule by ID"""
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Test Rule",
            "tag": "bucket:shopping",
            "merchant_pattern": "amazon"
        })
        rule_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/tag-rules/{rule_id}")
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == rule_id
        assert data["name"] == "Test Rule"

    @pytest.mark.asyncio
    async def test_update_rule(self, client: AsyncClient, seed_categories):
        """Update a rule"""
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Test Rule",
            "tag": "bucket:shopping",
            "merchant_pattern": "amazon"
        })
        rule_id = create_response.json()["id"]

        update_data = {"priority": 50, "enabled": False}
        response = await client.patch(f"/api/v1/tag-rules/{rule_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()

        assert data["priority"] == 50
        assert data["enabled"] is False
        assert data["name"] == "Test Rule"

    @pytest.mark.asyncio
    async def test_delete_rule(self, client: AsyncClient, seed_categories):
        """Delete a rule"""
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Test Rule",
            "tag": "bucket:shopping",
            "merchant_pattern": "amazon"
        })
        rule_id = create_response.json()["id"]

        response = await client.delete(f"/api/v1/tag-rules/{rule_id}")
        assert response.status_code == 204

        get_response = await client.get(f"/api/v1/tag-rules/{rule_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_rule_requires_condition(self, client: AsyncClient, seed_categories):
        """Rule must have at least one match condition"""
        rule_data = {
            "name": "Invalid Rule",
            "tag": "bucket:shopping",
        }

        response = await client.post("/api/v1/tag-rules", json=rule_data)
        assert response.status_code == 400
        assert "at least one match condition" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_invalid_tag_format(self, client: AsyncClient, seed_categories):
        """Rule with invalid tag format should fail"""
        rule_data = {
            "name": "Invalid Tag",
            "tag": "invalid-format",  # Missing namespace:value
            "merchant_pattern": "test"
        }

        response = await client.post("/api/v1/tag-rules", json=rule_data)
        assert response.status_code == 400
        assert "invalid tag format" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_nonexistent_tag(self, client: AsyncClient, seed_categories):
        """Rule with non-existent tag should fail"""
        rule_data = {
            "name": "Bad Tag",
            "tag": "bucket:nonexistent",
            "merchant_pattern": "test"
        }

        response = await client.post("/api/v1/tag-rules", json=rule_data)
        assert response.status_code == 400
        assert "does not exist" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_merchant_pattern_matching(self, client: AsyncClient, seed_categories):
        """Test merchant pattern matching (case-insensitive)"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Coffee Rule",
            "tag": "bucket:dining",
            "merchant_pattern": "starbucks"
        })

        # Create transaction that should match
        txn_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -5.50,
            "description": "Coffee purchase",
            "merchant": "STARBUCKS #12345",
            "account_source": "TEST",
            "reference_id": "test_starbucks"
        })
        txn_id = txn_response.json()["id"]

        # Apply rules
        response = await client.post("/api/v1/tag-rules/apply")
        assert response.status_code == 200
        data = response.json()

        assert data["applied_count"] == 1

        # Verify transaction got the tag
        tags_response = await client.get(f"/api/v1/transactions/{txn_id}/tags")
        tags = tags_response.json()["tags"]
        assert any(t["full"] == "bucket:dining" for t in tags)

    @pytest.mark.asyncio
    async def test_description_pattern_matching(self, client: AsyncClient, seed_categories):
        """Test description pattern matching"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Payroll Rule",
            "tag": "bucket:income",
            "description_pattern": "payroll"
        })

        txn_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": 3000.00,
            "description": "DIRECT DEPOSIT PAYROLL",
            "merchant": "Company Inc",
            "account_source": "TEST",
            "reference_id": "test_payroll"
        })
        txn_id = txn_response.json()["id"]

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()

        assert data["applied_count"] == 1

        tags_response = await client.get(f"/api/v1/transactions/{txn_id}/tags")
        tags = tags_response.json()["tags"]
        assert any(t["full"] == "bucket:income" for t in tags)

    @pytest.mark.asyncio
    async def test_amount_range_matching(self, client: AsyncClient, seed_categories):
        """Test amount range matching"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Large Purchases",
            "tag": "bucket:shopping",
            "amount_min": 100.00,
            "amount_max": 1000.00
        })

        # Create transactions
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -500.00,
            "description": "Big purchase",
            "merchant": "Store",
            "account_source": "TEST",
            "reference_id": "test_large"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Small purchase",
            "merchant": "Store",
            "account_source": "TEST",
            "reference_id": "test_small"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()

        assert data["applied_count"] == 1  # Only large purchase

    @pytest.mark.asyncio
    async def test_match_all_logic(self, client: AsyncClient, seed_categories):
        """Test AND logic (match_all=True)"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Expensive Coffee",
            "tag": "bucket:dining",
            "merchant_pattern": "starbucks",
            "amount_min": 10.00,
            "match_all": True
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -15.00,
            "description": "Coffee",
            "merchant": "Starbucks",
            "account_source": "TEST",
            "reference_id": "test_expensive"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -5.00,
            "description": "Coffee",
            "merchant": "Starbucks",
            "account_source": "TEST",
            "reference_id": "test_cheap"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()

        assert data["applied_count"] == 1  # Only expensive coffee

    @pytest.mark.asyncio
    async def test_match_any_logic(self, client: AsyncClient, seed_categories):
        """Test OR logic (match_all=False)"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Gas Stations",
            "tag": "bucket:transportation",
            "merchant_pattern": "shell",
            "description_pattern": "gas",
            "match_all": False
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -40.00,
            "description": "Fuel purchase",
            "merchant": "Shell Gas Station",
            "account_source": "TEST",
            "reference_id": "test_shell"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -35.00,
            "description": "Gas station purchase",
            "merchant": "Chevron",
            "account_source": "TEST",
            "reference_id": "test_chevron"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()

        assert data["applied_count"] == 2  # Both should match

    @pytest.mark.asyncio
    async def test_test_rule_endpoint(self, client: AsyncClient, seed_categories, seed_transactions):
        """Test the rule testing endpoint"""
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Test Rule",
            "tag": "bucket:groceries",
            "merchant_pattern": "whole foods"
        })
        rule_id = create_response.json()["id"]

        response = await client.post(f"/api/v1/tag-rules/{rule_id}/test")
        assert response.status_code == 200
        data = response.json()

        assert "rule_id" in data
        assert "match_count" in data
        assert "matches" in data
        assert data["target_tag"] == "bucket:groceries"

    @pytest.mark.asyncio
    async def test_apply_single_rule(self, client: AsyncClient, seed_categories):
        """Test applying a specific rule"""
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Amazon Rule",
            "tag": "bucket:shopping",
            "merchant_pattern": "amazon"
        })
        rule_id = create_response.json()["id"]

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Purchase",
            "merchant": "Amazon.com",
            "account_source": "TEST",
            "reference_id": "test_amazon"
        })

        response = await client.post(f"/api/v1/tag-rules/{rule_id}/apply")
        assert response.status_code == 200
        data = response.json()

        assert data["applied_count"] >= 1
        assert data["target_tag"] == "bucket:shopping"

    @pytest.mark.asyncio
    async def test_disabled_rule_not_applied(self, client: AsyncClient, seed_categories):
        """Test that disabled rules are not applied"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Disabled Rule",
            "tag": "bucket:other",
            "merchant_pattern": "test",
            "enabled": False
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -10.00,
            "description": "Purchase",
            "merchant": "Test Merchant",
            "account_source": "TEST",
            "reference_id": "test_disabled"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()

        assert data["applied_count"] == 0

    @pytest.mark.asyncio
    async def test_rule_stats_tracking(self, client: AsyncClient, seed_categories):
        """Test that rule match count is tracked"""
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Stats Test",
            "tag": "bucket:shopping",
            "merchant_pattern": "target"
        })
        rule_id = create_response.json()["id"]

        get_response = await client.get(f"/api/v1/tag-rules/{rule_id}")
        assert get_response.json()["match_count"] == 0

        for i in range(3):
            await client.post("/api/v1/transactions", json={
                "date": date.today().isoformat(),
                "amount": -20.00,
                "description": "Purchase",
                "merchant": "Target",
                "account_source": "TEST",
                "reference_id": f"test_stats_{i}"
            })

        await client.post(f"/api/v1/tag-rules/{rule_id}/apply")

        get_response = await client.get(f"/api/v1/tag-rules/{rule_id}")
        assert get_response.json()["match_count"] == 3
        assert get_response.json()["last_matched_date"] is not None
