"""
Tests for FR-005: Reports & Analytics
"""

import pytest
from httpx import AsyncClient


class TestReportsAndAnalytics:
    """FR-005: Reports & Analytics"""

    @pytest.mark.asyncio
    async def test_monthly_summary(self, client: AsyncClient, seed_transactions):
        """FR-005.1: Monthly Summary"""
        response = await client.get("/api/v1/reports/monthly-summary?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Verify required metrics
        assert "total_income" in data
        assert "total_expenses" in data
        assert "net" in data
        assert "transaction_count" in data

        # Verify calculations
        assert data["total_income"] == 3500.00
        assert data["total_expenses"] > 0
        assert data["net"] == data["total_income"] - data["total_expenses"]
        assert data["transaction_count"] == 4

    @pytest.mark.asyncio
    async def test_category_breakdown(self, client: AsyncClient, seed_transactions):
        """FR-005.2: Category Breakdown"""
        response = await client.get("/api/v1/reports/monthly-summary?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        assert "category_breakdown" in data
        category_breakdown = data["category_breakdown"]

        # Verify category data structure
        for category, info in category_breakdown.items():
            assert "amount" in info
            assert "count" in info
            assert info["amount"] >= 0
            assert info["count"] > 0

        # Should exclude income from breakdown (only expenses)
        assert all(info["amount"] >= 0 for info in category_breakdown.values())

    @pytest.mark.asyncio
    async def test_spending_trends_monthly(self, client: AsyncClient, seed_transactions):
        """FR-005.3: Spending Trends - Monthly grouping"""
        response = await client.get("/api/v1/reports/trends?start_date=2025-10-01&end_date=2025-11-30&group_by=month")
        assert response.status_code == 200
        data = response.json()

        assert data["group_by"] == "month"
        assert "data" in data
        assert len(data["data"]) == 2  # October and November

        # Verify data structure
        for period_data in data["data"]:
            assert "period" in period_data
            assert "income" in period_data
            assert "expenses" in period_data
            assert "net" in period_data

    @pytest.mark.asyncio
    async def test_spending_trends_by_category(self, client: AsyncClient, seed_transactions):
        """FR-005.3: Spending Trends - Category grouping"""
        response = await client.get(
            "/api/v1/reports/trends?start_date=2025-10-01&end_date=2025-11-30&group_by=category"
        )
        assert response.status_code == 200
        data = response.json()

        assert data["group_by"] == "category"
        assert "categories" in data
        assert "data" in data

    @pytest.mark.asyncio
    async def test_top_merchants(self, client: AsyncClient, seed_transactions):
        """FR-005.4: Top Merchants"""
        response = await client.get("/api/v1/reports/top-merchants?limit=10&period=current_month")
        assert response.status_code == 200
        data = response.json()

        assert "merchants" in data
        assert "period" in data

        # Verify merchant data structure
        for merchant in data["merchants"]:
            assert "merchant" in merchant
            assert "amount" in merchant
            assert "transaction_count" in merchant
            assert merchant["amount"] > 0

        # Verify sorted by amount (largest first)
        amounts = [m["amount"] for m in data["merchants"]]
        assert amounts == sorted(amounts, reverse=True)

    @pytest.mark.asyncio
    async def test_account_summary(self, client: AsyncClient, seed_transactions):
        """FR-005.5: Account Summary"""
        response = await client.get("/api/v1/reports/account-summary")
        assert response.status_code == 200
        data = response.json()

        assert "accounts" in data

        # Verify account data structure
        for account in data["accounts"]:
            assert "account" in account
            assert "income" in account
            assert "expenses" in account
            assert "net" in account
            assert "count" in account

            # Verify net calculation
            assert account["net"] == account["income"] - account["expenses"]

    @pytest.mark.asyncio
    async def test_top_merchants_different_periods(self, client: AsyncClient, seed_transactions):
        """FR-005.4: Top Merchants - Different period selections"""
        periods = ["current_month", "last_month", "last_3_months", "last_6_months", "all_time"]

        for period in periods:
            response = await client.get(f"/api/v1/reports/top-merchants?limit=5&period={period}")
            assert response.status_code == 200
            data = response.json()
            assert data["period"] == period
            assert "merchants" in data

    @pytest.mark.asyncio
    async def test_bucket_breakdown_in_monthly_summary(self, client: AsyncClient, seed_transactions):
        """Monthly summary includes bucket tag breakdown"""
        response = await client.get("/api/v1/reports/monthly-summary?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        assert "bucket_breakdown" in data
        bucket_breakdown = data["bucket_breakdown"]

        # Verify bucket data structure
        for bucket, info in bucket_breakdown.items():
            assert "amount" in info
            assert "count" in info
            assert info["amount"] >= 0
            assert info["count"] > 0

    @pytest.mark.asyncio
    async def test_spending_trends_by_tag(self, client: AsyncClient, seed_transactions):
        """Spending trends grouped by bucket tag"""
        response = await client.get("/api/v1/reports/trends?start_date=2025-10-01&end_date=2025-11-30&group_by=tag")
        assert response.status_code == 200
        data = response.json()

        assert data["group_by"] == "tag"
        assert "buckets" in data
        assert "data" in data

    @pytest.mark.asyncio
    async def test_bucket_summary(self, client: AsyncClient, seed_transactions):
        """Bucket summary endpoint"""
        response = await client.get("/api/v1/reports/bucket-summary")
        assert response.status_code == 200
        data = response.json()

        assert "buckets" in data
        assert "date_range" in data

        # Verify bucket data structure
        for bucket_data in data["buckets"]:
            assert "bucket" in bucket_data
            assert "income" in bucket_data
            assert "expenses" in bucket_data
            assert "net" in bucket_data
            assert "count" in bucket_data

    @pytest.mark.asyncio
    async def test_bucket_summary_with_date_range(self, client: AsyncClient, seed_transactions):
        """Bucket summary with date filtering"""
        response = await client.get("/api/v1/reports/bucket-summary?start_date=2025-11-01&end_date=2025-11-30")
        assert response.status_code == 200
        data = response.json()

        assert "buckets" in data
        assert data["date_range"]["start"] == "2025-11-01"
        assert data["date_range"]["end"] == "2025-11-30"

    @pytest.mark.asyncio
    async def test_month_over_month_bucket_changes(self, client: AsyncClient, seed_transactions):
        """Month-over-month includes bucket changes"""
        response = await client.get("/api/v1/reports/month-over-month?current_year=2025&current_month=11")
        assert response.status_code == 200
        data = response.json()

        assert "bucket_changes" in data
        assert "current" in data
        assert "buckets" in data["current"]
        assert "previous" in data
        assert "buckets" in data["previous"]

        # Check insights include bucket info
        assert "biggest_bucket_increase" in data["insights"]
        assert "biggest_bucket_decrease" in data["insights"]

    @pytest.mark.asyncio
    async def test_anomalies_include_bucket_info(self, client: AsyncClient, seed_transactions):
        """Anomaly detection includes bucket tags"""
        response = await client.get("/api/v1/reports/anomalies?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        assert "unusual_buckets" in data["anomalies"]
        assert "unusual_bucket_count" in data["summary"]
