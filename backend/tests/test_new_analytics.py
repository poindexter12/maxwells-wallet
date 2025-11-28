"""
Tests for New Analytics Features:
- Month-over-Month Comparison
- Spending Velocity
- Anomaly Detection
"""
import pytest
from httpx import AsyncClient


class TestNewAnalytics:
    """Tests for new analytics endpoints to help find savings opportunities"""

    @pytest.mark.asyncio
    async def test_month_over_month_comparison(self, client: AsyncClient, seed_transactions):
        """Test month-over-month comparison endpoint"""
        response = await client.get("/api/v1/reports/month-over-month?current_year=2025&current_month=11")
        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "current_period" in data
        assert "previous_period" in data
        assert "current" in data
        assert "previous" in data
        assert "changes" in data
        assert "category_changes" in data
        assert "insights" in data

        # Verify changes calculation
        assert "income" in data["changes"]
        assert "expenses" in data["changes"]
        assert "net" in data["changes"]

        # Each change should have amount and percent
        for key in ["income", "expenses", "net"]:
            assert "amount" in data["changes"][key]
            assert "percent" in data["changes"][key]

        # Verify insights
        assert data["insights"]["spending_trend"] in ["increasing", "decreasing"]
        assert "biggest_category_increase" in data["insights"]
        assert "biggest_category_decrease" in data["insights"]
        assert "biggest_bucket_increase" in data["insights"]
        assert "biggest_bucket_decrease" in data["insights"]

    @pytest.mark.asyncio
    async def test_spending_velocity(self, client: AsyncClient, seed_transactions):
        """Test spending velocity / daily burn rate endpoint"""
        response = await client.get("/api/v1/reports/spending-velocity?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "year" in data
        assert "month" in data
        assert "days_elapsed" in data
        assert "days_in_month" in data
        assert "current_totals" in data
        assert "daily_rates" in data
        assert "projected_monthly" in data
        assert "previous_month" in data
        assert "pace" in data
        assert "insights" in data

        # Verify current totals
        assert "income" in data["current_totals"]
        assert "expenses" in data["current_totals"]
        assert "net" in data["current_totals"]

        # Verify daily rates
        assert "expenses" in data["daily_rates"]
        assert "income" in data["daily_rates"]
        assert "net" in data["daily_rates"]

        # Verify projections
        assert "expenses" in data["projected_monthly"]
        assert "income" in data["projected_monthly"]
        assert "net" in data["projected_monthly"]

        # Verify pace
        assert data["pace"] in ["over_budget", "under_budget", "on_track", "no_baseline", "completed"]

        # Verify insights
        assert "daily_burn_rate" in data["insights"]
        assert "days_remaining" in data["insights"]
        assert "projected_remaining_spending" in data["insights"]

    @pytest.mark.asyncio
    async def test_spending_velocity_past_month(self, client: AsyncClient, seed_transactions):
        """Test spending velocity for completed past month"""
        response = await client.get("/api/v1/reports/spending-velocity?year=2025&month=10")
        assert response.status_code == 200
        data = response.json()

        # For past months, should use all days
        assert data["days_elapsed"] == data["days_in_month"]
        assert data["pace"] == "completed"

    @pytest.mark.asyncio
    async def test_anomaly_detection(self, client: AsyncClient, seed_transactions):
        """Test anomaly detection endpoint"""
        response = await client.get("/api/v1/reports/anomalies?year=2025&month=11&threshold=2.0")
        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "year" in data
        assert "month" in data
        assert "anomalies" in data
        assert "summary" in data
        assert "baseline_period" in data

        # Verify anomaly categories
        assert "large_transactions" in data["anomalies"]
        assert "new_merchants" in data["anomalies"]
        assert "unusual_categories" in data["anomalies"]

        # Verify summary
        assert "total_anomalies" in data["summary"]
        assert "large_transaction_count" in data["summary"]
        assert "new_merchant_count" in data["summary"]
        assert "unusual_category_count" in data["summary"]

        # Verify baseline
        assert "start" in data["baseline_period"]
        assert "end" in data["baseline_period"]
        assert "transaction_count" in data["baseline_period"]

    @pytest.mark.asyncio
    async def test_anomaly_detection_with_custom_threshold(self, client: AsyncClient, seed_transactions):
        """Test anomaly detection with different threshold"""
        # Higher threshold = fewer anomalies
        response1 = await client.get("/api/v1/reports/anomalies?year=2025&month=11&threshold=3.0")
        assert response1.status_code == 200

        # Lower threshold = more anomalies
        response2 = await client.get("/api/v1/reports/anomalies?year=2025&month=11&threshold=1.5")
        assert response2.status_code == 200

        # Both should return valid responses
        data1 = response1.json()
        data2 = response2.json()
        assert isinstance(data1["summary"]["total_anomalies"], int)
        assert isinstance(data2["summary"]["total_anomalies"], int)

    @pytest.mark.asyncio
    async def test_month_over_month_category_changes(self, client: AsyncClient, seed_transactions):
        """Test that category-level changes are calculated correctly"""
        response = await client.get("/api/v1/reports/month-over-month?current_year=2025&current_month=11")
        assert response.status_code == 200
        data = response.json()

        # Verify category changes exist
        assert len(data["category_changes"]) > 0

        # Check structure of each category change
        for category, change in data["category_changes"].items():
            assert "current" in change
            assert "previous" in change
            assert "change" in change
            assert "amount" in change["change"]
            assert "percent" in change["change"]

    @pytest.mark.asyncio
    async def test_spending_velocity_projection_accuracy(self, client: AsyncClient, seed_transactions):
        """Test that spending projections are reasonable"""
        response = await client.get("/api/v1/reports/spending-velocity?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Daily rate * days should equal projection
        expected_projection = data["daily_rates"]["expenses"] * data["days_in_month"]
        actual_projection = data["projected_monthly"]["expenses"]

        # Allow small rounding difference
        assert abs(expected_projection - actual_projection) < 1.0

    @pytest.mark.asyncio
    async def test_anomaly_large_transaction_structure(self, client: AsyncClient, seed_transactions):
        """Test structure of large transaction anomalies"""
        response = await client.get("/api/v1/reports/anomalies?year=2025&month=11&threshold=2.0")
        assert response.status_code == 200
        data = response.json()

        # If there are large transactions, verify their structure
        if len(data["anomalies"]["large_transactions"]) > 0:
            txn = data["anomalies"]["large_transactions"][0]
            assert "id" in txn
            assert "date" in txn
            assert "merchant" in txn
            assert "amount" in txn
            assert "category" in txn
            assert "z_score" in txn
            assert "reason" in txn

    @pytest.mark.asyncio
    async def test_anomaly_new_merchant_structure(self, client: AsyncClient, seed_transactions):
        """Test structure of new merchant anomalies"""
        response = await client.get("/api/v1/reports/anomalies?year=2025&month=11&threshold=2.0")
        assert response.status_code == 200
        data = response.json()

        # If there are new merchants, verify their structure
        if len(data["anomalies"]["new_merchants"]) > 0:
            merchant = data["anomalies"]["new_merchants"][0]
            assert "id" in merchant
            assert "date" in merchant
            assert "merchant" in merchant
            assert "amount" in merchant
            assert "category" in merchant
            assert "reason" in merchant

    @pytest.mark.asyncio
    async def test_anomaly_unusual_category_structure(self, client: AsyncClient, seed_transactions):
        """Test structure of unusual category anomalies"""
        response = await client.get("/api/v1/reports/anomalies?year=2025&month=11&threshold=2.0")
        assert response.status_code == 200
        data = response.json()

        # If there are unusual categories, verify their structure
        if len(data["anomalies"]["unusual_categories"]) > 0:
            category = data["anomalies"]["unusual_categories"][0]
            assert "category" in category
            assert "current_spending" in category
            assert "average_spending" in category
            assert "z_score" in category
            assert "percent_increase" in category
            assert "reason" in category
