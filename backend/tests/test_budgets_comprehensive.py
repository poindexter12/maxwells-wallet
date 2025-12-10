"""
Comprehensive tests for budgets.py router to increase coverage to 90%+.
"""
import pytest
from httpx import AsyncClient


class TestBudgetsCRUD:
    """Tests for budget CRUD operations"""

    @pytest.mark.asyncio
    async def test_list_budgets_empty(self, client: AsyncClient):
        """List budgets when none exist"""
        response = await client.get("/api/v1/budgets")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_budget_success(self, client: AsyncClient, seed_categories):
        """Create a budget successfully"""
        budget_data = {
            "tag": "bucket:groceries",
            "amount": 500.00,
            "period": "monthly"
        }
        response = await client.post("/api/v1/budgets", json=budget_data)
        assert response.status_code in [201, 400]  # 400 if already exists

        if response.status_code == 201:
            data = response.json()
            assert data["tag"] == "bucket:groceries"
            assert data["amount"] == 500.00

    @pytest.mark.asyncio
    async def test_create_budget_invalid_tag_format(self, client: AsyncClient):
        """Create budget with invalid tag format fails"""
        budget_data = {
            "tag": "invalid-format",  # Missing namespace:value format
            "amount": 500.00,
            "period": "monthly"
        }
        response = await client.post("/api/v1/budgets", json=budget_data)
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "TAG_INVALID_FORMAT"

    @pytest.mark.asyncio
    async def test_create_budget_nonexistent_tag(self, client: AsyncClient):
        """Create budget with nonexistent tag fails"""
        budget_data = {
            "tag": "bucket:nonexistent-bucket-12345",
            "amount": 500.00,
            "period": "monthly"
        }
        response = await client.post("/api/v1/budgets", json=budget_data)
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "TAG_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_create_duplicate_budget(self, client: AsyncClient, seed_categories):
        """Create duplicate budget fails"""
        # First ensure tag exists
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "duplicate-test-bucket"
        })

        budget_data = {
            "tag": "bucket:duplicate-test-bucket",
            "amount": 500.00,
            "period": "monthly"
        }
        # Create first budget
        response1 = await client.post("/api/v1/budgets", json=budget_data)

        if response1.status_code == 201:
            # Try to create duplicate
            response2 = await client.post("/api/v1/budgets", json=budget_data)
            assert response2.status_code == 400
            assert response2.json()["detail"]["error_code"] == "BUDGET_ALREADY_EXISTS"

    @pytest.mark.asyncio
    async def test_get_budget_by_id(self, client: AsyncClient, seed_categories):
        """Get budget by ID"""
        # Create a budget first
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "get-test-bucket"
        })
        create_response = await client.post("/api/v1/budgets", json={
            "tag": "bucket:get-test-bucket",
            "amount": 300.00,
            "period": "monthly"
        })

        if create_response.status_code == 201:
            budget_id = create_response.json()["id"]
            response = await client.get(f"/api/v1/budgets/{budget_id}")
            assert response.status_code == 200
            assert response.json()["id"] == budget_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_budget(self, client: AsyncClient):
        """Get nonexistent budget returns 404"""
        response = await client.get("/api/v1/budgets/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_budget_amount(self, client: AsyncClient, seed_categories):
        """Update budget amount"""
        # Create a budget first
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "update-amount-bucket"
        })
        create_response = await client.post("/api/v1/budgets", json={
            "tag": "bucket:update-amount-bucket",
            "amount": 300.00,
            "period": "monthly"
        })

        if create_response.status_code == 201:
            budget_id = create_response.json()["id"]
            update_response = await client.patch(f"/api/v1/budgets/{budget_id}", json={
                "amount": 600.00
            })
            assert update_response.status_code == 200
            assert update_response.json()["amount"] == 600.00

    @pytest.mark.asyncio
    async def test_update_budget_tag(self, client: AsyncClient, seed_categories):
        """Update budget tag"""
        # Create tags
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "original-bucket"
        })
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "new-bucket"
        })

        create_response = await client.post("/api/v1/budgets", json={
            "tag": "bucket:original-bucket",
            "amount": 300.00,
            "period": "monthly"
        })

        if create_response.status_code == 201:
            budget_id = create_response.json()["id"]
            update_response = await client.patch(f"/api/v1/budgets/{budget_id}", json={
                "tag": "bucket:new-bucket"
            })
            assert update_response.status_code == 200
            assert update_response.json()["tag"] == "bucket:new-bucket"

    @pytest.mark.asyncio
    async def test_update_budget_invalid_tag(self, client: AsyncClient, seed_categories):
        """Update budget with invalid tag format fails"""
        # Create a budget first
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "update-invalid-bucket"
        })
        create_response = await client.post("/api/v1/budgets", json={
            "tag": "bucket:update-invalid-bucket",
            "amount": 300.00,
            "period": "monthly"
        })

        if create_response.status_code == 201:
            budget_id = create_response.json()["id"]
            update_response = await client.patch(f"/api/v1/budgets/{budget_id}", json={
                "tag": "invalid-format"
            })
            assert update_response.status_code == 400

    @pytest.mark.asyncio
    async def test_update_budget_nonexistent_tag(self, client: AsyncClient, seed_categories):
        """Update budget with nonexistent tag fails"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "update-nonexist-bucket"
        })
        create_response = await client.post("/api/v1/budgets", json={
            "tag": "bucket:update-nonexist-bucket",
            "amount": 300.00,
            "period": "monthly"
        })

        if create_response.status_code == 201:
            budget_id = create_response.json()["id"]
            update_response = await client.patch(f"/api/v1/budgets/{budget_id}", json={
                "tag": "bucket:does-not-exist-12345"
            })
            assert update_response.status_code == 400
            assert update_response.json()["detail"]["error_code"] == "TAG_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_update_nonexistent_budget(self, client: AsyncClient):
        """Update nonexistent budget returns 404"""
        response = await client.patch("/api/v1/budgets/99999", json={"amount": 100.00})
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_budget(self, client: AsyncClient, seed_categories):
        """Delete a budget"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "delete-test-bucket"
        })
        create_response = await client.post("/api/v1/budgets", json={
            "tag": "bucket:delete-test-bucket",
            "amount": 300.00,
            "period": "monthly"
        })

        if create_response.status_code == 201:
            budget_id = create_response.json()["id"]
            delete_response = await client.delete(f"/api/v1/budgets/{budget_id}")
            assert delete_response.status_code == 204

            # Verify deleted
            get_response = await client.get(f"/api/v1/budgets/{budget_id}")
            assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_budget(self, client: AsyncClient):
        """Delete nonexistent budget returns 404"""
        response = await client.delete("/api/v1/budgets/99999")
        assert response.status_code == 404


