"""
Comprehensive tests for admin.py router to increase coverage to 90%+.
"""
import pytest
from httpx import AsyncClient
import io


class TestAdminImportSessions:
    """Tests for import session management"""

    @pytest.mark.asyncio
    async def test_list_import_sessions(self, client: AsyncClient, seed_categories):
        """List all import sessions"""
        # First create an import session by importing data
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,TEST MERCHANT,JOHN DOE,XXXXX-00001,100.00
"""
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data = {"format_type": "amex_cc", "account_source": "AdminTest"}
        await client.post("/api/v1/import/confirm", files=files, data=data)

        # List import sessions
        response = await client.get("/api/v1/admin/import-sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)

    @pytest.mark.asyncio
    async def test_get_import_session_by_id(self, client: AsyncClient, seed_categories):
        """Get specific import session with transactions"""
        # Create an import session
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,SPECIFIC TEST,JOHN DOE,XXXXX-00002,50.00
"""
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data = {"format_type": "amex_cc", "account_source": "AdminTestGetID"}
        import_response = await client.post("/api/v1/import/confirm", files=files, data=data)
        session_id = import_response.json().get("import_session_id")

        if session_id:
            response = await client.get(f"/api/v1/admin/import-sessions/{session_id}")
            assert response.status_code == 200
            data = response.json()
            assert "session" in data
            assert "transactions" in data

    @pytest.mark.asyncio
    async def test_get_nonexistent_import_session(self, client: AsyncClient):
        """Get nonexistent import session returns 404"""
        response = await client.get("/api/v1/admin/import-sessions/99999")
        assert response.status_code == 404
        assert response.json()["detail"]["error_code"] == "IMPORT_SESSION_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_delete_import_session_without_confirm(self, client: AsyncClient, seed_categories):
        """Delete import session without confirm fails"""
        # Create an import session first
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,DELETE TEST,JOHN DOE,XXXXX-00003,75.00
"""
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data = {"format_type": "amex_cc", "account_source": "DeleteTestNoConfirm"}
        import_response = await client.post("/api/v1/import/confirm", files=files, data=data)
        session_id = import_response.json().get("import_session_id")

        if session_id:
            # Try to delete without proper confirm
            response = await client.delete(f"/api/v1/admin/import-sessions/{session_id}?confirm=no")
            assert response.status_code == 400
            assert response.json()["detail"]["error_code"] == "CONFIRMATION_REQUIRED"

    @pytest.mark.asyncio
    async def test_delete_import_session_with_confirm(self, client: AsyncClient, seed_categories):
        """Delete import session with proper confirm"""
        # Create an import session first
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,DELETE CONFIRM TEST,JOHN DOE,XXXXX-00004,60.00
"""
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data = {"format_type": "amex_cc", "account_source": "DeleteTestConfirm"}
        import_response = await client.post("/api/v1/import/confirm", files=files, data=data)
        session_id = import_response.json().get("import_session_id")

        if session_id:
            # Delete with proper confirm
            response = await client.delete(f"/api/v1/admin/import-sessions/{session_id}?confirm=DELETE")
            assert response.status_code == 200
            data = response.json()
            assert "deleted_transactions" in data
            assert data["session_status"] == "rolled_back"

    @pytest.mark.asyncio
    async def test_delete_nonexistent_import_session(self, client: AsyncClient):
        """Delete nonexistent import session returns 404"""
        response = await client.delete("/api/v1/admin/import-sessions/99999?confirm=DELETE")
        assert response.status_code == 404
        assert response.json()["detail"]["error_code"] == "IMPORT_SESSION_NOT_FOUND"


