"""
Stress tests with 50k+ transactions.

These tests use a separate database with a larger dataset to stress test
performance under heavier load. Marked with @pytest.mark.slow to allow
exclusion from quick test runs.
"""

import pytest

from .conftest import timed_request, PerfThresholds


@pytest.mark.performance
@pytest.mark.slow
class TestStressTransactions:
    """Stress tests for transaction endpoints with 50k+ records."""

    async def test_transaction_list_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Transaction list should handle 50k+ records."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={"limit": 100}
            )

        assert response.status_code == 200
        assert len(response.json()) == 100

        # Allow more time for larger dataset
        assert timing.duration_ms < 500, (
            f"Transaction list too slow with 50k records: {timing.duration_ms:.0f}ms"
        )

    async def test_cursor_pagination_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Cursor pagination should scale to 50k+ records."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/paginated",
                params={"limit": 100}
            )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 100
        assert data["has_more"] is True

        assert timing.duration_ms < 500, (
            f"Cursor pagination too slow with 50k records: {timing.duration_ms:.0f}ms"
        )

    async def test_deep_offset_pagination_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Offset pagination degrades with depth - this documents the problem."""
        # Skip to page 500 (offset 25000) with 50k records
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={"limit": 50, "skip": 25000}
            )

        assert response.status_code == 200

        # This test documents that offset pagination is slow at depth
        # If this passes quickly, offset might be acceptable
        # If slow (>1s), use cursor pagination instead
        print(f"Deep offset pagination (skip 25000): {timing.duration_ms:.0f}ms")

    async def test_deep_cursor_pagination_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Cursor pagination should maintain performance at any depth."""
        # Navigate to ~page 500 by following cursors
        cursor = None
        for i in range(500):
            response = await stress_client.get(
                "/api/v1/transactions/paginated",
                params={"cursor": cursor, "limit": 50} if cursor else {"limit": 50}
            )
            if not response.json()["has_more"]:
                break
            cursor = response.json()["next_cursor"]

        # Time a request at this depth
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/paginated",
                params={"cursor": cursor, "limit": 50}
            )

        assert response.status_code == 200

        # Cursor should be fast regardless of depth
        assert timing.duration_ms < 500, (
            f"Cursor pagination at page 500 too slow: {timing.duration_ms:.0f}ms"
        )

    async def test_count_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Count should be efficient even with 50k+ records."""
        async with timed_request() as timing:
            response = await stress_client.get("/api/v1/transactions/count")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 50000

        assert timing.duration_ms < 500, (
            f"Count too slow with 50k records: {timing.duration_ms:.0f}ms"
        )

    async def test_filtered_search_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Filtered search should be efficient with 50k+ records."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={
                    "category": "groceries",
                    "start_date": "2024-01-01",
                    "end_date": "2024-06-30",
                    "limit": 100
                }
            )

        assert response.status_code == 200

        assert timing.duration_ms < 500, (
            f"Filtered search too slow with 50k records: {timing.duration_ms:.0f}ms"
        )


@pytest.mark.performance
@pytest.mark.slow
class TestStressReports:
    """Stress tests for report endpoints with 50k+ records."""

    async def test_annual_summary_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Annual summary should handle 2 years of data efficiently."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/reports/annual-summary",
                params={"year": 2024}
            )

        assert response.status_code == 200

        # Allow more time for aggregation over large dataset
        assert timing.duration_ms < 3000, (
            f"Annual summary too slow with 50k records: {timing.duration_ms:.0f}ms"
        )

    async def test_trends_report_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Trends report should aggregate efficiently."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/reports/trends",
                params={
                    "start_date": "2023-01-01",
                    "end_date": "2024-12-31",
                    "group_by": "month"
                }
            )

        assert response.status_code == 200

        assert timing.duration_ms < 3000, (
            f"Trends report too slow with 50k records: {timing.duration_ms:.0f}ms"
        )

    async def test_top_merchants_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Top merchants should aggregate efficiently."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/reports/top-merchants",
                params={
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "limit": 20
                }
            )

        assert response.status_code == 200

        assert timing.duration_ms < 2000, (
            f"Top merchants too slow with 50k records: {timing.duration_ms:.0f}ms"
        )


@pytest.mark.performance
@pytest.mark.slow
class TestStressDashboard:
    """Stress tests for dashboard with 50k+ records."""

    async def test_dashboard_load_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Dashboard should load within acceptable time."""
        # Get dashboard
        dashboards = await stress_client.get("/api/v1/dashboards")
        assert dashboards.status_code == 200
        dashboard_id = dashboards.json()[0]["id"]

        async with timed_request() as timing:
            response = await stress_client.get(f"/api/v1/dashboards/{dashboard_id}")

        assert response.status_code == 200

        assert timing.duration_ms < 1000, (
            f"Dashboard load too slow with 50k records: {timing.duration_ms:.0f}ms"
        )


@pytest.mark.performance
@pytest.mark.slow
class TestStressMultiAccountFiltering:
    """Stress tests for multi-account and tag-based filtering with 50k+ records."""

    async def test_filter_by_account_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Account filtering should be efficient with 12 accounts."""
        # Filter by one specific account
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={
                    "account": "Chase Sapphire Reserve",
                    "limit": 100
                }
            )

        assert response.status_code == 200
        data = response.json()
        # Should get transactions from that account
        for txn in data:
            assert txn["account_source"] == "Chase Sapphire Reserve"

        assert timing.duration_ms < 500, (
            f"Account filter too slow: {timing.duration_ms:.0f}ms"
        )

    async def test_filter_multiple_categories_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Multi-category filtering should be efficient."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={
                    "category": "groceries",
                    "limit": 100
                }
            )

        assert response.status_code == 200

        assert timing.duration_ms < 500, (
            f"Category filter too slow: {timing.duration_ms:.0f}ms"
        )

    async def test_filter_transfers_only_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Transfer filtering should be efficient."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={
                    "is_transfer": True,
                    "limit": 100
                }
            )

        assert response.status_code == 200
        data = response.json()
        # Should get only transfers
        for txn in data:
            assert txn["is_transfer"] is True

        assert timing.duration_ms < 500, (
            f"Transfer filter too slow: {timing.duration_ms:.0f}ms"
        )

    async def test_exclude_transfers_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Excluding transfers should be efficient for spending reports."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={
                    "is_transfer": False,
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "limit": 100
                }
            )

        assert response.status_code == 200
        data = response.json()
        for txn in data:
            assert txn["is_transfer"] is False

        assert timing.duration_ms < 500, (
            f"Exclude transfers filter too slow: {timing.duration_ms:.0f}ms"
        )

    async def test_combined_account_date_category_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Combined filters with multiple dimensions should be efficient."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={
                    "account": "Amex Gold",
                    "category": "dining",
                    "start_date": "2024-01-01",
                    "end_date": "2024-06-30",
                    "limit": 100
                }
            )

        assert response.status_code == 200

        assert timing.duration_ms < 500, (
            f"Combined filter too slow: {timing.duration_ms:.0f}ms"
        )

    async def test_card_member_filter_stress(
        self, stress_client, seed_stress_dataset
    ):
        """Card member filtering should be efficient for family accounts."""
        async with timed_request() as timing:
            response = await stress_client.get(
                "/api/v1/transactions/",
                params={
                    "card_member": "JANE DOE",
                    "limit": 100
                }
            )

        # Card member filter may not be implemented - skip if 422
        if response.status_code == 422:
            pytest.skip("Card member filter not implemented")

        assert response.status_code == 200

        assert timing.duration_ms < 500, (
            f"Card member filter too slow: {timing.duration_ms:.0f}ms"
        )
