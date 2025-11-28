"""
Tests for Category Rules Engine (v0.3)
"""
import pytest
from httpx import AsyncClient
from datetime import date


class TestCategoryRules:
    """Category Rules Engine Tests"""

    @pytest.mark.asyncio
    async def test_create_rule(self, client: AsyncClient, seed_categories):
        """Create a new category rule"""
        rule_data = {
            "name": "Starbucks to Coffee",
            "category": "Dining & Coffee",
            "merchant_pattern": "starbucks",
            "priority": 10,
            "enabled": True,
            "match_all": False
        }

        response = await client.post("/api/v1/category-rules", json=rule_data)
        assert response.status_code == 201
        data = response.json()

        assert data["name"] == "Starbucks to Coffee"
        assert data["category"] == "Dining & Coffee"
        assert data["merchant_pattern"] == "starbucks"
        assert data["priority"] == 10
        assert data["enabled"] is True
        assert data["match_count"] == 0

    @pytest.mark.asyncio
    async def test_list_rules(self, client: AsyncClient, seed_categories):
        """List all rules ordered by priority"""
        # Create rules with different priorities
        rules = [
            {"name": "High Priority", "category": "Shopping", "merchant_pattern": "target", "priority": 100},
            {"name": "Low Priority", "category": "Groceries", "merchant_pattern": "kroger", "priority": 10},
            {"name": "Medium Priority", "category": "Dining & Coffee", "merchant_pattern": "mcdonalds", "priority": 50},
        ]

        for rule in rules:
            await client.post("/api/v1/category-rules", json=rule)

        # List rules
        response = await client.get("/api/v1/category-rules")
        assert response.status_code == 200
        data = response.json()

        assert len(data) == 3
        # Should be ordered by priority descending
        assert data[0]["priority"] == 100
        assert data[1]["priority"] == 50
        assert data[2]["priority"] == 10

    @pytest.mark.asyncio
    async def test_get_rule(self, client: AsyncClient, seed_categories):
        """Get a single rule by ID"""
        create_response = await client.post("/api/v1/category-rules", json={
            "name": "Test Rule",
            "category": "Shopping",
            "merchant_pattern": "amazon"
        })
        rule_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/category-rules/{rule_id}")
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == rule_id
        assert data["name"] == "Test Rule"

    @pytest.mark.asyncio
    async def test_update_rule(self, client: AsyncClient, seed_categories):
        """Update a rule"""
        create_response = await client.post("/api/v1/category-rules", json={
            "name": "Test Rule",
            "category": "Shopping",
            "merchant_pattern": "amazon"
        })
        rule_id = create_response.json()["id"]

        # Update rule
        update_data = {"priority": 50, "enabled": False}
        response = await client.patch(f"/api/v1/category-rules/{rule_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()

        assert data["priority"] == 50
        assert data["enabled"] is False
        assert data["name"] == "Test Rule"  # Unchanged

    @pytest.mark.asyncio
    async def test_delete_rule(self, client: AsyncClient, seed_categories):
        """Delete a rule"""
        create_response = await client.post("/api/v1/category-rules", json={
            "name": "Test Rule",
            "category": "Shopping",
            "merchant_pattern": "amazon"
        })
        rule_id = create_response.json()["id"]

        # Delete rule
        response = await client.delete(f"/api/v1/category-rules/{rule_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/v1/category-rules/{rule_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_rule_requires_condition(self, client: AsyncClient, seed_categories):
        """Rule must have at least one match condition"""
        rule_data = {
            "name": "Invalid Rule",
            "category": "Shopping",
            # No match conditions specified
        }

        response = await client.post("/api/v1/category-rules", json=rule_data)
        assert response.status_code == 400
        assert "at least one match condition" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_merchant_pattern_matching(self, client: AsyncClient, seed_categories):
        """Test merchant pattern matching (case-insensitive)"""
        # Create rule
        await client.post("/api/v1/category-rules", json={
            "name": "Coffee Rule",
            "category": "Dining & Coffee",
            "merchant_pattern": "starbucks"
        })

        # Create transaction that should match
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -5.50,
            "description": "Coffee purchase",
            "merchant": "STARBUCKS #12345",  # Different case, should still match
            "account_source": "TEST",
            "reference_id": "test_starbucks"
        })

        # Apply rules
        response = await client.post("/api/v1/category-rules/apply")
        assert response.status_code == 200
        data = response.json()

        assert data["applied_count"] == 1
        assert len(data["rules_applied"]) == 1

        # Verify transaction was categorized
        txn_response = await client.get("/api/v1/transactions")
        transactions = txn_response.json()
        starbucks_txn = next((t for t in transactions if "starbucks" in (t.get("merchant") or "").lower()), None)
        assert starbucks_txn is not None
        assert starbucks_txn["category"] == "Dining & Coffee"

    @pytest.mark.asyncio
    async def test_description_pattern_matching(self, client: AsyncClient, seed_categories):
        """Test description pattern matching"""
        # Create rule
        await client.post("/api/v1/category-rules", json={
            "name": "Payroll Rule",
            "category": "Income",
            "description_pattern": "payroll"
        })

        # Create transaction
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": 3000.00,
            "description": "DIRECT DEPOSIT PAYROLL",
            "merchant": "Company Inc",
            "account_source": "TEST",
            "reference_id": "test_payroll"
        })

        # Apply rules
        response = await client.post("/api/v1/category-rules/apply")
        data = response.json()

        assert data["applied_count"] == 1

    @pytest.mark.asyncio
    async def test_amount_range_matching(self, client: AsyncClient, seed_categories):
        """Test amount range matching"""
        # Create rule for large purchases
        await client.post("/api/v1/category-rules", json={
            "name": "Large Purchases",
            "category": "Shopping",
            "amount_min": 100.00,
            "amount_max": 1000.00
        })

        # Create transactions
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -500.00,  # Should match
            "description": "Big purchase",
            "merchant": "Store",
            "account_source": "TEST",
            "reference_id": "test_large"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,  # Should NOT match
            "description": "Small purchase",
            "merchant": "Store",
            "account_source": "TEST",
            "reference_id": "test_small"
        })

        # Apply rules
        response = await client.post("/api/v1/category-rules/apply")
        data = response.json()

        assert data["applied_count"] == 1  # Only the large purchase

    @pytest.mark.asyncio
    async def test_account_source_matching(self, client: AsyncClient, seed_categories):
        """Test account source matching"""
        # Create rule specific to one account with unique merchant
        # Use match_all=True to require BOTH merchant AND account to match
        await client.post("/api/v1/category-rules", json={
            "name": "AMEX Dining",
            "category": "Dining & Coffee",
            "merchant_pattern": "unique_restaurant_xyz",
            "account_source": "AMEX-1234",
            "match_all": True  # Require both conditions
        })

        # Create transactions on different accounts
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -25.00,
            "description": "Dinner",
            "merchant": "Unique_Restaurant_XYZ",
            "account_source": "AMEX-1234",  # Should match
            "reference_id": "test_amex_unique"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -25.00,
            "description": "Dinner",
            "merchant": "Unique_Restaurant_XYZ",
            "account_source": "BOFA-5678",  # Should NOT match
            "reference_id": "test_bofa_unique"
        })

        # Apply rules
        response = await client.post("/api/v1/category-rules/apply")
        data = response.json()

        assert data["applied_count"] == 1  # Only AMEX transaction

    @pytest.mark.asyncio
    async def test_match_all_logic(self, client: AsyncClient, seed_categories):
        """Test AND logic (match_all=True)"""
        # Create rule requiring both merchant AND amount
        await client.post("/api/v1/category-rules", json={
            "name": "Expensive Coffee",
            "category": "Dining & Coffee",
            "merchant_pattern": "starbucks",
            "amount_min": 10.00,
            "match_all": True  # Both conditions must match
        })

        # Create transactions
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -15.00,  # Matches both merchant and amount
            "description": "Coffee",
            "merchant": "Starbucks",
            "account_source": "TEST",
            "reference_id": "test_expensive"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -5.00,  # Matches merchant but NOT amount
            "description": "Coffee",
            "merchant": "Starbucks",
            "account_source": "TEST",
            "reference_id": "test_cheap"
        })

        # Apply rules
        response = await client.post("/api/v1/category-rules/apply")
        data = response.json()

        assert data["applied_count"] == 1  # Only expensive coffee

    @pytest.mark.asyncio
    async def test_match_any_logic(self, client: AsyncClient, seed_categories):
        """Test OR logic (match_all=False)"""
        # Create rule matching merchant OR description
        await client.post("/api/v1/category-rules", json={
            "name": "Gas Stations",
            "category": "Transportation",
            "merchant_pattern": "shell",
            "description_pattern": "gas",
            "match_all": False  # Any condition can match
        })

        # Create transactions
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -40.00,
            "description": "Fuel purchase",
            "merchant": "Shell Gas Station",  # Matches merchant
            "account_source": "TEST",
            "reference_id": "test_shell"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -35.00,
            "description": "Gas station purchase",  # Matches description
            "merchant": "Chevron",
            "account_source": "TEST",
            "reference_id": "test_chevron"
        })

        # Apply rules
        response = await client.post("/api/v1/category-rules/apply")
        data = response.json()

        assert data["applied_count"] == 2  # Both should match

    @pytest.mark.asyncio
    async def test_rule_priority_order(self, client: AsyncClient, seed_categories):
        """Test that higher priority rules are applied first"""
        # Create two overlapping rules with different priorities
        await client.post("/api/v1/category-rules", json={
            "name": "General Starbucks",
            "category": "Dining & Coffee",
            "merchant_pattern": "starbucks",
            "priority": 10
        })

        await client.post("/api/v1/category-rules", json={
            "name": "Premium Starbucks",
            "category": "Entertainment",  # Different category
            "merchant_pattern": "starbucks",
            "amount_min": 20.00,
            "priority": 100  # Higher priority
        })

        # Create expensive Starbucks transaction
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -25.00,
            "description": "Coffee",
            "merchant": "Starbucks",
            "account_source": "TEST",
            "reference_id": "test_priority"
        })

        # Apply rules
        await client.post("/api/v1/category-rules/apply")

        # Check transaction category - should be Entertainment (higher priority)
        txn_response = await client.get("/api/v1/transactions")
        transactions = txn_response.json()
        starbucks_txn = next(t for t in transactions if t["reference_id"] == "test_priority")
        assert starbucks_txn["category"] == "Entertainment"

    @pytest.mark.asyncio
    async def test_test_rule_endpoint(self, client: AsyncClient, seed_categories, seed_transactions):
        """Test the rule testing endpoint"""
        # Create rule
        create_response = await client.post("/api/v1/category-rules", json={
            "name": "Test Rule",
            "category": "Groceries",
            "merchant_pattern": "whole foods"
        })
        rule_id = create_response.json()["id"]

        # Test rule (preview matches)
        response = await client.post(f"/api/v1/category-rules/{rule_id}/test")
        assert response.status_code == 200
        data = response.json()

        assert "rule_id" in data
        assert "match_count" in data
        assert "matches" in data
        assert data["target_category"] == "Groceries"

    @pytest.mark.asyncio
    async def test_apply_single_rule(self, client: AsyncClient, seed_categories):
        """Test applying a specific rule"""
        # Create rule
        create_response = await client.post("/api/v1/category-rules", json={
            "name": "Amazon Rule",
            "category": "Shopping",
            "merchant_pattern": "amazon"
        })
        rule_id = create_response.json()["id"]

        # Create matching transaction
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Purchase",
            "merchant": "Amazon.com",
            "account_source": "TEST",
            "reference_id": "test_amazon"
        })

        # Apply specific rule
        response = await client.post(f"/api/v1/category-rules/{rule_id}/apply")
        assert response.status_code == 200
        data = response.json()

        assert data["applied_count"] >= 1
        assert data["target_category"] == "Shopping"

    @pytest.mark.asyncio
    async def test_disabled_rule_not_applied(self, client: AsyncClient, seed_categories):
        """Test that disabled rules are not applied"""
        # Create disabled rule
        await client.post("/api/v1/category-rules", json={
            "name": "Disabled Rule",
            "category": "Other",
            "merchant_pattern": "test",
            "enabled": False
        })

        # Create matching transaction
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -10.00,
            "description": "Purchase",
            "merchant": "Test Merchant",
            "account_source": "TEST",
            "reference_id": "test_disabled"
        })

        # Apply rules
        response = await client.post("/api/v1/category-rules/apply")
        data = response.json()

        # No rules should be applied
        assert data["applied_count"] == 0

    @pytest.mark.asyncio
    async def test_rule_stats_tracking(self, client: AsyncClient, seed_categories):
        """Test that rule match count is tracked"""
        # Create rule
        create_response = await client.post("/api/v1/category-rules", json={
            "name": "Stats Test",
            "category": "Shopping",
            "merchant_pattern": "target"
        })
        rule_id = create_response.json()["id"]

        # Initial match count should be 0
        get_response = await client.get(f"/api/v1/category-rules/{rule_id}")
        assert get_response.json()["match_count"] == 0

        # Create matching transactions
        for i in range(3):
            await client.post("/api/v1/transactions", json={
                "date": date.today().isoformat(),
                "amount": -20.00,
                "description": "Purchase",
                "merchant": "Target",
                "account_source": "TEST",
                "reference_id": f"test_stats_{i}"
            })

        # Apply rule
        await client.post(f"/api/v1/category-rules/{rule_id}/apply")

        # Check match count increased
        get_response = await client.get(f"/api/v1/category-rules/{rule_id}")
        assert get_response.json()["match_count"] == 3
        assert get_response.json()["last_matched_date"] is not None
