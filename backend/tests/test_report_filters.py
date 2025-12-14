"""
Tests for report filter helper functions.

These tests cover the filter functions used in reports.py for
filtering transactions by buckets, accounts, and merchants.
"""

import pytest
from httpx import AsyncClient
from datetime import date

from app.routers.reports import (
    filter_transactions_by_accounts,
    filter_transactions_by_merchants,
    parse_filter_param,
)
from app.models import Transaction


class TestParseFilterParam:
    """Tests for parse_filter_param function."""

    def test_parse_empty_param(self):
        """Empty param returns empty list."""
        assert parse_filter_param(None) == []
        assert parse_filter_param("") == []

    def test_parse_single_value(self):
        """Single value is returned as list."""
        assert parse_filter_param("groceries") == ["groceries"]

    def test_parse_multiple_values(self):
        """Comma-separated values are parsed correctly."""
        result = parse_filter_param("groceries,dining,travel")
        assert result == ["groceries", "dining", "travel"]

    def test_parse_trims_whitespace(self):
        """Whitespace around values is trimmed."""
        result = parse_filter_param("  groceries , dining , travel  ")
        assert result == ["groceries", "dining", "travel"]

    def test_parse_skips_empty_values(self):
        """Empty values from multiple commas are skipped."""
        result = parse_filter_param("groceries,,dining,")
        assert result == ["groceries", "dining"]


class TestFilterTransactionsByAccounts:
    """Tests for filter_transactions_by_accounts function."""

    def _make_transaction(self, account_source: str) -> Transaction:
        """Helper to create a transaction with specific account."""
        return Transaction(
            date=date(2024, 1, 15),
            amount=-50.0,
            description="Test",
            merchant="Test Merchant",
            account_source=account_source,
        )

    def test_empty_filter_returns_all(self):
        """Empty accounts filter returns all transactions."""
        txns = [
            self._make_transaction("AMEX"),
            self._make_transaction("BOFA"),
        ]
        result = filter_transactions_by_accounts(txns, [])
        assert len(result) == 2

    def test_filter_single_account(self):
        """Filter by single account works."""
        txns = [
            self._make_transaction("AMEX"),
            self._make_transaction("BOFA"),
            self._make_transaction("AMEX"),
        ]
        result = filter_transactions_by_accounts(txns, ["AMEX"])
        assert len(result) == 2
        assert all(t.account_source == "AMEX" for t in result)

    def test_filter_multiple_accounts(self):
        """Filter by multiple accounts works."""
        txns = [
            self._make_transaction("AMEX"),
            self._make_transaction("BOFA"),
            self._make_transaction("CHASE"),
        ]
        result = filter_transactions_by_accounts(txns, ["AMEX", "CHASE"])
        assert len(result) == 2
        assert {t.account_source for t in result} == {"AMEX", "CHASE"}

    def test_filter_no_matches(self):
        """Filter with no matches returns empty list."""
        txns = [
            self._make_transaction("AMEX"),
            self._make_transaction("BOFA"),
        ]
        result = filter_transactions_by_accounts(txns, ["CHASE"])
        assert len(result) == 0


class TestFilterTransactionsByMerchants:
    """Tests for filter_transactions_by_merchants function."""

    def _make_transaction(self, merchant: str) -> Transaction:
        """Helper to create a transaction with specific merchant."""
        return Transaction(
            date=date(2024, 1, 15),
            amount=-50.0,
            description="Test",
            merchant=merchant,
            account_source="TEST",
        )

    def test_empty_filter_returns_all(self):
        """Empty merchants filter returns all transactions."""
        txns = [
            self._make_transaction("Amazon"),
            self._make_transaction("Walmart"),
        ]
        result = filter_transactions_by_merchants(txns, [])
        assert len(result) == 2

    def test_filter_single_merchant(self):
        """Filter by single merchant works."""
        txns = [
            self._make_transaction("Amazon"),
            self._make_transaction("Walmart"),
            self._make_transaction("Amazon"),
        ]
        result = filter_transactions_by_merchants(txns, ["Amazon"])
        assert len(result) == 2
        assert all(t.merchant == "Amazon" for t in result)

    def test_filter_case_insensitive(self):
        """Merchant filter is case-insensitive."""
        txns = [
            self._make_transaction("AMAZON"),
            self._make_transaction("amazon"),
            self._make_transaction("Amazon"),
        ]
        result = filter_transactions_by_merchants(txns, ["amazon"])
        assert len(result) == 3

    def test_filter_multiple_merchants(self):
        """Filter by multiple merchants works."""
        txns = [
            self._make_transaction("Amazon"),
            self._make_transaction("Walmart"),
            self._make_transaction("Target"),
        ]
        result = filter_transactions_by_merchants(txns, ["Amazon", "Target"])
        assert len(result) == 2

    def test_filter_handles_none_merchant(self):
        """Filter handles transactions with None merchant."""
        txn_with_merchant = self._make_transaction("Amazon")
        txn_without_merchant = Transaction(
            date=date(2024, 1, 15),
            amount=-50.0,
            description="Test",
            merchant=None,
            account_source="TEST",
        )
        txns = [txn_with_merchant, txn_without_merchant]
        result = filter_transactions_by_merchants(txns, ["Amazon"])
        assert len(result) == 1
        assert result[0].merchant == "Amazon"


