"""
Performance tests for report generation endpoints.

Tests report generation times with large datasets (10k+ transactions).
"""

import pytest

from .conftest import timed_request


@pytest.mark.performance
class TestReportPerformance:
    """Report generation performance tests."""

    async def test_trends_report_weekly(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Weekly trends report should aggregate efficiently."""
        metadata = seed_large_dataset
        start_date, end_date = metadata["date_range"]

        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/trends",
                params={"start_date": start_date.isoformat(), "end_date": end_date.isoformat(), "group_by": "week"},
            )

        assert response.status_code == 200
        data = response.json()
        assert len(data.get("data", [])) > 0

        timing.assert_under(
            thresholds.REPORT_GENERATION_MS,
            f"Weekly trends too slow: {timing.duration_ms:.0f}ms, {timing.query_count} queries",
        )

    async def test_trends_report_monthly(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Monthly trends report should aggregate efficiently."""
        metadata = seed_large_dataset
        start_date, end_date = metadata["date_range"]

        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/trends",
                params={"start_date": start_date.isoformat(), "end_date": end_date.isoformat(), "group_by": "month"},
            )

        assert response.status_code == 200
        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Monthly trends too slow")

    async def test_top_merchants_report(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Top merchants report should be fast."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get("/api/v1/reports/top-merchants", params={"year": 2024, "limit": 20})

        assert response.status_code == 200
        data = response.json()
        assert "merchants" in data

        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Top merchants too slow")
        query_counter.assert_max_queries(thresholds.MAX_QUERIES_REPORT, "Top merchants has too many queries")

    async def test_sankey_flow_report(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Sankey flow chart data should generate efficiently."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get("/api/v1/reports/sankey-flow", params={"year": 2024})

        assert response.status_code == 200
        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Sankey flow too slow")

    async def test_treemap_report(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Treemap spending breakdown should be efficient."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get("/api/v1/reports/treemap", params={"year": 2024})

        assert response.status_code == 200
        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Treemap too slow")

    async def test_month_over_month_report(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Month-over-month comparison should be fast."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/month-over-month", params={"current_year": 2024, "current_month": 6}
            )

        assert response.status_code == 200
        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Month-over-month too slow")

    async def test_spending_velocity_report(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Spending velocity should calculate quickly."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get("/api/v1/reports/spending-velocity", params={"year": 2024, "month": 6})

        assert response.status_code == 200
        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Spending velocity too slow")

    async def test_anomalies_report(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Anomaly detection should be efficient."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/anomalies", params={"year": 2024, "month": 6, "threshold": 2.0}
            )

        assert response.status_code == 200
        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Anomaly detection too slow")


@pytest.mark.performance
class TestReportFilterPerformance:
    """Test report performance with various filters applied."""

    async def test_trends_with_bucket_filter(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Filtered trends should not be significantly slower."""
        metadata = seed_large_dataset
        start_date, end_date = metadata["date_range"]

        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/trends",
                params={
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "group_by": "month",
                    "buckets": "groceries,dining",
                },
            )

        assert response.status_code == 200
        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Filtered trends too slow")

    async def test_trends_with_account_filter(self, perf_client, seed_large_dataset, query_counter, thresholds):
        """Account-filtered trends should be efficient."""
        metadata = seed_large_dataset
        start_date, end_date = metadata["date_range"]

        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/trends",
                params={
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "group_by": "month",
                    "accounts": "chase,amex",
                },
            )

        assert response.status_code == 200
        timing.assert_under(thresholds.REPORT_GENERATION_MS, "Account-filtered trends too slow")
