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
        assert "not found" in response.json()["detail"]

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
            assert "confirm='DELETE'" in response.json()["detail"]

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


class TestAdminPurge:
    """Tests for purge operations"""

    @pytest.mark.asyncio
    async def test_purge_without_confirm(self, client: AsyncClient):
        """Purge all transactions without confirm fails"""
        response = await client.delete("/api/v1/admin/transactions/purge-all?confirm=no")
        assert response.status_code == 400
        assert "PURGE_ALL" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_purge_with_wrong_confirm(self, client: AsyncClient):
        """Purge all transactions with wrong confirm fails"""
        response = await client.delete("/api/v1/admin/transactions/purge-all?confirm=yes")
        assert response.status_code == 400

    # NOTE: We don't test actual purge since it would destroy test data
    # The code path for PURGE_ALL=true would delete everything


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
