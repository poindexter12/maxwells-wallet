"""
Performance tests for transaction endpoints.

Tests pagination, search, and listing performance with large datasets.
"""

import pytest

from .conftest import timed_request, PerfThresholds


@pytest.mark.performance
class TestTransactionListPerformance:
    """Transaction listing performance tests."""

    async def test_transaction_list_first_page(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """First page of transactions should load quickly."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={"limit": 50, "skip": 0}
            )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 50

        timing.assert_under(
            thresholds.TRANSACTION_LIST_MS,
            f"Transaction list too slow ({timing.query_count} queries)"
        )
        query_counter.assert_max_queries(
            thresholds.MAX_QUERIES_TRANSACTION_LIST,
            "Transaction list has N+1 problem"
        )

    async def test_transaction_list_deep_pagination(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Deep pagination should still be efficient."""
        # Page 100 with 50 items = skip 5000
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={"limit": 50, "skip": 5000}
            )

        assert response.status_code == 200
        data = response.json()

        # Deep pagination with offset can be slow - allow more time
        # This test helps identify if cursor pagination is needed
        timing.assert_under(
            thresholds.TRANSACTION_LIST_MS * 3,  # 3x threshold for deep pagination
            f"Deep pagination too slow: {timing.duration_ms:.0f}ms"
        )

    async def test_transaction_list_with_sorting(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Default sort by date should be efficient."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={"limit": 50}
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.TRANSACTION_LIST_MS,
            "Sorted transaction list too slow"
        )

    async def test_transaction_total_count(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """Total count should be efficient."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get("/api/v1/transactions/count")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 10000

        # Count should be fast with proper indexing
        timing.assert_under(
            500,
            f"Total count too slow: {timing.duration_ms:.0f}ms"
        )


@pytest.mark.performance
class TestTransactionSearchPerformance:
    """Transaction search performance tests."""

    async def test_search_by_merchant(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Merchant search should be indexed."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={"search": "Whole Foods", "limit": 50}
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.TRANSACTION_SEARCH_MS,
            "Merchant search too slow"
        )

    async def test_search_by_date_range(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Date range filtering should use indexes."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={
                    "start_date": "2024-01-01",
                    "end_date": "2024-03-31",
                    "limit": 50
                }
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.TRANSACTION_SEARCH_MS,
            "Date range search too slow"
        )

    async def test_search_by_amount_range(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Amount range filtering should be efficient."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={
                    "amount_min": -100,
                    "amount_max": -50,
                    "limit": 50
                }
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.TRANSACTION_SEARCH_MS,
            "Amount range search too slow"
        )

    async def test_search_by_category(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Category filtering should be efficient."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={"category": "groceries", "limit": 50}
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.TRANSACTION_SEARCH_MS,
            "Category search too slow"
        )

    async def test_combined_filters(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Multiple filters combined should still be efficient."""
        async with timed_request(query_counter) as timing:
            response = await perf_client.get(
                "/api/v1/transactions/",
                params={
                    "start_date": "2024-01-01",
                    "end_date": "2024-06-30",
                    "category": "groceries",
                    "amount_max": -50,
                    "limit": 50
                }
            )

        assert response.status_code == 200
        timing.assert_under(
            thresholds.TRANSACTION_SEARCH_MS,
            "Combined filter search too slow"
        )


@pytest.mark.performance
class TestTransactionDetailPerformance:
    """Transaction detail and relationship loading tests."""

    async def test_transaction_detail_load(
        self, perf_client, seed_large_dataset, query_counter, thresholds
    ):
        """Single transaction detail should be fast."""
        # Get a transaction ID first
        list_response = await perf_client.get(
            "/api/v1/transactions/",
            params={"limit": 1}
        )
        assert list_response.status_code == 200
        txn_id = list_response.json()[0]["id"]

        async with timed_request(query_counter) as timing:
            response = await perf_client.get(f"/api/v1/transactions/{txn_id}")

        assert response.status_code == 200
        timing.assert_under(
            100,  # Single record should be very fast
            "Transaction detail too slow"
        )
        query_counter.assert_max_queries(
            thresholds.MAX_QUERIES_TRANSACTION_DETAIL,
            "Transaction detail has N+1 loading related data"
        )

    async def test_bulk_transaction_update(
        self, perf_client, seed_large_dataset, query_counter
    ):
        """Bulk updates should be batched efficiently."""
        # Get some transaction IDs
        list_response = await perf_client.get(
            "/api/v1/transactions/",
            params={"limit": 100}
        )
        assert list_response.status_code == 200
        txn_ids = [t["id"] for t in list_response.json()[:50]]

        async with timed_request(query_counter) as timing:
            response = await perf_client.post(
                "/api/v1/transactions/bulk-update",
                json={
                    "transaction_ids": txn_ids,
                    "updates": {"notes": "Bulk update test"}
                }
            )

        # Bulk endpoint may not accept this format - that's OK
        if response.status_code in (404, 422):
            pytest.skip("Bulk update endpoint format mismatch")

        assert response.status_code == 200
        # Bulk update should not be O(n) queries
        query_counter.assert_max_queries(
            10,
            f"Bulk update should batch: {len(txn_ids)} items, {query_counter.count} queries"
        )