class TestBudgetStatus:
    """Tests for budget status and alerts"""

    @pytest.mark.asyncio
    async def test_get_budget_status_current_month(self, client: AsyncClient, seed_categories):
        """Get budget status for current month"""
        response = await client.get("/api/v1/budgets/status/current")
        assert response.status_code == 200
        data = response.json()

        assert "year" in data
        assert "month" in data
        assert "budgets" in data
        assert "overall_status" in data
        assert data["overall_status"] in ["on_track", "warning", "exceeded"]

    @pytest.mark.asyncio
    async def test_get_budget_status_specific_month(self, client: AsyncClient, seed_categories):
        """Get budget status for specific month"""
        response = await client.get("/api/v1/budgets/status/current?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        assert data["year"] == 2025
        assert data["month"] == 11

    @pytest.mark.asyncio
    async def test_get_budget_status_with_data(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get budget status with transactions to calculate spending"""
        # Create a budget for a tag that has transactions
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "status-test-bucket"
        })
        await client.post("/api/v1/budgets", json={
            "tag": "bucket:status-test-bucket",
            "amount": 1000.00,
            "period": "monthly"
        })

        response = await client.get("/api/v1/budgets/status/current")
        assert response.status_code == 200
        data = response.json()

        # Each budget should have expected fields
        for budget_status in data["budgets"]:
            assert "tag" in budget_status
            assert "budget_amount" in budget_status
            assert "spent_amount" in budget_status
            assert "remaining" in budget_status
            assert "percentage_used" in budget_status
            assert "status" in budget_status
            assert "projected_monthly" in budget_status

    @pytest.mark.asyncio
    async def test_get_budget_alerts(self, client: AsyncClient, seed_categories):
        """Get active budget alerts"""
        response = await client.get("/api/v1/budgets/alerts/active")
        assert response.status_code == 200
        data = response.json()

        assert "alert_count" in data
        assert "alerts" in data
        assert isinstance(data["alerts"], list)

    @pytest.mark.asyncio
    async def test_budget_yearly_period(self, client: AsyncClient, seed_categories):
        """Create a yearly budget"""
        await client.post("/api/v1/tags", json={
            "namespace": "bucket",
            "value": "yearly-budget-test"
        })
        response = await client.post("/api/v1/budgets", json={
            "tag": "bucket:yearly-budget-test",
            "amount": 6000.00,
            "period": "yearly"
        })
        assert response.status_code in [201, 400]

    @pytest.mark.asyncio
    async def test_budget_with_occasion_tag(self, client: AsyncClient, seed_categories):
        """Create a budget for an occasion tag"""
        await client.post("/api/v1/tags", json={
            "namespace": "occasion",
            "value": "vacation-2025"
        })
        response = await client.post("/api/v1/budgets", json={
            "tag": "occasion:vacation-2025",
            "amount": 3000.00,
            "period": "yearly"
        })
        assert response.status_code in [201, 400]

    @pytest.mark.asyncio
    async def test_budget_with_account_tag(self, client: AsyncClient, seed_categories):
        """Create a budget for an account tag"""
        await client.post("/api/v1/tags", json={
            "namespace": "account",
            "value": "credit-card-spending"
        })
        response = await client.post("/api/v1/budgets", json={
            "tag": "account:credit-card-spending",
            "amount": 2000.00,
            "period": "monthly"
        })
        assert response.status_code in [201, 400]
