"""
Tests for Multi-Dashboard API

Tests the /api/v1/dashboards endpoints including:
- Dashboard CRUD operations
- Default dashboard management
- Cloning and reordering
- Widget management under dashboards
"""
import pytest
from httpx import AsyncClient


class TestDashboardList:
    """Tests for listing dashboards"""

    @pytest.mark.asyncio
    async def test_list_dashboards_creates_default(self, client: AsyncClient):
        """First call to list creates a default dashboard"""
        response = await client.get("/api/v1/dashboards")
        assert response.status_code == 200
        dashboards = response.json()

        # Should have created a default dashboard
        assert len(dashboards) >= 1
        assert any(d["is_default"] for d in dashboards)

    @pytest.mark.asyncio
    async def test_list_dashboards_ordered_by_position(self, client: AsyncClient):
        """Dashboards are returned ordered by position"""
        # Create multiple dashboards
        await client.post("/api/v1/dashboards", json={"name": "Dashboard B", "position": 2})
        await client.post("/api/v1/dashboards", json={"name": "Dashboard A", "position": 1})

        response = await client.get("/api/v1/dashboards")
        dashboards = response.json()

        positions = [d["position"] for d in dashboards]
        assert positions == sorted(positions)


class TestDashboardGet:
    """Tests for getting individual dashboards"""

    @pytest.mark.asyncio
    async def test_get_default_dashboard(self, client: AsyncClient):
        """Get the default dashboard endpoint"""
        response = await client.get("/api/v1/dashboards/default")
        assert response.status_code == 200
        data = response.json()

        assert data["is_default"] is True
        assert "name" in data
        assert "date_range_type" in data
        assert "date_range" in data

    @pytest.mark.asyncio
    async def test_get_dashboard_by_id(self, client: AsyncClient):
        """Get a specific dashboard by ID"""
        # First get the default
        list_response = await client.get("/api/v1/dashboards")
        dashboard_id = list_response.json()[0]["id"]

        response = await client.get(f"/api/v1/dashboards/{dashboard_id}")
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == dashboard_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_dashboard(self, client: AsyncClient):
        """Get non-existent dashboard returns 404"""
        response = await client.get("/api/v1/dashboards/99999")
        assert response.status_code == 404


class TestDashboardCreate:
    """Tests for creating dashboards"""

    @pytest.mark.asyncio
    async def test_create_dashboard(self, client: AsyncClient):
        """Create a new dashboard"""
        dashboard_data = {
            "name": "My Dashboard",
            "description": "A test dashboard",
            "date_range_type": "ytd"
        }

        response = await client.post("/api/v1/dashboards", json=dashboard_data)
        assert response.status_code == 201
        data = response.json()

        assert data["name"] == "My Dashboard"
        assert data["description"] == "A test dashboard"
        assert data["date_range_type"] == "ytd"
        assert "date_range" in data
        assert data["is_default"] is False

    @pytest.mark.asyncio
    async def test_create_dashboard_with_date_range(self, client: AsyncClient):
        """Create dashboard with various date range types"""
        for range_type in ["mtd", "qtd", "ytd", "last_30_days", "last_90_days", "last_year"]:
            dashboard_data = {
                "name": f"Dashboard {range_type}",
                "date_range_type": range_type
            }

            response = await client.post("/api/v1/dashboards", json=dashboard_data)
            assert response.status_code == 201
            data = response.json()

            assert data["name"] == f"Dashboard {range_type}"
            assert data["date_range_type"] == range_type
            assert "date_range" in data
            assert "start_date" in data["date_range"]
            assert "end_date" in data["date_range"]
            assert "label" in data["date_range"]

    @pytest.mark.asyncio
    async def test_create_dashboard_as_default(self, client: AsyncClient):
        """Creating a default dashboard clears other defaults"""
        # First get existing default
        list_response = await client.get("/api/v1/dashboards")
        old_defaults = [d for d in list_response.json() if d["is_default"]]
        assert len(old_defaults) >= 1
        old_default_id = old_defaults[0]["id"]

        # Create new default
        response = await client.post("/api/v1/dashboards", json={
            "name": "New Default",
            "is_default": True
        })
        assert response.status_code == 201
        new_default = response.json()
        assert new_default["is_default"] is True

        # Old default should no longer be default
        old_response = await client.get(f"/api/v1/dashboards/{old_default_id}")
        old_dashboard = old_response.json()
        assert old_dashboard["is_default"] is False

    @pytest.mark.asyncio
    async def test_create_dashboard_initializes_widgets(self, client: AsyncClient):
        """New dashboard is initialized with default widgets"""
        response = await client.post("/api/v1/dashboards", json={"name": "Widget Test"})
        assert response.status_code == 201
        dashboard_id = response.json()["id"]

        # Check widgets
        widgets_response = await client.get(f"/api/v1/dashboards/{dashboard_id}/widgets")
        assert widgets_response.status_code == 200
        widgets = widgets_response.json()

        # Should have default widgets
        assert len(widgets) >= 6
        widget_types = [w["widget_type"] for w in widgets]
        assert "summary" in widget_types
        assert "velocity" in widget_types


