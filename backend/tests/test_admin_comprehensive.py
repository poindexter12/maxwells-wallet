"""
Comprehensive tests for admin.py router to increase coverage.
"""
import pytest
from httpx import AsyncClient
import io


class TestAdminRouter:
    """Tests for admin endpoints"""

    @pytest.mark.asyncio
    async def test_get_stats(self, client: AsyncClient, seed_transactions):
        """Get database statistics"""
        response = await client.get("/api/v1/admin/stats")
        assert response.status_code == 200
        data = response.json()

        assert "total_transactions" in data
        assert "total_import_sessions" in data
        assert "account_stats" in data
        assert isinstance(data["account_stats"], list)

    @pytest.mark.asyncio
    async def test_list_import_sessions(self, client: AsyncClient, seed_categories):
        """List import sessions"""
        # First create an import session by importing data
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,TEST MERCHANT,JOHN DOE,XXXXX-00001,100.00
"""
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data = {"format_type": "amex_cc", "account_source": "AdminTest"}
        await client.post("/api/v1/import/confirm", files=files, data=data)

        # Now list import sessions
        response = await client.get("/api/v1/admin/import-sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        assert len(sessions) >= 1

    @pytest.mark.asyncio
    async def test_get_import_session_by_id(self, client: AsyncClient, seed_categories):
        """Get specific import session by ID"""
        # List sessions and get first one if exists
        list_response = await client.get("/api/v1/admin/import-sessions")
        sessions = list_response.json()

        if sessions:
            session_id = sessions[0].get("id")
            if session_id:
                response = await client.get(f"/api/v1/admin/import-sessions/{session_id}")
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_import_session(self, client: AsyncClient):
        """Get nonexistent import session returns 404"""
        response = await client.get("/api/v1/admin/import-sessions/99999")
        assert response.status_code == 404
