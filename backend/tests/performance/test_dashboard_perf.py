"""
Performance tests for dashboard endpoints.

Tests dashboard load times and query counts with large datasets.
"""

import pytest

from .conftest import timed_request, PerfThresholds


@pytest.mark.performance
class TestDashboardPerformance:
    """Dashboard performance tests."""

    async def test_dashboard_list_response_time(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Dashboard list should load quickly."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get("/api/v1/dashboards")

        assert response.status_code == 200
        timing.assert_under(
            thresholds.DASHBOARD_LOAD_MS,
            f"Dashboard list too slow ({timing.query_count} queries)"
        )
        query_counter.assert_max_queries(
            5,
            "Dashboard list should not require many queries"
        )

    async def test_dashboard_with_widgets_response_time(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Dashboard with widgets should load efficiently."""
        # Get first dashboard
        dashboards = await perf_client.get("/api/v1/dashboards")
        dashboard_id = dashboards.json()[0]["id"]

        async with timed_request(query_counter) as timing:
            response = await perf_client.get(f"/api/v1/dashboards/{dashboard_id}")

        assert response.status_code == 200
        timing.assert_under(
            thresholds.DASHBOARD_LOAD_MS,
            f"Dashboard detail too slow ({timing.query_count} queries)"
        )
        query_counter.assert_max_queries(
            thresholds.MAX_QUERIES_DASHBOARD,
            "Dashboard detail has too many queries (possible N+1)"
        )

    async def test_dashboard_widgets_no_n_plus_one(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """Loading widgets should not cause N+1 queries."""
        # Get dashboard with widgets (outside timed block)
        dashboards = await perf_client.get("/api/v1/dashboards")
        dashboard_id = dashboards.json()[0]["id"]

        # Reset counter before main request
        query_counter.reset()

        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                f"/api/v1/dashboards/{dashboard_id}/widgets"
            )

        assert response.status_code == 200
        widgets = response.json()

        # Query count should be constant regardless of widget count
        # Allow up to 5 queries for the widget endpoint
        query_counter.assert_max_queries(
            5,
            f"Widget loading has N+1 problem: {len(widgets)} widgets, {query_counter.count} queries"
        )


@pytest.mark.performance
class TestDashboardDataPerformance:
    """Tests for dashboard data aggregation endpoints."""

    async def test_monthly_summary_performance(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Monthly summary should aggregate efficiently."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/monthly-summary",
                params={"year": 2024, "month": 6}
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.REPORT_GENERATION_MS,
            f"Monthly summary too slow ({timing.query_count} queries)"
        )
        query_counter.assert_max_queries(
            thresholds.MAX_QUERIES_REPORT,
            "Monthly summary has too many queries"
        )

    async def test_annual_summary_performance(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Annual summary should handle full year efficiently."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/annual-summary",
                params={"year": 2024}
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.REPORT_GENERATION_MS,
            f"Annual summary too slow ({timing.query_count} queries)"
        )

    async def test_spending_heatmap_performance(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Spending heatmap should generate quickly."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/reports/spending-heatmap",
                params={"year": 2024, "month": 6}
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.REPORT_GENERATION_MS,
            "Spending heatmap too slow"
        )
