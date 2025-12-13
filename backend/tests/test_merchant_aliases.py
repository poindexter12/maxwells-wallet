"""
Tests for Merchant Alias functionality (v0.1)
"""

import pytest
from httpx import AsyncClient
from datetime import date


class TestMerchantAliases:
    """Merchant Alias CRUD Tests"""

    @pytest.mark.asyncio
    async def test_create_alias_exact_match(self, client: AsyncClient):
        """Create an alias with exact match type"""
        alias_data = {
            "pattern": "STARBUCKS #12345",
            "canonical_name": "Starbucks",
            "match_type": "exact",
            "priority": 10,
        }

        response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response.status_code == 201
        data = response.json()

        assert data["pattern"] == "STARBUCKS #12345"
        assert data["canonical_name"] == "Starbucks"
        assert data["match_type"] == "exact"
        assert data["priority"] == 10
        assert data["match_count"] == 0

    @pytest.mark.asyncio
    async def test_create_alias_contains_match(self, client: AsyncClient):
        """Create an alias with contains match type"""
        alias_data = {"pattern": "AMAZON", "canonical_name": "Amazon", "match_type": "contains", "priority": 5}

        response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response.status_code == 201
        data = response.json()

        assert data["match_type"] == "contains"

    @pytest.mark.asyncio
    async def test_create_alias_regex_match(self, client: AsyncClient):
        """Create an alias with regex match type"""
        alias_data = {
            "pattern": r"(?i)shell\s*(gas|station)?",
            "canonical_name": "Shell",
            "match_type": "regex",
            "priority": 5,
        }

        response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response.status_code == 201
        data = response.json()

        assert data["match_type"] == "regex"

    @pytest.mark.asyncio
    async def test_create_alias_invalid_regex(self, client: AsyncClient):
        """Creating alias with invalid regex should fail"""
        alias_data = {"pattern": r"[invalid(regex", "canonical_name": "Test", "match_type": "regex"}

        response = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "INVALID_REGEX"

    @pytest.mark.asyncio
    async def test_create_duplicate_alias(self, client: AsyncClient):
        """Creating duplicate alias should fail"""
        alias_data = {"pattern": "DUPLICATE_TEST", "canonical_name": "Test", "match_type": "exact"}

        response1 = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response1.status_code == 201

        response2 = await client.post("/api/v1/merchants/aliases", json=alias_data)
        assert response2.status_code == 400
        assert response2.json()["detail"]["error_code"] == "ALIAS_ALREADY_EXISTS"

    @pytest.mark.asyncio
    async def test_list_aliases_by_priority(self, client: AsyncClient):
        """List aliases should be ordered by priority (highest first)"""
        aliases = [
            {"pattern": "low", "canonical_name": "Low", "match_type": "contains", "priority": 1},
            {"pattern": "high", "canonical_name": "High", "match_type": "contains", "priority": 100},
            {"pattern": "medium", "canonical_name": "Medium", "match_type": "contains", "priority": 50},
        ]

        for alias in aliases:
            await client.post("/api/v1/merchants/aliases", json=alias)

        response = await client.get("/api/v1/merchants/aliases")
        assert response.status_code == 200
        data = response.json()

        assert len(data) >= 3
        priorities = [a["priority"] for a in data]
        assert priorities == sorted(priorities, reverse=True)

    @pytest.mark.asyncio
    async def test_get_alias(self, client: AsyncClient):
        """Get a single alias by ID"""
        create_response = await client.post(
            "/api/v1/merchants/aliases", json={"pattern": "GET_TEST", "canonical_name": "Test", "match_type": "exact"}
        )
        alias_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/merchants/aliases/{alias_id}")
        assert response.status_code == 200
        assert response.json()["id"] == alias_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_alias(self, client: AsyncClient):
        """Get nonexistent alias should return 404"""
        response = await client.get("/api/v1/merchants/aliases/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_alias(self, client: AsyncClient):
        """Update an alias"""
        create_response = await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": "UPDATE_TEST", "canonical_name": "Before", "match_type": "exact", "priority": 1},
        )
        alias_id = create_response.json()["id"]

        update_data = {"canonical_name": "After", "priority": 99}
        response = await client.patch(f"/api/v1/merchants/aliases/{alias_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()

        assert data["canonical_name"] == "After"
        assert data["priority"] == 99
        assert data["pattern"] == "UPDATE_TEST"  # Unchanged

    @pytest.mark.asyncio
    async def test_delete_alias(self, client: AsyncClient):
        """Delete an alias"""
        create_response = await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": "DELETE_TEST", "canonical_name": "Test", "match_type": "exact"},
        )
        alias_id = create_response.json()["id"]

        response = await client.delete(f"/api/v1/merchants/aliases/{alias_id}")
        assert response.status_code == 204

        get_response = await client.get(f"/api/v1/merchants/aliases/{alias_id}")
        assert get_response.status_code == 404