class TestReportFiltersAPI:
    """Integration tests for report endpoints with filters."""

    @pytest.mark.asyncio
    async def test_monthly_summary_with_account_filter(
        self, client: AsyncClient, seed_transactions
    ):
        """Monthly summary respects account filter."""
        response = await client.get(
            "/api/v1/reports/monthly-summary",
            params={"year": 2024, "month": 1, "accounts": "AMEX-53004"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_monthly_summary_with_merchant_filter(
        self, client: AsyncClient, seed_transactions
    ):
        """Monthly summary respects merchant filter."""
        response = await client.get(
            "/api/v1/reports/monthly-summary",
            params={"year": 2024, "month": 1, "merchants": "Amazon"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_monthly_summary_december(
        self, client: AsyncClient, seed_transactions
    ):
        """Monthly summary handles December correctly (year rollover)."""
        response = await client.get(
            "/api/v1/reports/monthly-summary",
            params={"year": 2024, "month": 12},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["year"] == 2024
        assert data["month"] == 12

    @pytest.mark.asyncio
    async def test_monthly_summary_with_bucket_filter(
        self, client: AsyncClient, seed_transactions
    ):
        """Monthly summary respects bucket filter."""
        response = await client.get(
            "/api/v1/reports/monthly-summary",
            params={"year": 2024, "month": 1, "buckets": "groceries,dining"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_with_filters(
        self, client: AsyncClient, seed_transactions
    ):
        """Top merchants respects filters."""
        response = await client.get(
            "/api/v1/reports/top-merchants",
            params={"period": "current_month", "accounts": "AMEX-53004"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_with_year_month(
        self, client: AsyncClient, seed_transactions
    ):
        """Top merchants with specific year/month overrides period."""
        response = await client.get(
            "/api/v1/reports/top-merchants",
            params={"year": 2024, "month": 12},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_year_only(
        self, client: AsyncClient, seed_transactions
    ):
        """Top merchants with year only (full year)."""
        response = await client.get(
            "/api/v1/reports/top-merchants",
            params={"year": 2024},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_last_month(
        self, client: AsyncClient, seed_transactions
    ):
        """Top merchants for last_month period."""
        response = await client.get(
            "/api/v1/reports/top-merchants",
            params={"period": "last_month"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_last_3_months(
        self, client: AsyncClient, seed_transactions
    ):
        """Top merchants for last_3_months period."""
        response = await client.get(
            "/api/v1/reports/top-merchants",
            params={"period": "last_3_months"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_last_6_months(
        self, client: AsyncClient, seed_transactions
    ):
        """Top merchants for last_6_months period."""
        response = await client.get(
            "/api/v1/reports/top-merchants",
            params={"period": "last_6_months"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_top_merchants_all_time(
        self, client: AsyncClient, seed_transactions
    ):
        """Top merchants for all_time period."""
        response = await client.get(
            "/api/v1/reports/top-merchants",
            params={"period": "all_time"},
        )
        assert response.status_code == 200


class TestAnnualSummaryAPI:
    """Tests for annual-summary endpoint."""

    @pytest.mark.asyncio
    async def test_annual_summary_basic(
        self, client: AsyncClient, seed_transactions
    ):
        """Annual summary returns expected structure."""
        response = await client.get(
            "/api/v1/reports/annual-summary",
            params={"year": 2024},
        )
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        assert "monthly_breakdown" in data
        assert "daily_average" in data

    @pytest.mark.asyncio
    async def test_annual_summary_with_buckets(
        self, client: AsyncClient, seed_transactions
    ):
        """Annual summary respects bucket filter."""
        response = await client.get(
            "/api/v1/reports/annual-summary",
            params={"year": 2024, "buckets": "groceries"},
        )
        assert response.status_code == 200


class TestTrendsAPI:
    """Tests for trends endpoint."""

    @pytest.mark.asyncio
    async def test_trends_by_month(
        self, client: AsyncClient, seed_transactions
    ):
        """Trends grouped by month."""
        response = await client.get(
            "/api/v1/reports/trends",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "group_by": "month",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "month"

    @pytest.mark.asyncio
    async def test_trends_by_week(
        self, client: AsyncClient, seed_transactions
    ):
        """Trends grouped by week."""
        response = await client.get(
            "/api/v1/reports/trends",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-03-31",
                "group_by": "week",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "week"

    @pytest.mark.asyncio
    async def test_trends_by_category(
        self, client: AsyncClient, seed_transactions
    ):
        """Trends grouped by category."""
        response = await client.get(
            "/api/v1/reports/trends",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "group_by": "category",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "category"

    @pytest.mark.asyncio
    async def test_trends_by_account(
        self, client: AsyncClient, seed_transactions
    ):
        """Trends grouped by account."""
        response = await client.get(
            "/api/v1/reports/trends",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "group_by": "account",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "account"

    @pytest.mark.asyncio
    async def test_trends_by_tag(
        self, client: AsyncClient, seed_transactions
    ):
        """Trends grouped by bucket tag."""
        response = await client.get(
            "/api/v1/reports/trends",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "group_by": "tag",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group_by"] == "tag"

    @pytest.mark.asyncio
    async def test_trends_with_filters(
        self, client: AsyncClient, seed_transactions
    ):
        """Trends with account, bucket, and merchant filters."""
        response = await client.get(
            "/api/v1/reports/trends",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "group_by": "month",
                "accounts": "AMEX-53004",
                "buckets": "groceries",
                "merchants": "Amazon",
            },
        )
        assert response.status_code == 200


class TestAccountAndBucketSummaryAPI:
    """Tests for account-summary and bucket-summary endpoints."""

    @pytest.mark.asyncio
    async def test_account_summary(
        self, client: AsyncClient, seed_transactions
    ):
        """Account summary returns expected structure."""
        response = await client.get("/api/v1/reports/account-summary")
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data

    @pytest.mark.asyncio
    async def test_bucket_summary_no_dates(
        self, client: AsyncClient, seed_transactions
    ):
        """Bucket summary without date filters."""
        response = await client.get("/api/v1/reports/bucket-summary")
        assert response.status_code == 200
        data = response.json()
        assert "buckets" in data

    @pytest.mark.asyncio
    async def test_bucket_summary_with_date_range(
        self, client: AsyncClient, seed_transactions
    ):
        """Bucket summary with date range."""
        response = await client.get(
            "/api/v1/reports/bucket-summary",
            params={"start_date": "2024-01-01", "end_date": "2024-06-30"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_filter_options(
        self, client: AsyncClient, seed_transactions
    ):
        """Filter options endpoint returns accounts and merchants."""
        response = await client.get("/api/v1/reports/filter-options")
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        assert "merchants" in data


class TestMonthOverMonthAPI:
    """Tests for month-over-month comparison endpoint."""

    @pytest.mark.asyncio
    async def test_month_over_month_basic(
        self, client: AsyncClient, seed_transactions
    ):
        """Month-over-month comparison returns expected structure."""
        response = await client.get(
            "/api/v1/reports/month-over-month",
            params={"current_year": 2024, "current_month": 6},
        )
        assert response.status_code == 200
        data = response.json()
        assert "current" in data
        assert "previous" in data
        assert "changes" in data
        assert "insights" in data

    @pytest.mark.asyncio
    async def test_month_over_month_january(
        self, client: AsyncClient, seed_transactions
    ):
        """Month-over-month handles January (previous year December)."""
        response = await client.get(
            "/api/v1/reports/month-over-month",
            params={"current_year": 2024, "current_month": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["previous_period"] == "2023-12"


class TestSpendingVelocityAPI:
    """Tests for spending-velocity endpoint."""

    @pytest.mark.asyncio
    async def test_spending_velocity_current_month(
        self, client: AsyncClient, seed_transactions
    ):
        """Spending velocity for current month."""
        from datetime import date as d

        today = d.today()
        response = await client.get(
            "/api/v1/reports/spending-velocity",
            params={"year": today.year, "month": today.month},
        )
        assert response.status_code == 200
        data = response.json()
        assert "daily_rates" in data
        assert "projected_monthly" in data
        assert "pace" in data

    @pytest.mark.asyncio
    async def test_spending_velocity_past_month(
        self, client: AsyncClient, seed_transactions
    ):
        """Spending velocity for a past month shows completed status."""
        response = await client.get(
            "/api/v1/reports/spending-velocity",
            params={"year": 2024, "month": 1},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["pace"] == "completed"

    @pytest.mark.asyncio
    async def test_spending_velocity_january(
        self, client: AsyncClient, seed_transactions
    ):
        """Spending velocity handles January (previous year December)."""
        response = await client.get(
            "/api/v1/reports/spending-velocity",
            params={"year": 2024, "month": 1},
        )
        assert response.status_code == 200


class TestAnomaliesAPI:
    """Tests for anomalies detection endpoint."""

    @pytest.mark.asyncio
    async def test_anomalies_basic(
        self, client: AsyncClient, seed_transactions
    ):
        """Anomalies endpoint returns expected structure."""
        response = await client.get(
            "/api/v1/reports/anomalies",
            params={"year": 2024, "month": 6},
        )
        assert response.status_code == 200
        data = response.json()
        assert "anomalies" in data
        assert "summary" in data
        assert "baseline_period" in data

    @pytest.mark.asyncio
    async def test_anomalies_with_threshold(
        self, client: AsyncClient, seed_transactions
    ):
        """Anomalies endpoint respects custom threshold."""
        response = await client.get(
            "/api/v1/reports/anomalies",
            params={"year": 2024, "month": 6, "threshold": 1.5},
        )
        assert response.status_code == 200


class TestVisualizationEndpointsAPI:
    """Tests for visualization-related endpoints (sankey, treemap, heatmap)."""

    @pytest.mark.asyncio
    async def test_sankey_flow_monthly(
        self, client: AsyncClient, seed_transactions
    ):
        """Sankey flow for specific month."""
        response = await client.get(
            "/api/v1/reports/sankey-flow",
            params={"year": 2024, "month": 6},
        )
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "links" in data

    @pytest.mark.asyncio
    async def test_sankey_flow_yearly(
        self, client: AsyncClient, seed_transactions
    ):
        """Sankey flow for full year (no month)."""
        response = await client.get(
            "/api/v1/reports/sankey-flow",
            params={"year": 2024},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_sankey_flow_with_filters(
        self, client: AsyncClient, seed_transactions
    ):
        """Sankey flow with filters."""
        response = await client.get(
            "/api/v1/reports/sankey-flow",
            params={"year": 2024, "accounts": "AMEX-53004", "buckets": "groceries"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_treemap_monthly(
        self, client: AsyncClient, seed_transactions
    ):
        """Treemap for specific month."""
        response = await client.get(
            "/api/v1/reports/treemap",
            params={"year": 2024, "month": 6},
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_treemap_yearly(
        self, client: AsyncClient, seed_transactions
    ):
        """Treemap for full year."""
        response = await client.get(
            "/api/v1/reports/treemap",
            params={"year": 2024},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_heatmap_monthly(
        self, client: AsyncClient, seed_transactions
    ):
        """Spending heatmap for specific month (daily breakdown)."""
        response = await client.get(
            "/api/v1/reports/spending-heatmap",
            params={"year": 2024, "month": 6},
        )
        assert response.status_code == 200
        data = response.json()
        assert "days" in data
        assert "summary" in data

    @pytest.mark.asyncio
    async def test_heatmap_yearly(
        self, client: AsyncClient, seed_transactions
    ):
        """Spending heatmap for full year (monthly breakdown)."""
        response = await client.get(
            "/api/v1/reports/spending-heatmap",
            params={"year": 2024},
        )
        assert response.status_code == 200
        data = response.json()
        assert "days" in data

    @pytest.mark.asyncio
    async def test_heatmap_with_filters(
        self, client: AsyncClient, seed_transactions
    ):
        """Spending heatmap with filters."""
        response = await client.get(
            "/api/v1/reports/spending-heatmap",
            params={"year": 2024, "month": 6, "accounts": "AMEX-53004"},
        )
        assert response.status_code == 200
