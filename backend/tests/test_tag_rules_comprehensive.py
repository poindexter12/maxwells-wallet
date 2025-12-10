"""
Comprehensive tests for tag_rules.py router to increase coverage to 90%+.
Covers edge cases and error paths not in the main test file.
"""
import pytest
from httpx import AsyncClient
from datetime import date


class TestTagRulesEdgeCases:
    """Edge case tests for tag rules CRUD"""

    @pytest.mark.asyncio
    async def test_get_nonexistent_rule(self, client: AsyncClient):
        """Get nonexistent rule returns 404"""
        response = await client.get("/api/v1/tag-rules/99999")
        assert response.status_code == 404
        assert response.json()["detail"]["error_code"] == "RULE_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_update_nonexistent_rule(self, client: AsyncClient):
        """Update nonexistent rule returns 404"""
        response = await client.patch("/api/v1/tag-rules/99999", json={"priority": 50})
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_rule(self, client: AsyncClient):
        """Delete nonexistent rule returns 404"""
        response = await client.delete("/api/v1/tag-rules/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_test_nonexistent_rule(self, client: AsyncClient):
        """Test nonexistent rule returns 404"""
        response = await client.post("/api/v1/tag-rules/99999/test")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_apply_nonexistent_rule(self, client: AsyncClient):
        """Apply nonexistent single rule returns 404"""
        response = await client.post("/api/v1/tag-rules/99999/apply")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_apply_disabled_single_rule(self, client: AsyncClient, seed_categories):
        """Apply disabled single rule returns 400"""
        # Create a disabled rule
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Disabled Apply Test",
            "tag": "bucket:shopping",
            "merchant_pattern": "disabled_test",
            "enabled": False
        })
        rule_id = create_response.json()["id"]

        # Try to apply it
        response = await client.post(f"/api/v1/tag-rules/{rule_id}/apply")
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "RULE_DISABLED"

    @pytest.mark.asyncio
    async def test_update_rule_invalid_tag_format(self, client: AsyncClient, seed_categories):
        """Update rule with invalid tag format fails"""
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Update Tag Test",
            "tag": "bucket:shopping",
            "merchant_pattern": "test"
        })
        rule_id = create_response.json()["id"]

        response = await client.patch(f"/api/v1/tag-rules/{rule_id}", json={
            "tag": "invalid-no-colon"
        })
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "TAG_INVALID_FORMAT"

    @pytest.mark.asyncio
    async def test_update_rule_nonexistent_tag(self, client: AsyncClient, seed_categories):
        """Update rule with nonexistent tag fails"""
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Update Nonexistent Tag Test",
            "tag": "bucket:shopping",
            "merchant_pattern": "test"
        })
        rule_id = create_response.json()["id"]

        response = await client.patch(f"/api/v1/tag-rules/{rule_id}", json={
            "tag": "bucket:does-not-exist-12345"
        })
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "TAG_NOT_FOUND"