class TestMerchantAliasApplication:
    """Tests for applying aliases to transactions"""

    @pytest.mark.asyncio
    async def test_apply_exact_match(self, client: AsyncClient):
        """Apply exact match alias"""
        # Create alias
        await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": "WHOLE FOODS MKT #12345", "canonical_name": "Whole Foods", "match_type": "exact"},
        )

        # Create transaction with matching description
        await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -50.00,
                "description": "WHOLE FOODS MKT #12345",
                "merchant": "WHOLE FOODS MKT #12345",
                "account_source": "TEST",
                "reference_id": "test_exact_1",
            },
        )

        # Apply aliases (dry run)
        response = await client.post("/api/v1/merchants/aliases/apply?dry_run=true")
        assert response.status_code == 200
        data = response.json()

        assert data["dry_run"] is True
        assert data["updated_count"] >= 1
        matching = [u for u in data["updates"] if u["new_merchant"] == "Whole Foods"]
        assert len(matching) >= 1

    @pytest.mark.asyncio
    async def test_apply_contains_match(self, client: AsyncClient):
        """Apply contains match alias"""
        await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": "CHEVRON", "canonical_name": "Chevron", "match_type": "contains"},
        )

        # Create transactions with descriptions containing the pattern
        await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -40.00,
                "description": "CHEVRON GAS STATION #999 SEATTLE WA",
                "merchant": "CHEVRON GAS STATION",
                "account_source": "TEST",
                "reference_id": "test_contains_1",
            },
        )

        await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -35.00,
                "description": "chevron fuel purchase",
                "merchant": "chevron fuel",
                "account_source": "TEST",
                "reference_id": "test_contains_2",
            },
        )

        response = await client.post("/api/v1/merchants/aliases/apply?dry_run=true")
        data = response.json()

        chevron_updates = [u for u in data["updates"] if u["new_merchant"] == "Chevron"]
        assert len(chevron_updates) >= 2  # Both should match (case-insensitive)

    @pytest.mark.asyncio
    async def test_apply_regex_match(self, client: AsyncClient):
        """Apply regex match alias"""
        await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": r"(?i)taco\s*bell", "canonical_name": "Taco Bell", "match_type": "regex"},
        )

        await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -12.00,
                "description": "TACO BELL #1234",
                "merchant": "TACO BELL",
                "account_source": "TEST",
                "reference_id": "test_regex_1",
            },
        )

        await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -8.00,
                "description": "TacoBell Mobile Order",
                "merchant": "TacoBell",
                "account_source": "TEST",
                "reference_id": "test_regex_2",
            },
        )

        response = await client.post("/api/v1/merchants/aliases/apply?dry_run=true")
        data = response.json()

        taco_updates = [u for u in data["updates"] if u["new_merchant"] == "Taco Bell"]
        assert len(taco_updates) >= 2

    @pytest.mark.asyncio
    async def test_apply_persists_changes(self, client: AsyncClient):
        """Apply without dry_run should persist changes to database"""
        await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": "PERSIST_TEST", "canonical_name": "Persisted Merchant", "match_type": "contains"},
        )

        txn_response = await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -25.00,
                "description": "PERSIST_TEST STORE",
                "merchant": "Original Merchant",
                "account_source": "TEST",
                "reference_id": "test_persist_1",
            },
        )
        txn_id = txn_response.json()["id"]

        # Apply without dry_run
        response = await client.post("/api/v1/merchants/aliases/apply?dry_run=false")
        assert response.status_code == 200
        data = response.json()
        assert data["dry_run"] is False
        assert data["updated_count"] >= 1

        # Verify transaction was updated
        txn_response = await client.get(f"/api/v1/transactions/{txn_id}")
        assert txn_response.json()["merchant"] == "Persisted Merchant"

    @pytest.mark.asyncio
    async def test_apply_respects_priority(self, client: AsyncClient):
        """Higher priority aliases should be applied first"""
        # Create low priority alias (matches "PRIORITY TEST")
        await client.post(
            "/api/v1/merchants/aliases",
            json={
                "pattern": "PRIORITY TEST",
                "canonical_name": "Low Priority Result",
                "match_type": "contains",
                "priority": 1,
            },
        )

        # Create high priority alias (also matches "PRIORITY TEST" but is more general)
        # High priority should win even though both patterns match
        await client.post(
            "/api/v1/merchants/aliases",
            json={
                "pattern": "PRIORITY",
                "canonical_name": "High Priority Result",
                "match_type": "contains",
                "priority": 100,
            },
        )

        await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -10.00,
                "description": "PRIORITY TEST MERCHANT",
                "merchant": "Original",
                "account_source": "TEST",
                "reference_id": "test_priority_1",
            },
        )

        response = await client.post("/api/v1/merchants/aliases/apply?dry_run=true")
        data = response.json()

        priority_updates = [u for u in data["updates"] if "PRIORITY" in u["description"]]
        assert len(priority_updates) >= 1
        assert priority_updates[0]["new_merchant"] == "High Priority Result"

    @pytest.mark.asyncio
    async def test_apply_no_change_when_already_matched(self, client: AsyncClient):
        """Don't update if merchant already matches canonical name"""
        await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": "ALREADY", "canonical_name": "Already Matched", "match_type": "contains"},
        )

        await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -10.00,
                "description": "ALREADY MATCHED STORE",
                "merchant": "Already Matched",  # Already canonical
                "account_source": "TEST",
                "reference_id": "test_nochange_1",
            },
        )

        response = await client.post("/api/v1/merchants/aliases/apply?dry_run=true")
        data = response.json()

        # Should not appear in updates since merchant == canonical
        nochange_updates = [u for u in data["updates"] if u.get("old_merchant") == "Already Matched"]
        assert len(nochange_updates) == 0

    @pytest.mark.asyncio
    async def test_apply_updates_alias_stats(self, client: AsyncClient):
        """Applying aliases should update match_count and last_matched_date"""
        create_response = await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": "STATS_TEST", "canonical_name": "Stats Merchant", "match_type": "contains"},
        )
        alias_id = create_response.json()["id"]

        # Verify initial stats
        alias_response = await client.get(f"/api/v1/merchants/aliases/{alias_id}")
        assert alias_response.json()["match_count"] == 0
        assert alias_response.json()["last_matched_date"] is None

        # Create transactions
        for i in range(3):
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": date.today().isoformat(),
                    "amount": -10.00,
                    "description": f"STATS_TEST STORE {i}",
                    "merchant": f"Original {i}",
                    "account_source": "TEST",
                    "reference_id": f"test_stats_{i}",
                },
            )

        # Apply aliases (not dry run)
        await client.post("/api/v1/merchants/aliases/apply?dry_run=false")

        # Verify stats updated
        alias_response = await client.get(f"/api/v1/merchants/aliases/{alias_id}")
        assert alias_response.json()["match_count"] == 3
        assert alias_response.json()["last_matched_date"] is not None