class TestAdminPurge:
    """Tests for purge operations"""

    @pytest.mark.asyncio
    async def test_purge_without_confirm(self, client: AsyncClient):
        """Purge all data without confirm fails"""
        response = await client.delete("/api/v1/admin/purge-all?confirm=no")
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "CONFIRMATION_REQUIRED"

    @pytest.mark.asyncio
    async def test_purge_with_wrong_confirm(self, client: AsyncClient):
        """Purge all data with wrong confirm fails"""
        response = await client.delete("/api/v1/admin/purge-all?confirm=yes")
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "CONFIRMATION_REQUIRED"

    @pytest.mark.asyncio
    async def test_purge_all_with_confirm(self, client: AsyncClient):
        """Purge all data with proper confirm - tests full purge code path"""
        # First, create various data items to be purged

        # 1. Create a budget
        await client.post("/api/v1/tags", json={"namespace": "bucket", "value": "purge-test-bucket"})
        await client.post("/api/v1/budgets", json={
            "tag": "bucket:purge-test-bucket",
            "amount": 100.0,
            "period": "monthly"
        })

        # 2. Create a tag rule
        await client.post("/api/v1/tag-rules", json={
            "tag": "bucket:purge-test-bucket",
            "merchant_pattern": "PURGE_TEST",
            "priority": 1
        })

        # 3. Create a merchant alias
        await client.post("/api/v1/merchants/aliases", json={
            "pattern": "PURGE_ALIAS",
            "canonical_name": "Purge Test Merchant",
            "match_type": "exact"
        })

        # 4. Create a saved filter
        await client.post("/api/v1/filters", json={
            "name": "Purge Test Filter",
            "filter_config": {"search": "test"}
        })

        # 5. Create a non-default dashboard
        await client.post("/api/v1/dashboards", json={
            "name": "Purge Test Dashboard",
            "is_default": False
        })

        # 6. Create an occasion tag
        await client.post("/api/v1/tags", json={"namespace": "occasion", "value": "purge-test-occasion"})

        # 7. Import a transaction
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,PURGE TEST TXN,JOHN DOE,XXXXX-99999,25.00
"""
        files = {"file": ("purge_test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data = {"format_type": "amex_cc", "account_source": "PurgeTestAccount"}
        await client.post("/api/v1/import/confirm", files=files, data=data)

        # Now purge everything
        response = await client.delete("/api/v1/admin/purge-all?confirm=PURGE_ALL")
        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "counts" in data
        assert data["clear_browser_storage"] is True
        assert "message" in data

        # Verify counts are present
        counts = data["counts"]
        assert "transactions" in counts
        assert "budgets" in counts
        assert "tag_rules" in counts
        assert "merchant_aliases" in counts
        assert "saved_filters" in counts
        assert "dashboards_deleted" in counts
        assert "tags_deleted" in counts

        # Verify data was actually purged
        # Check transactions are gone
        txn_response = await client.get("/api/v1/transactions")
        assert txn_response.status_code == 200
        txn_data = txn_response.json()
        # Handle both paginated response and list response
        if isinstance(txn_data, dict) and "items" in txn_data:
            assert txn_data["items"] == []
        else:
            assert txn_data == []

        # Check budgets are gone
        budget_response = await client.get("/api/v1/budgets")
        assert budget_response.status_code == 200
        assert budget_response.json() == []

        # Check tag rules are gone
        rules_response = await client.get("/api/v1/tag-rules")
        assert rules_response.status_code == 200
        assert rules_response.json() == []

        # Check merchant aliases are gone
        alias_response = await client.get("/api/v1/merchants/aliases")
        assert alias_response.status_code == 200
        assert alias_response.json() == []

        # Check saved filters are gone
        filters_response = await client.get("/api/v1/filters")
        assert filters_response.status_code == 200
        assert filters_response.json() == []

    @pytest.mark.asyncio
    async def test_purge_all_with_all_data_types(self, client: AsyncClient):
        """Purge with all data types to maximize coverage"""
        # Create recurring pattern
        await client.post("/api/v1/recurring", json={
            "merchant_pattern": "PURGE_RECURRING",
            "expected_amount": 50.0,
            "frequency": "monthly"
        })

        # Create app settings
        await client.patch("/api/v1/settings", json={"theme": "dark"})

        # Now purge
        response = await client.delete("/api/v1/admin/purge-all?confirm=PURGE_ALL")
        assert response.status_code == 200
        data = response.json()

        # Check recurring patterns were counted
        assert "recurring_patterns" in data["counts"]

        # Check app settings reset flag
        assert "app_settings_reset" in data["counts"]

    @pytest.mark.asyncio
    async def test_purge_preserves_account_tags(self, client: AsyncClient):
        """Purge preserves account tags but deletes bucket/occasion tags"""
        # Create tags of each type
        await client.post("/api/v1/tags", json={"namespace": "account", "value": "preserve-account"})
        await client.post("/api/v1/tags", json={"namespace": "bucket", "value": "delete-bucket"})
        await client.post("/api/v1/tags", json={"namespace": "occasion", "value": "delete-occasion"})

        # Purge
        response = await client.delete("/api/v1/admin/purge-all?confirm=PURGE_ALL")
        assert response.status_code == 200

        # Check that account tag still exists
        tags_response = await client.get("/api/v1/tags?namespace=account")
        account_tags = tags_response.json()
        account_values = [t["value"] for t in account_tags]
        assert "preserve-account" in account_values

        # Bucket and occasion tags should be gone (except bucket:none)
        bucket_response = await client.get("/api/v1/tags?namespace=bucket")
        bucket_tags = bucket_response.json()
        bucket_values = [t["value"] for t in bucket_tags]
        assert "delete-bucket" not in bucket_values

        occasion_response = await client.get("/api/v1/tags?namespace=occasion")
        occasion_tags = occasion_response.json()
        occasion_values = [t["value"] for t in occasion_tags]
        assert "delete-occasion" not in occasion_values


class TestAdminStats:
    """Tests for admin statistics"""

    @pytest.mark.asyncio
    async def test_get_admin_stats(self, client: AsyncClient, seed_transactions):
        """Get database statistics"""
        response = await client.get("/api/v1/admin/stats")
        assert response.status_code == 200
        data = response.json()

        assert "total_transactions" in data
        assert "account_stats" in data
        assert "total_import_sessions" in data
        assert "import_session_status" in data
        assert isinstance(data["account_stats"], list)

    @pytest.mark.asyncio
    async def test_get_admin_stats_empty_db(self, client: AsyncClient):
        """Get stats with empty database"""
        response = await client.get("/api/v1/admin/stats")
        assert response.status_code == 200
        # Should still return valid structure even if empty
        data = response.json()
        assert "total_transactions" in data
