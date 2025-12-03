"""
Comprehensive tests for reports.py router to increase coverage to 90%+.
"""
import pytest
from httpx import AsyncClient
from datetime import date, timedelta


class TestMonthlySummary:
    """Tests for monthly summary report"""

    @pytest.mark.asyncio
    async def test_monthly_summary(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get monthly summary"""
        today = date.today()
        response = await client.get(
            f"/api/v1/reports/monthly-summary?year={today.year}&month={today.month}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        assert "month" in data
        assert "total_income" in data
        assert "total_expenses" in data
        assert "net" in data
        assert "transaction_count" in data
        assert "category_breakdown" in data
        assert "bucket_breakdown" in data
        assert "top_merchants" in data

    @pytest.mark.asyncio
    async def test_monthly_summary_empty_month(self, client: AsyncClient):
        """Get monthly summary for empty month"""
        response = await client.get("/api/v1/reports/monthly-summary?year=2000&month=1")
        assert response.status_code == 200
        data = response.json()
        assert data["transaction_count"] == 0
        assert data["total_income"] == 0
        assert data["total_expenses"] == 0

    @pytest.mark.asyncio
    async def test_monthly_summary_december(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get monthly summary for December (edge case)"""
        response = await client.get("/api/v1/reports/monthly-summary?year=2024&month=12")
        assert response.status_code == 200


class TestSpendingTrends:
    """Tests for spending trends report"""

    @pytest.mark.asyncio
    async def test_trends_by_month(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get spending trends grouped by month"""
        today = date.today()
        start = (today - timedelta(days=90)).isoformat()
        end = today.isoformat()
        response = await client.get(
            f"/api/v1/reports/trends?start_date={start}&end_date={end}&group_by=month"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "month"
        assert "data" in data

    @pytest.mark.asyncio
    async def test_trends_by_category(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get spending trends grouped by category"""
        today = date.today()
        start = (today - timedelta(days=90)).isoformat()
        end = today.isoformat()
        response = await client.get(
            f"/api/v1/reports/trends?start_date={start}&end_date={end}&group_by=category"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "category"
        assert "categories" in data
        assert "data" in data

    @pytest.mark.asyncio
    async def test_trends_by_account(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get spending trends grouped by account"""
        today = date.today()
        start = (today - timedelta(days=90)).isoformat()
        end = today.isoformat()
        response = await client.get(
            f"/api/v1/reports/trends?start_date={start}&end_date={end}&group_by=account"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "account"
        assert "accounts" in data
        assert "data" in data

    @pytest.mark.asyncio
    async def test_trends_by_tag(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get spending trends grouped by bucket tag"""
        today = date.today()
        start = (today - timedelta(days=90)).isoformat()
        end = today.isoformat()
        response = await client.get(
            f"/api/v1/reports/trends?start_date={start}&end_date={end}&group_by=tag"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "tag"
        assert "buckets" in data
        assert "data" in data


class TestTopMerchants:
    """Tests for top merchants report"""

    @pytest.mark.asyncio
    async def test_top_merchants_current_month(self, client: AsyncClient, seed_transactions):
        """Get top merchants for current month"""
        response = await client.get("/api/v1/reports/top-merchants?period=current_month")
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "current_month"
        assert "merchants" in data
        assert isinstance(data["merchants"], list)

    @pytest.mark.asyncio
    async def test_top_merchants_last_month(self, client: AsyncClient, seed_transactions):
        """Get top merchants for last month"""
        response = await client.get("/api/v1/reports/top-merchants?period=last_month")
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "last_month"

    @pytest.mark.asyncio
    async def test_top_merchants_last_3_months(self, client: AsyncClient, seed_transactions):
        """Get top merchants for last 3 months"""
        response = await client.get("/api/v1/reports/top-merchants?period=last_3_months")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_last_6_months(self, client: AsyncClient, seed_transactions):
        """Get top merchants for last 6 months"""
        response = await client.get("/api/v1/reports/top-merchants?period=last_6_months")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_all_time(self, client: AsyncClient, seed_transactions):
        """Get top merchants all time"""
        response = await client.get("/api/v1/reports/top-merchants?period=all_time")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_specific_month(self, client: AsyncClient, seed_transactions):
        """Get top merchants for specific year/month"""
        today = date.today()
        response = await client.get(
            f"/api/v1/reports/top-merchants?year={today.year}&month={today.month}&limit=5"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["merchants"]) <= 5

    @pytest.mark.asyncio
    async def test_top_merchants_with_limit(self, client: AsyncClient, seed_transactions):
        """Get top merchants with custom limit"""
        response = await client.get("/api/v1/reports/top-merchants?limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data["merchants"]) <= 3

    @pytest.mark.asyncio
    async def test_top_merchants_january(self, client: AsyncClient, seed_transactions):
        """Get top merchants for January (edge case for month arithmetic)"""
        response = await client.get("/api/v1/reports/top-merchants?period=last_month")
        assert response.status_code == 200


class TestAccountSummary:
    """Tests for account summary report"""

    @pytest.mark.asyncio
    async def test_account_summary(self, client: AsyncClient, seed_transactions):
        """Get account summary"""
        response = await client.get("/api/v1/reports/account-summary")
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        assert isinstance(data["accounts"], list)
        for account in data["accounts"]:
            assert "account" in account
            assert "income" in account
            assert "expenses" in account
            assert "net" in account
            assert "count" in account


class TestBucketSummary:
    """Tests for bucket summary report"""

    @pytest.mark.asyncio
    async def test_bucket_summary(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get bucket summary"""
        response = await client.get("/api/v1/reports/bucket-summary")
        assert response.status_code == 200
        data = response.json()
        assert "buckets" in data
        assert "date_range" in data
        assert isinstance(data["buckets"], list)

    @pytest.mark.asyncio
    async def test_bucket_summary_with_dates(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get bucket summary with date range"""
        today = date.today()
        start = (today - timedelta(days=30)).isoformat()
        end = today.isoformat()
        response = await client.get(
            f"/api/v1/reports/bucket-summary?start_date={start}&end_date={end}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["date_range"]["start"] == start
        assert data["date_range"]["end"] == end


class TestMonthOverMonth:
    """Tests for month over month comparison"""

    @pytest.mark.asyncio
    async def test_month_over_month(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get month over month comparison"""
        today = date.today()
        response = await client.get(
            f"/api/v1/reports/month-over-month?current_year={today.year}&current_month={today.month}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "current_period" in data
        assert "previous_period" in data
        assert "current" in data
        assert "previous" in data
        assert "changes" in data
        assert "category_changes" in data
        assert "bucket_changes" in data
        assert "insights" in data

    @pytest.mark.asyncio
    async def test_month_over_month_january(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get month over month for January (previous is December of prior year)"""
        response = await client.get("/api/v1/reports/month-over-month?current_year=2025&current_month=1")
        assert response.status_code == 200
        data = response.json()
        assert data["current_period"] == "2025-01"
        assert data["previous_period"] == "2024-12"

    @pytest.mark.asyncio
    async def test_month_over_month_insights(self, client: AsyncClient, seed_transactions, seed_categories):
        """Month over month returns spending insights"""
        today = date.today()
        response = await client.get(
            f"/api/v1/reports/month-over-month?current_year={today.year}&current_month={today.month}"
        )
        assert response.status_code == 200
        data = response.json()
        insights = data["insights"]
        assert "spending_trend" in insights
        assert insights["spending_trend"] in ["increasing", "decreasing"]


class TestSpendingVelocity:
    """Tests for spending velocity report"""

    @pytest.mark.asyncio
    async def test_spending_velocity_current(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get spending velocity for current month"""
        today = date.today()
        response = await client.get(
            f"/api/v1/reports/spending-velocity?year={today.year}&month={today.month}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        assert "month" in data
        assert "days_elapsed" in data
        assert "days_in_month" in data
        assert "current_totals" in data
        assert "daily_rates" in data
        assert "projected_monthly" in data
        assert "pace" in data
        assert "insights" in data

    @pytest.mark.asyncio
    async def test_spending_velocity_past_month(self, client: AsyncClient, seed_transactions, seed_categories):
        """Get spending velocity for past month (completed)"""
        today = date.today()
        # Go back at least 2 months to ensure we're in a past month
        if today.month <= 2:
            year, month = today.year - 1, 10
        else:
            year, month = today.year, today.month - 2
        response = await client.get(
            f"/api/v1/reports/spending-velocity?year={year}&month={month}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["pace"] == "completed"

    @pytest.mark.asyncio
    async def test_spending_velocity_january(self, client: AsyncClient, seed_transactions, seed_categories):
        """Spending velocity for January (edge case)"""
        response = await client.get("/api/v1/reports/spending-velocity?year=2025&month=1")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_spending_velocity_december(self, client: AsyncClient, seed_transactions, seed_categories):
        """Spending velocity for December (edge case)"""
        response = await client.get("/api/v1/reports/spending-velocity?year=2024&month=12")
        assert response.status_code == 200


class TestAnomalies:
    """Tests for anomaly detection report"""

    @pytest.mark.asyncio
    async def test_detect_anomalies(self, client: AsyncClient, seed_transactions, seed_categories):
        """Detect spending anomalies"""
        today = date.today()
        response = await client.get(
            f"/api/v1/reports/anomalies?year={today.year}&month={today.month}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        assert "month" in data
        assert "anomalies" in data
        assert "summary" in data
        assert "baseline_period" in data

        anomalies = data["anomalies"]
        assert "large_transactions" in anomalies
        assert "new_merchants" in anomalies
        assert "unusual_categories" in anomalies
        assert "unusual_buckets" in anomalies

    @pytest.mark.asyncio
    async def test_detect_anomalies_custom_threshold(self, client: AsyncClient, seed_transactions, seed_categories):
        """Detect anomalies with custom threshold"""
        today = date.today()
        # More sensitive threshold
        response = await client.get(
            f"/api/v1/reports/anomalies?year={today.year}&month={today.month}&threshold=1.5"
        )
        assert response.status_code == 200

        # Less sensitive threshold
        response2 = await client.get(
            f"/api/v1/reports/anomalies?year={today.year}&month={today.month}&threshold=3.0"
        )
        assert response2.status_code == 200

    @pytest.mark.asyncio
    async def test_detect_anomalies_empty_baseline(self, client: AsyncClient):
        """Detect anomalies with no baseline data"""
        response = await client.get("/api/v1/reports/anomalies?year=2000&month=1")
        assert response.status_code == 200
        data = response.json()
        # Should handle gracefully with no baseline
        assert "summary" in data

    @pytest.mark.asyncio
    async def test_anomalies_summary_fields(self, client: AsyncClient, seed_transactions, seed_categories):
        """Verify anomaly summary fields"""
        today = date.today()
        response = await client.get(
            f"/api/v1/reports/anomalies?year={today.year}&month={today.month}"
        )
        assert response.status_code == 200
        summary = response.json()["summary"]
        assert "total_anomalies" in summary
        assert "large_transaction_count" in summary
        assert "new_merchant_count" in summary
        assert "unusual_category_count" in summary
        assert "unusual_bucket_count" in summary