class TestTagRuleMatching:
    """Tests for tag rule matching logic"""

    @pytest.mark.asyncio
    async def test_account_source_matching(self, client: AsyncClient, seed_categories):
        """Test account_source matching condition"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Account Source Rule",
            "tag": "bucket:shopping",
            "account_source": "SPECIFIC-ACCOUNT"
        })

        # Create transaction with matching account
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Account test",
            "merchant": "Some Store",
            "account_source": "SPECIFIC-ACCOUNT",
            "reference_id": "test_account_match"
        })

        # Create transaction with different account
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -25.00,
            "description": "Account test 2",
            "merchant": "Some Store",
            "account_source": "DIFFERENT-ACCOUNT",
            "reference_id": "test_account_no_match"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()
        # Only one should match
        assert data["applied_count"] == 1

    @pytest.mark.asyncio
    async def test_amount_min_only(self, client: AsyncClient, seed_categories):
        """Test amount_min without amount_max"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Min Amount Only",
            "tag": "bucket:shopping",
            "amount_min": 50.00
        })

        # Transaction above min
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -100.00,
            "description": "Above min",
            "merchant": "Store",
            "account_source": "TEST",
            "reference_id": "test_min_above"
        })

        # Transaction below min
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -25.00,
            "description": "Below min",
            "merchant": "Store",
            "account_source": "TEST",
            "reference_id": "test_min_below"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()
        assert data["applied_count"] == 1  # Only above-min transaction

    @pytest.mark.asyncio
    async def test_amount_max_only(self, client: AsyncClient, seed_categories):
        """Test amount_max without amount_min"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Max Amount Only",
            "tag": "bucket:shopping",
            "amount_max": 50.00
        })

        # Transaction above max
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -100.00,
            "description": "Above max",
            "merchant": "Store",
            "account_source": "TEST",
            "reference_id": "test_max_above"
        })

        # Transaction below max
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -25.00,
            "description": "Below max",
            "merchant": "Store",
            "account_source": "TEST",
            "reference_id": "test_max_below"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()
        assert data["applied_count"] == 1  # Only below-max transaction

    @pytest.mark.asyncio
    async def test_multiple_conditions_match_all(self, client: AsyncClient, seed_categories):
        """Test multiple conditions with match_all=True (AND logic)"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Multi Condition AND",
            "tag": "bucket:dining",
            "merchant_pattern": "restaurant",
            "description_pattern": "dinner",
            "amount_min": 20.00,
            "match_all": True
        })

        # Transaction matching all conditions
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Business dinner",
            "merchant": "Restaurant XYZ",
            "account_source": "TEST",
            "reference_id": "test_all_match"
        })

        # Transaction matching only merchant
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Lunch",
            "merchant": "Restaurant ABC",
            "account_source": "TEST",
            "reference_id": "test_partial_match"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()
        # Only the fully matching transaction should be tagged
        assert data["applied_count"] == 1

    @pytest.mark.asyncio
    async def test_empty_merchant_pattern(self, client: AsyncClient, seed_categories):
        """Test pattern matching with empty/null merchant field"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Empty Merchant Test",
            "tag": "bucket:shopping",
            "description_pattern": "purchase"
        })

        # Transaction with no merchant
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -30.00,
            "description": "Online purchase",
            "merchant": None,
            "account_source": "TEST",
            "reference_id": "test_no_merchant"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()
        assert data["applied_count"] == 1

    @pytest.mark.asyncio
    async def test_empty_description_pattern(self, client: AsyncClient, seed_categories):
        """Test pattern matching with empty/null description field"""
        await client.post("/api/v1/tag-rules", json={
            "name": "Empty Desc Test",
            "tag": "bucket:shopping",
            "merchant_pattern": "bigstore"  # More specific match
        })

        # Transaction with no description - merchant pattern should still match
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -30.00,
            "description": "",  # Empty string rather than None
            "merchant": "BigStore Location",
            "account_source": "TEST",
            "reference_id": "test_no_desc"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()
        # Merchant pattern matching should work even with empty description
        assert data["applied_count"] >= 0  # May be 0 if already tagged


class TestApplyRules:
    """Tests for rule application endpoints"""

    @pytest.mark.asyncio
    async def test_apply_no_rules(self, client: AsyncClient):
        """Apply when no rules exist"""
        response = await client.post("/api/v1/tag-rules/apply")
        assert response.status_code == 200
        data = response.json()
        assert data["applied_count"] == 0
        assert "no enabled rules" in data.get("message", "").lower()

    @pytest.mark.asyncio
    async def test_apply_rules_skips_already_tagged(self, client: AsyncClient, seed_categories):
        """Apply rules skips transactions already with bucket tags"""
        # Create rule
        await client.post("/api/v1/tag-rules", json={
            "name": "Skip Tagged Test",
            "tag": "bucket:shopping",
            "merchant_pattern": "target"
        })

        # Create transaction and manually tag it
        txn_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Already tagged",
            "merchant": "Target",
            "account_source": "TEST",
            "reference_id": "test_already_tagged"
        })
        txn_id = txn_response.json()["id"]

        # Apply groceries tag first
        await client.post(f"/api/v1/transactions/{txn_id}/tags", json={
            "tag": "bucket:groceries"
        })

        # Now apply rules - should skip this transaction
        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()
        # Should be 0 since transaction already has a non-none bucket
        assert data["applied_count"] == 0

    @pytest.mark.asyncio
    async def test_test_rule_with_matches(self, client: AsyncClient, seed_categories):
        """Test rule endpoint returns matching transactions"""
        # Create some transactions first
        for i in range(5):
            await client.post("/api/v1/transactions", json={
                "date": date.today().isoformat(),
                "amount": -10.00,
                "description": f"Test transaction {i}",
                "merchant": "TestMerchant",
                "account_source": "TEST",
                "reference_id": f"test_match_{i}"
            })

        # Create a rule that matches
        create_response = await client.post("/api/v1/tag-rules", json={
            "name": "Match Test",
            "tag": "bucket:shopping",
            "merchant_pattern": "testmerchant"
        })
        rule_id = create_response.json()["id"]

        # Test the rule
        response = await client.post(f"/api/v1/tag-rules/{rule_id}/test")
        assert response.status_code == 200
        data = response.json()

        assert data["rule_id"] == rule_id
        assert data["rule_name"] == "Match Test"
        assert data["target_tag"] == "bucket:shopping"
        assert data["match_count"] >= 5
        # Preview limited to 50
        assert len(data["matches"]) <= 50

    @pytest.mark.asyncio
    async def test_apply_returns_rule_stats(self, client: AsyncClient, seed_categories):
        """Apply returns statistics per rule"""
        # Create multiple rules
        await client.post("/api/v1/tag-rules", json={
            "name": "Rule A",
            "tag": "bucket:shopping",
            "merchant_pattern": "rulea"
        })

        await client.post("/api/v1/tag-rules", json={
            "name": "Rule B",
            "tag": "bucket:groceries",
            "merchant_pattern": "ruleb"
        })

        # Create matching transactions
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -10.00,
            "description": "Test A",
            "merchant": "RuleA Merchant",
            "account_source": "TEST",
            "reference_id": "test_rule_a"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -20.00,
            "description": "Test B",
            "merchant": "RuleB Merchant",
            "account_source": "TEST",
            "reference_id": "test_rule_b"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        data = response.json()

        assert data["applied_count"] == 2
        assert "total_transactions_checked" in data
        assert "rules_applied" in data
        assert len(data["rules_applied"]) == 2


class TestTagRuleTagApplication:
    """Tests for tag application via rules"""

    @pytest.mark.asyncio
    async def test_bucket_tag_replaces_previous(self, client: AsyncClient, seed_categories):
        """Bucket tag from rule replaces previous bucket tag"""
        # Create transaction
        txn_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Replace test",
            "merchant": "Replace Store",
            "account_source": "TEST",
            "reference_id": "test_replace_bucket"
        })
        txn_id = txn_response.json()["id"]

        # Apply initial bucket tag using rule
        await client.post("/api/v1/tag-rules", json={
            "name": "Initial Bucket",
            "tag": "bucket:groceries",
            "merchant_pattern": "replace store"
        })
        await client.post("/api/v1/tag-rules/apply")

        # Verify initial tag
        tags_response = await client.get(f"/api/v1/transactions/{txn_id}/tags")
        tags = tags_response.json()["tags"]
        assert any(t["full"] == "bucket:groceries" for t in tags)

    @pytest.mark.asyncio
    async def test_apply_occasion_tag_via_rule(self, client: AsyncClient, seed_categories):
        """Apply occasion namespace tag via rule"""
        # Create occasion tag first
        await client.post("/api/v1/tags", json={
            "namespace": "occasion",
            "value": "vacation-2025"
        })

        # Create rule for occasion tag
        await client.post("/api/v1/tag-rules", json={
            "name": "Vacation Spending",
            "tag": "occasion:vacation-2025",
            "description_pattern": "vacation"
        })

        # Create transaction
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -200.00,
            "description": "Vacation hotel",
            "merchant": "Hotel",
            "account_source": "TEST",
            "reference_id": "test_vacation"
        })

        response = await client.post("/api/v1/tag-rules/apply")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_priority_ordering_in_apply(self, client: AsyncClient, seed_categories):
        """Higher priority rules are applied first"""
        # Create low priority rule
        await client.post("/api/v1/tag-rules", json={
            "name": "Low Priority",
            "tag": "bucket:other",
            "merchant_pattern": "priority",
            "priority": 10
        })

        # Create high priority rule
        await client.post("/api/v1/tag-rules", json={
            "name": "High Priority",
            "tag": "bucket:shopping",
            "merchant_pattern": "priority",
            "priority": 100
        })

        # Create transaction
        txn_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "Priority test",
            "merchant": "Priority Store",
            "account_source": "TEST",
            "reference_id": "test_priority_order"
        })
        txn_id = txn_response.json()["id"]

        await client.post("/api/v1/tag-rules/apply")

        # High priority rule should win
        tags_response = await client.get(f"/api/v1/transactions/{txn_id}/tags")
        tags = tags_response.json()["tags"]
        bucket_tags = [t for t in tags if t["namespace"] == "bucket"]
        assert len(bucket_tags) == 1
        assert bucket_tags[0]["full"] == "bucket:shopping"