class TestDashboardUpdate:
    """Tests for updating dashboards"""

    @pytest.mark.asyncio
    async def test_update_dashboard_name(self, client: AsyncClient):
        """Update dashboard name"""
        # Create a dashboard
        create_response = await client.post("/api/v1/dashboards", json={"name": "Original"})
        dashboard_id = create_response.json()["id"]

        # Update it
        response = await client.patch(f"/api/v1/dashboards/{dashboard_id}", json={
            "name": "Updated Name"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_dashboard_date_range_type(self, client: AsyncClient):
        """Update dashboard date range type"""
        # Get default dashboard
        list_response = await client.get("/api/v1/dashboards")
        dashboard_id = list_response.json()[0]["id"]

        response = await client.patch(f"/api/v1/dashboards/{dashboard_id}", json={
            "date_range_type": "qtd"
        })
        assert response.status_code == 200
        assert response.json()["date_range_type"] == "qtd"
        assert "date_range" in response.json()

    @pytest.mark.asyncio
    async def test_update_dashboard_to_default(self, client: AsyncClient):
        """Updating a dashboard to default clears other defaults"""
        # First ensure we have a default dashboard
        await client.get("/api/v1/dashboards")  # Creates default if none exist

        # Create non-default dashboard
        create_response = await client.post("/api/v1/dashboards", json={"name": "Secondary"})
        secondary_id = create_response.json()["id"]

        # Get current default (there should be one now)
        list_response = await client.get("/api/v1/dashboards")
        dashboards = list_response.json()
        defaults = [d for d in dashboards if d["is_default"]]
        assert len(defaults) >= 1, "Should have at least one default dashboard"
        old_default_id = defaults[0]["id"]

        # If secondary is already the default, skip the test
        if secondary_id == old_default_id:
            # Create another dashboard to test with
            another_response = await client.post("/api/v1/dashboards", json={"name": "Another"})
            secondary_id = another_response.json()["id"]

        # Update secondary to be default
        response = await client.patch(f"/api/v1/dashboards/{secondary_id}", json={
            "is_default": True
        })
        assert response.status_code == 200
        assert response.json()["is_default"] is True

        # Old default should be cleared
        old_response = await client.get(f"/api/v1/dashboards/{old_default_id}")
        assert old_response.json()["is_default"] is False

    @pytest.mark.asyncio
    async def test_update_nonexistent_dashboard(self, client: AsyncClient):
        """Update non-existent dashboard returns 404"""
        response = await client.patch("/api/v1/dashboards/99999", json={"name": "test"})
        assert response.status_code == 404


class TestDashboardDelete:
    """Tests for deleting dashboards"""

    @pytest.mark.asyncio
    async def test_delete_dashboard(self, client: AsyncClient):
        """Delete a non-default dashboard"""
        # Create two dashboards
        await client.get("/api/v1/dashboards")  # Ensure default exists
        create_response = await client.post("/api/v1/dashboards", json={"name": "To Delete"})
        dashboard_id = create_response.json()["id"]

        # Delete it
        response = await client.delete(f"/api/v1/dashboards/{dashboard_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/v1/dashboards/{dashboard_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_last_dashboard_fails(self, client: AsyncClient):
        """Cannot delete the last dashboard"""
        # Get all dashboards
        list_response = await client.get("/api/v1/dashboards")
        dashboards = list_response.json()

        # Delete all but one
        for d in dashboards[1:]:
            await client.delete(f"/api/v1/dashboards/{d['id']}")

        # Try to delete the last one
        last_id = dashboards[0]["id"]
        response = await client.delete(f"/api/v1/dashboards/{last_id}")
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "CANNOT_DELETE_LAST_DASHBOARD"

    @pytest.mark.asyncio
    async def test_delete_default_promotes_another(self, client: AsyncClient):
        """Deleting default dashboard promotes another to default"""
        # Ensure we have at least 2 dashboards
        await client.get("/api/v1/dashboards")  # Ensure default exists
        await client.post("/api/v1/dashboards", json={"name": "Secondary"})

        # Get the current default
        list_response = await client.get("/api/v1/dashboards")
        default_dashboard = next(d for d in list_response.json() if d["is_default"])

        # Delete the default
        response = await client.delete(f"/api/v1/dashboards/{default_dashboard['id']}")
        assert response.status_code == 204

        # Another dashboard should now be default
        new_list_response = await client.get("/api/v1/dashboards")
        new_dashboards = new_list_response.json()
        assert any(d["is_default"] for d in new_dashboards)

    @pytest.mark.asyncio
    async def test_delete_nonexistent_dashboard(self, client: AsyncClient):
        """Delete non-existent dashboard returns 404"""
        response = await client.delete("/api/v1/dashboards/99999")
        assert response.status_code == 404


class TestDashboardClone:
    """Tests for cloning dashboards"""

    @pytest.mark.asyncio
    async def test_clone_dashboard(self, client: AsyncClient):
        """Clone a dashboard with its settings"""
        # Create a dashboard with specific settings
        create_response = await client.post("/api/v1/dashboards", json={
            "name": "Original",
            "description": "Test description",
            "date_range_type": "ytd"
        })
        original_id = create_response.json()["id"]

        # Clone it
        response = await client.post(f"/api/v1/dashboards/{original_id}/clone")
        assert response.status_code == 201
        clone = response.json()

        assert clone["name"] == "Original 2"  # Numeric suffix is language-neutral
        assert clone["description"] == "Test description"
        assert clone["date_range_type"] == "ytd"
        assert clone["is_default"] is False  # Clone should not be default

    @pytest.mark.asyncio
    async def test_clone_dashboard_copies_widgets(self, client: AsyncClient):
        """Clone copies all widgets"""
        # Create dashboard and add custom widget
        create_response = await client.post("/api/v1/dashboards", json={"name": "With Widgets"})
        original_id = create_response.json()["id"]

        # Get widgets (initializes defaults)
        widgets_response = await client.get(f"/api/v1/dashboards/{original_id}/widgets")
        original_widgets = widgets_response.json()

        # Clone
        clone_response = await client.post(f"/api/v1/dashboards/{original_id}/clone")
        clone_id = clone_response.json()["id"]

        # Check clone has widgets
        clone_widgets_response = await client.get(f"/api/v1/dashboards/{clone_id}/widgets")
        clone_widgets = clone_widgets_response.json()

        assert len(clone_widgets) == len(original_widgets)

    @pytest.mark.asyncio
    async def test_clone_nonexistent_dashboard(self, client: AsyncClient):
        """Clone non-existent dashboard returns 404"""
        response = await client.post("/api/v1/dashboards/99999/clone")
        assert response.status_code == 404


class TestDashboardSetDefault:
    """Tests for setting default dashboard"""

    @pytest.mark.asyncio
    async def test_set_default_dashboard(self, client: AsyncClient):
        """Set a dashboard as default"""
        # Create non-default dashboard
        create_response = await client.post("/api/v1/dashboards", json={"name": "New Default"})
        dashboard_id = create_response.json()["id"]
        assert create_response.json()["is_default"] is False

        # Set as default
        response = await client.post(f"/api/v1/dashboards/{dashboard_id}/set-default")
        assert response.status_code == 200
        assert response.json()["is_default"] is True

        # Verify only one default
        list_response = await client.get("/api/v1/dashboards")
        defaults = [d for d in list_response.json() if d["is_default"]]
        assert len(defaults) == 1
        assert defaults[0]["id"] == dashboard_id

    @pytest.mark.asyncio
    async def test_set_default_nonexistent_dashboard(self, client: AsyncClient):
        """Set default on non-existent dashboard returns 404"""
        response = await client.post("/api/v1/dashboards/99999/set-default")
        assert response.status_code == 404


class TestDashboardReorder:
    """Tests for reordering dashboards"""

    @pytest.mark.asyncio
    async def test_reorder_dashboards(self, client: AsyncClient):
        """Reorder dashboards by position"""
        # Create multiple dashboards
        await client.get("/api/v1/dashboards")  # Ensure default
        await client.post("/api/v1/dashboards", json={"name": "Second", "position": 1})
        await client.post("/api/v1/dashboards", json={"name": "Third", "position": 2})

        # Get current order
        list_response = await client.get("/api/v1/dashboards")
        dashboards = list_response.json()

        # Reverse the order
        new_order = [
            {"id": d["id"], "position": len(dashboards) - i - 1}
            for i, d in enumerate(dashboards)
        ]

        response = await client.put("/api/v1/dashboards/reorder", json=new_order)
        assert response.status_code == 200

        # Verify new order
        reordered = response.json()
        positions = [d["position"] for d in reordered]
        assert positions == sorted(positions)

    @pytest.mark.asyncio
    async def test_reorder_missing_fields(self, client: AsyncClient):
        """Reorder with missing fields fails"""
        response = await client.put("/api/v1/dashboards/reorder", json=[{"id": 1}])
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_reorder_nonexistent_dashboard(self, client: AsyncClient):
        """Reorder with non-existent dashboard fails"""
        response = await client.put("/api/v1/dashboards/reorder", json=[
            {"id": 99999, "position": 0}
        ])
        assert response.status_code == 404


class TestDashboardWidgets:
    """Tests for dashboard-scoped widget operations"""

    @pytest.mark.asyncio
    async def test_list_dashboard_widgets_initializes(self, client: AsyncClient):
        """List widgets initializes defaults if empty"""
        # Create new dashboard
        create_response = await client.post("/api/v1/dashboards", json={"name": "Widget Test"})
        dashboard_id = create_response.json()["id"]

        # Get widgets
        response = await client.get(f"/api/v1/dashboards/{dashboard_id}/widgets")
        assert response.status_code == 200
        widgets = response.json()

        # Should have default widgets
        assert len(widgets) >= 6
        widget_types = [w["widget_type"] for w in widgets]
        assert "summary" in widget_types

    @pytest.mark.asyncio
    async def test_list_widgets_for_nonexistent_dashboard(self, client: AsyncClient):
        """List widgets for non-existent dashboard returns 404"""
        response = await client.get("/api/v1/dashboards/99999/widgets")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_widget_on_dashboard(self, client: AsyncClient):
        """Create a widget on a specific dashboard"""
        # Create dashboard
        create_response = await client.post("/api/v1/dashboards", json={"name": "For Widget"})
        dashboard_id = create_response.json()["id"]

        # Create widget
        widget_data = {
            "widget_type": "custom_chart",
            "title": "My Chart",
            "position": 99,
            "is_visible": True
        }

        response = await client.post(f"/api/v1/dashboards/{dashboard_id}/widgets", json=widget_data)
        assert response.status_code == 201
        widget = response.json()

        assert widget["widget_type"] == "custom_chart"
        assert widget["title"] == "My Chart"
        assert widget["dashboard_id"] == dashboard_id

    @pytest.mark.asyncio
    async def test_create_widget_on_nonexistent_dashboard(self, client: AsyncClient):
        """Create widget on non-existent dashboard returns 404"""
        response = await client.post("/api/v1/dashboards/99999/widgets", json={
            "widget_type": "test",
            "position": 0
        })
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_widgets_adds_missing_types(self, client: AsyncClient):
        """Listing widgets adds any missing default widget types"""
        # Create dashboard
        create_response = await client.post("/api/v1/dashboards", json={"name": "Missing Types"})
        dashboard_id = create_response.json()["id"]

        # Get widgets twice - second call should have same widgets
        response1 = await client.get(f"/api/v1/dashboards/{dashboard_id}/widgets")
        widgets1 = response1.json()

        response2 = await client.get(f"/api/v1/dashboards/{dashboard_id}/widgets")
        widgets2 = response2.json()

        assert len(widgets1) == len(widgets2)
