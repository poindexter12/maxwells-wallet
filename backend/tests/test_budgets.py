"""
Tests for Budget Tracking (v0.3)
"""
import pytest
from httpx import AsyncClient
from datetime import date


class TestBudgets:
    """Budget Tracking Tests"""

    @pytest.mark.asyncio
    async def test_create_budget(self, client: AsyncClient, seed_categories):
        """Create a new budget"""
        budget_data = {
            "category": "Groceries",
            "amount": 500.00,
            "period": "monthly",
            "rollover_enabled": False
        }

        response = await client.post("/api/v1/budgets", json=budget_data)
        assert response.status_code == 201
        data = response.json()

        assert data["category"] == "Groceries"
        assert data["amount"] == 500.00
        assert data["period"] == "monthly"
        assert data["rollover_enabled"] is False

    @pytest.mark.asyncio
    async def test_list_budgets(self, client: AsyncClient, seed_categories):
        """List all budgets"""
        # Create some budgets first
        budgets = [
            {"category": "Groceries", "amount": 500.00, "period": "monthly"},
            {"category": "Dining & Coffee", "amount": 300.00, "period": "monthly"},
        ]

        for budget in budgets:
            await client.post("/api/v1/budgets", json=budget)

        # List budgets
        response = await client.get("/api/v1/budgets")
        assert response.status_code == 200
        data = response.json()

        assert len(data) == 2
        assert any(b["category"] == "Groceries" for b in data)
        assert any(b["category"] == "Dining & Coffee" for b in data)

    @pytest.mark.asyncio
    async def test_get_budget(self, client: AsyncClient, seed_categories):
        """Get a single budget by ID"""
        # Create budget
        create_response = await client.post("/api/v1/budgets", json={
            "category": "Groceries",
            "amount": 500.00,
            "period": "monthly"
        })
        budget_id = create_response.json()["id"]

        # Get budget
        response = await client.get(f"/api/v1/budgets/{budget_id}")
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == budget_id
        assert data["category"] == "Groceries"

    @pytest.mark.asyncio
    async def test_update_budget(self, client: AsyncClient, seed_categories):
        """Update a budget"""
        # Create budget
        create_response = await client.post("/api/v1/budgets", json={
            "category": "Groceries",
            "amount": 500.00,
            "period": "monthly"
        })
        budget_id = create_response.json()["id"]

        # Update budget
        update_data = {"amount": 600.00}
        response = await client.patch(f"/api/v1/budgets/{budget_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()

        assert data["amount"] == 600.00
        assert data["category"] == "Groceries"  # Unchanged

    @pytest.mark.asyncio
    async def test_delete_budget(self, client: AsyncClient, seed_categories):
        """Delete a budget"""
        # Create budget
        create_response = await client.post("/api/v1/budgets", json={
            "category": "Groceries",
            "amount": 500.00,
            "period": "monthly"
        })
        budget_id = create_response.json()["id"]

        # Delete budget
        response = await client.delete(f"/api/v1/budgets/{budget_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/v1/budgets/{budget_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_duplicate_budget(self, client: AsyncClient, seed_categories):
        """Prevent duplicate budgets for same category and period"""
        budget_data = {
            "category": "Groceries",
            "amount": 500.00,
            "period": "monthly"
        }

        # Create first budget
        response1 = await client.post("/api/v1/budgets", json=budget_data)
        assert response1.status_code == 201

        # Try to create duplicate
        response2 = await client.post("/api/v1/budgets", json=budget_data)
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_budget_status(self, client: AsyncClient, seed_categories, seed_transactions):
        """Get budget status for current month"""
        # Create budget for a category with transactions
        await client.post("/api/v1/budgets", json={
            "category": "Groceries",
            "amount": 500.00,
            "period": "monthly"
        })

        # Get budget status
        response = await client.get("/api/v1/budgets/status/current")
        assert response.status_code == 200
        data = response.json()

        assert "year" in data
        assert "month" in data
        assert "budgets" in data
        assert "overall_status" in data

        # Find groceries budget in status
        groceries_budget = next(
            (b for b in data["budgets"] if b["category"] == "Groceries"),
            None
        )
        assert groceries_budget is not None
        assert "budget_amount" in groceries_budget
        assert "spent_amount" in groceries_budget
        assert "remaining" in groceries_budget
        assert "percentage_used" in groceries_budget
        assert "status" in groceries_budget
        assert groceries_budget["status"] in ["on_track", "warning", "exceeded"]

    @pytest.mark.asyncio
    async def test_budget_status_calculation(self, client: AsyncClient, seed_categories):
        """Test budget status calculation logic"""
        # Create transactions with known amounts
        from datetime import date as date_obj
        today = date_obj.today()

        # Create budget
        await client.post("/api/v1/budgets", json={
            "category": "Transportation",
            "amount": 100.00,
            "period": "monthly"
        })

        # Create transaction spending $90 (90% of budget - should be "warning")
        await client.post("/api/v1/transactions", json={
            "date": today.isoformat(),
            "amount": -90.00,
            "description": "Gas",
            "merchant": "Shell",
            "account_source": "TEST",
            "category": "Transportation",
            "reference_id": "test_90"
        })

        # Get status
        response = await client.get("/api/v1/budgets/status/current")
        data = response.json()

        trans_budget = next(
            (b for b in data["budgets"] if b["category"] == "Transportation"),
            None
        )
        assert trans_budget is not None
        assert trans_budget["spent_amount"] == 90.00
        assert trans_budget["remaining"] == 10.00
        assert trans_budget["percentage_used"] >= 80  # Should be warning threshold
        assert trans_budget["status"] == "warning"

    @pytest.mark.asyncio
    async def test_budget_alerts(self, client: AsyncClient, seed_categories):
        """Test budget alerts for warning/exceeded budgets"""
        from datetime import date as date_obj
        today = date_obj.today()

        # Create budget
        await client.post("/api/v1/budgets", json={
            "category": "Entertainment",
            "amount": 100.00,
            "period": "monthly"
        })

        # Create transaction exceeding budget
        await client.post("/api/v1/transactions", json={
            "date": today.isoformat(),
            "amount": -120.00,
            "description": "Concert tickets",
            "merchant": "Ticketmaster",
            "account_source": "TEST",
            "category": "Entertainment",
            "reference_id": "test_exceed"
        })

        # Get alerts
        response = await client.get("/api/v1/budgets/alerts/active")
        assert response.status_code == 200
        data = response.json()

        assert data["alert_count"] >= 1
        assert len(data["alerts"]) >= 1

        # Should have an alert for Entertainment
        entertainment_alert = next(
            (a for a in data["alerts"] if a["category"] == "Entertainment"),
            None
        )
        assert entertainment_alert is not None
        assert entertainment_alert["status"] == "exceeded"
        assert entertainment_alert["spent_amount"] == 120.00

    @pytest.mark.asyncio
    async def test_budget_with_date_range(self, client: AsyncClient, seed_categories):
        """Test budget with specific start/end dates"""
        budget_data = {
            "category": "Shopping",
            "amount": 1000.00,
            "period": "monthly",
            "start_date": "2025-11-01",
            "end_date": "2025-11-30",
            "rollover_enabled": False
        }

        response = await client.post("/api/v1/budgets", json=budget_data)
        assert response.status_code == 201
        data = response.json()

        assert data["start_date"] == "2025-11-01"
        assert data["end_date"] == "2025-11-30"

    @pytest.mark.asyncio
    async def test_budget_status_specific_month(self, client: AsyncClient, seed_categories, seed_transactions):
        """Get budget status for a specific month"""
        # Create budget
        await client.post("/api/v1/budgets", json={
            "category": "Groceries",
            "amount": 500.00,
            "period": "monthly"
        })

        # Get status for November 2025
        response = await client.get("/api/v1/budgets/status/current?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        assert data["year"] == 2025
        assert data["month"] == 11

    @pytest.mark.asyncio
    async def test_zero_budget(self, client: AsyncClient, seed_categories):
        """Test edge case: budget with zero amount"""
        budget_data = {
            "category": "Subscriptions",
            "amount": 0.00,
            "period": "monthly"
        }

        response = await client.post("/api/v1/budgets", json=budget_data)
        assert response.status_code == 201

        # Get status should handle zero budget gracefully
        response = await client.get("/api/v1/budgets/status/current")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_negative_budget(self, client: AsyncClient, seed_categories):
        """Test validation: negative budget amount should be allowed for edge cases"""
        budget_data = {
            "category": "Savings",
            "amount": -100.00,  # Negative for tracking income goals
            "period": "monthly"
        }

        # Should be allowed
        response = await client.post("/api/v1/budgets", json=budget_data)
        assert response.status_code == 201