class TestMerchantList:
    """Tests for listing distinct merchants"""

    @pytest.mark.asyncio
    async def test_list_merchants(self, client: AsyncClient, seed_transactions):
        """List distinct merchants from transactions"""
        response = await client.get("/api/v1/merchants/")
        assert response.status_code == 200
        data = response.json()

        assert "merchants" in data
        assert "count" in data
        assert data["count"] > 0

        # Each merchant should have name and count
        for m in data["merchants"]:
            assert "name" in m
            assert "transaction_count" in m
            assert m["transaction_count"] >= 1

    @pytest.mark.asyncio
    async def test_list_merchants_ordered_by_count(self, client: AsyncClient, seed_transactions):
        """Merchants should be ordered by transaction count (descending)"""
        response = await client.get("/api/v1/merchants/")
        data = response.json()

        counts = [m["transaction_count"] for m in data["merchants"]]
        assert counts == sorted(counts, reverse=True)


class TestAliasApplicationDuringImport:
    """Tests for alias application during CSV import"""

    @pytest.mark.asyncio
    async def test_alias_applied_on_import(self, client: AsyncClient):
        """Aliases should be applied when importing new transactions"""
        # Create alias first
        await client.post(
            "/api/v1/merchants/aliases",
            json={"pattern": "IMPORT_TEST", "canonical_name": "Imported Merchant", "match_type": "contains"},
        )

        # Import transaction via direct API (simulating import)
        txn_response = await client.post(
            "/api/v1/transactions",
            json={
                "date": date.today().isoformat(),
                "amount": -15.00,
                "description": "IMPORT_TEST PURCHASE",
                "merchant": "IMPORT_TEST ORIGINAL",
                "account_source": "TEST",
                "reference_id": "test_import_alias_1",
            },
        )

        # Note: The direct transaction API doesn't apply aliases
        # Aliases are applied during CSV import
        # This test documents the current behavior
        # After applying aliases manually, the merchant should update
        await client.post("/api/v1/merchants/aliases/apply?dry_run=false")

        txn_id = txn_response.json()["id"]
        get_response = await client.get(f"/api/v1/transactions/{txn_id}")
        assert get_response.json()["merchant"] == "Imported Merchant"
