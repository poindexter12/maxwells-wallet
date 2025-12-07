"""
Query analysis tests for detecting N+1 problems and inefficient queries.

These tests focus on query counts rather than response times.
"""

import pytest

from .conftest import timed_request


@pytest.mark.performance
class TestQueryPatterns:
    """Tests for detecting problematic query patterns."""

    async def test_transaction_list_constant_queries(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Transaction list query count should be O(1), not O(n).

        A classic N+1 pattern is loading related tags/accounts
        in a loop instead of using joins or selectinload.
        """
        # Fetch 10 items
        query_counter.reset()
        async with timed_request(query_counter):
            await perf_client.get("/api/v1/transactions/", params={"limit": 10})
        queries_for_10 = query_counter.count

        # Fetch 50 items
        query_counter.reset()
        async with timed_request(query_counter):
            await perf_client.get("/api/v1/transactions/", params={"limit": 50})
        queries_for_50 = query_counter.count

        # Query count should not scale with result size
        # Allow some variance but not 5x for 5x items
        assert queries_for_50 < queries_for_10 * 2, (
            f"Possible N+1: {queries_for_10} queries for 10 items, "
            f"{queries_for_50} queries for 50 items"
        )

    async def test_dashboard_widgets_constant_queries(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Loading widgets should not cause N+1 per widget.
        """
        dashboards = await perf_client.get("/api/v1/dashboards")
        assert dashboards.status_code == 200
        dashboard_id = dashboards.json()[0]["id"]

        query_counter.reset()
        async with timed_request(query_counter):
            response = await perf_client.get(
                f"/api/v1/dashboards/{dashboard_id}/widgets"
            )

        assert response.status_code == 200
        widget_count = len(response.json())
        # Should be max 3 queries regardless of widget count
        # (1 for dashboard, 1 for widgets, maybe 1 for configs)
        assert query_counter.count <= 5, (
            f"Widget loading is O(n): {widget_count} widgets, "
            f"{query_counter.count} queries"
        )

    async def test_tags_list_no_usage_n_plus_one(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Tag listing should not query each tag separately.
        """
        query_counter.reset()
        async with timed_request(query_counter):
            response = await perf_client.get("/api/v1/tags/")

        assert response.status_code == 200
        tag_count = len(response.json())
        # Tags list should be a single query or very few
        assert query_counter.count <= 5, (
            f"Tag listing may have N+1: {tag_count} tags, "
            f"{query_counter.count} queries"
        )

    async def test_budgets_with_spending_efficient(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Budget status with spending should batch calculations.
        """
        query_counter.reset()
        async with timed_request(query_counter):
            response = await perf_client.get("/api/v1/budgets/status/current")

        assert response.status_code == 200
        budgets = response.json()
        # Budget status requires aggregation queries but should be bounded
        assert query_counter.count <= 20, (
            f"Budget spending calculation may be N+1: "
            f"{len(budgets)} budgets, {query_counter.count} queries"
        )


@pytest.mark.performance
class TestIndexUsage:
    """Tests to verify indexes are being used for common queries."""

    async def test_date_range_uses_index(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Date range queries should be fast (indicating index usage).

        If this test is slow, we need an index on transaction.date.
        """
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={
                    "start_date": "2024-06-01",
                    "end_date": "2024-06-30",
                    "limit": 100
                }
            )

        assert response.status_code == 200
        # Date-indexed query on 10k rows should be <200ms
        assert timing.duration_ms < 200, (
            f"Date range query slow ({timing.duration_ms:.0f}ms) - "
            "check index on transaction.date"
        )

    async def test_category_filter_uses_index(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Category filtering should be efficient.
        """
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={"category": "groceries", "limit": 100}
            )

        assert response.status_code == 200
        assert timing.duration_ms < 200, (
            f"Category filter slow ({timing.duration_ms:.0f}ms) - "
            "check index on transaction.category"
        )

    async def test_account_filter_uses_index(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Account filtering should use index on account_tag_id.
        """
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={"account": ["chase"], "limit": 100}
            )

        assert response.status_code == 200
        assert timing.duration_ms < 200, (
            f"Account filter slow ({timing.duration_ms:.0f}ms) - "
            "check index on transaction.account_tag_id"
        )


@pytest.mark.performance
class TestAggregationEfficiency:
    """Tests for efficient aggregation queries."""

    async def test_bucket_aggregation_single_query(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Bucket breakdown should use GROUP BY, not multiple queries.
        """
        query_counter.reset()
        async with timed_request(query_counter):
            response = await perf_client.get(
                "/api/v1/reports/monthly-summary",
                params={"year": 2024, "month": 6}
            )

        assert response.status_code == 200
        # Monthly summary with bucket breakdown should be ~3-5 queries max
        # Not one query per bucket
        assert query_counter.count <= 5, (
            f"Bucket aggregation inefficient: {query_counter.count} queries. "
            "Consider using GROUP BY instead of per-bucket queries."
        )

    async def test_trend_aggregation_efficiency(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """
        Trends should aggregate in single query per metric.
        """
        query_counter.reset()
        async with timed_request(query_counter):
            response = await perf_client.get(
                "/api/v1/reports/trends",
                params={
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "group_by": "month"
                }
            )

        assert response.status_code == 200
        # 12 months of data should not be 12 queries
        assert query_counter.count <= 5, (
            f"Trend aggregation inefficient: {query_counter.count} queries "
            "for 12-month range. Use date_trunc and GROUP BY."
        )
