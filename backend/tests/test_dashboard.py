"""
Tests for Dashboard Widget API
"""
import pytest
from httpx import AsyncClient


class TestDashboardWidgets:
    """Tests for dashboard widget configuration"""

    @pytest.mark.asyncio
    async def test_list_widgets_initializes_defaults(self, client: AsyncClient):
        """First call to list widgets creates default configuration"""
        response = await client.get("/api/v1/dashboard/widgets")
        assert response.status_code == 200
        widgets = response.json()

        # Should have default widgets
        assert len(widgets) >= 6
        widget_types = [w["widget_type"] for w in widgets]
        assert "summary" in widget_types
        assert "velocity" in widget_types
        assert "bucket_pie" in widget_types

    @pytest.mark.asyncio
    async def test_list_widgets_ordered_by_position(self, client: AsyncClient):
        """Widgets are returned ordered by position"""
        response = await client.get("/api/v1/dashboard/widgets")
        assert response.status_code == 200
        widgets = response.json()

        positions = [w["position"] for w in widgets]
        assert positions == sorted(positions)

    @pytest.mark.asyncio
    async def test_get_widget_by_id(self, client: AsyncClient):
        """Get a specific widget by ID"""
        # First get the list
        list_response = await client.get("/api/v1/dashboard/widgets")
        widget_id = list_response.json()[0]["id"]

        response = await client.get(f"/api/v1/dashboard/widgets/{widget_id}")
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == widget_id
        assert "widget_type" in data
        assert "position" in data

    @pytest.mark.asyncio
    async def test_get_nonexistent_widget(self, client: AsyncClient):
        """Get non-existent widget returns 404"""
        response = await client.get("/api/v1/dashboard/widgets/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_widget(self, client: AsyncClient):
        """Create a new dashboard widget"""
        widget_data = {
            "widget_type": "custom_chart",
            "title": "My Custom Chart",
            "position": 10,
            "width": "full",
            "is_visible": True
        }

        response = await client.post("/api/v1/dashboard/widgets", json=widget_data)
        assert response.status_code == 201
        data = response.json()

        assert data["widget_type"] == "custom_chart"
        assert data["title"] == "My Custom Chart"
        assert data["position"] == 10
        assert data["width"] == "full"

    @pytest.mark.asyncio
    async def test_update_widget(self, client: AsyncClient):
        """Update widget settings"""
        # Get a widget ID
        list_response = await client.get("/api/v1/dashboard/widgets")
        widget_id = list_response.json()[0]["id"]

        update_data = {
            "title": "Updated Title",
            "width": "third"
        }

        response = await client.patch(f"/api/v1/dashboard/widgets/{widget_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()

        assert data["title"] == "Updated Title"
        assert data["width"] == "third"

    @pytest.mark.asyncio
    async def test_update_nonexistent_widget(self, client: AsyncClient):
        """Update non-existent widget returns 404"""
        response = await client.patch("/api/v1/dashboard/widgets/99999", json={"title": "test"})
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_widget(self, client: AsyncClient):
        """Delete a widget"""
        # Create a widget to delete
        create_response = await client.post("/api/v1/dashboard/widgets", json={
            "widget_type": "deleteme",
            "position": 99
        })
        widget_id = create_response.json()["id"]

        # Delete it
        response = await client.delete(f"/api/v1/dashboard/widgets/{widget_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/v1/dashboard/widgets/{widget_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_widget(self, client: AsyncClient):
        """Delete non-existent widget returns 404"""
        response = await client.delete("/api/v1/dashboard/widgets/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_layout(self, client: AsyncClient):
        """Batch update widget positions"""
        # Get current widgets
        list_response = await client.get("/api/v1/dashboard/widgets")
        widgets = list_response.json()

        # Reverse the order
        layout_update = {
            "widgets": [
                {"id": w["id"], "position": len(widgets) - i - 1}
                for i, w in enumerate(widgets)
            ]
        }

        response = await client.put("/api/v1/dashboard/layout", json=layout_update)
        assert response.status_code == 200
        updated_widgets = response.json()

        # Verify new order
        positions = [w["position"] for w in updated_widgets]
        assert positions == sorted(positions)

    @pytest.mark.asyncio
    async def test_update_layout_invalid_format(self, client: AsyncClient):
        """Layout update with missing fields fails"""
        response = await client.put("/api/v1/dashboard/layout", json={
            "widgets": [{"id": 1}]  # Missing position
        })
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_layout_nonexistent_widget(self, client: AsyncClient):
        """Layout update with non-existent widget fails"""
        response = await client.put("/api/v1/dashboard/layout", json={
            "widgets": [{"id": 99999, "position": 0}]
        })
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_toggle_visibility(self, client: AsyncClient):
        """Toggle widget visibility"""
        # Get a widget
        list_response = await client.get("/api/v1/dashboard/widgets")
        widget = list_response.json()[0]
        widget_id = widget["id"]
        original_visibility = widget["is_visible"]

        # Toggle
        response = await client.patch(f"/api/v1/dashboard/widgets/{widget_id}/visibility")
        assert response.status_code == 200
        data = response.json()

        assert data["is_visible"] == (not original_visibility)

        # Toggle back
        response = await client.patch(f"/api/v1/dashboard/widgets/{widget_id}/visibility")
        assert response.json()["is_visible"] == original_visibility

    @pytest.mark.asyncio
    async def test_reset_dashboard(self, client: AsyncClient):
        """Reset dashboard to defaults"""
        # First make some changes
        list_response = await client.get("/api/v1/dashboard/widgets")
        widget_id = list_response.json()[0]["id"]
        await client.patch(f"/api/v1/dashboard/widgets/{widget_id}", json={"title": "Modified"})

        # Reset
        response = await client.post("/api/v1/dashboard/reset")
        assert response.status_code == 200
        widgets = response.json()

        # Should have default widgets
        assert len(widgets) >= 6
        # Titles should be defaults
        summary_widget = next((w for w in widgets if w["widget_type"] == "summary"), None)
        assert summary_widget is not None
        assert summary_widget["title"] == "Summary"

    @pytest.mark.asyncio
    async def test_widget_config_json(self, client: AsyncClient):
        """Widget config field stores JSON string"""
        import json

        config = {"dateRange": "30d", "showLabels": True}
        widget_data = {
            "widget_type": "configured_widget",
            "config": json.dumps(config),
            "position": 20
        }

        response = await client.post("/api/v1/dashboard/widgets", json=widget_data)
        assert response.status_code == 201
        data = response.json()

        stored_config = json.loads(data["config"])
        assert stored_config["dateRange"] == "30d"
        assert stored_config["showLabels"] is True

    @pytest.mark.asyncio
    async def test_duplicate_widget(self, client: AsyncClient):
        """Duplicate a widget creates a copy with new position"""
        # Get a widget to duplicate
        list_response = await client.get("/api/v1/dashboard/widgets")
        widget_id = list_response.json()[0]["id"]
        original_title = list_response.json()[0]["title"]

        # Duplicate it
        response = await client.post(f"/api/v1/dashboard/widgets/{widget_id}/duplicate")
        assert response.status_code == 201
        data = response.json()

        # Should have "(copy)" in title
        assert "(copy)" in data["title"]
        assert data["id"] != widget_id
        assert data["is_visible"] is True

    @pytest.mark.asyncio
    async def test_duplicate_nonexistent_widget(self, client: AsyncClient):
        """Duplicate non-existent widget returns 404"""
        response = await client.post("/api/v1/dashboard/widgets/99999/duplicate")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_widgets_adds_missing_types(self, client: AsyncClient):
        """Listing widgets adds any missing default widget types"""
        # First get widgets - this initializes defaults
        response1 = await client.get("/api/v1/dashboard/widgets")
        widgets1 = response1.json()
        initial_count = len(widgets1)

        # Delete one widget type
        widget_to_delete = next(w for w in widgets1 if w["widget_type"] == "velocity")
        await client.delete(f"/api/v1/dashboard/widgets/{widget_to_delete['id']}")

        # List again - should add the missing type back
        response2 = await client.get("/api/v1/dashboard/widgets")
        widgets2 = response2.json()

        # Should have added the missing velocity widget back
        widget_types = [w["widget_type"] for w in widgets2]
        assert "velocity" in widget_types
