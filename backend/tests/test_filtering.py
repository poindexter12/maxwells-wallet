"""
Comprehensive tests for transaction filtering functionality.

Tests cover:
- Account filtering (include/exclude via account_tag_id FK)
- Tag filtering (include/exclude via TransactionTag junction)
- Combined filter scenarios
- Edge cases and validation
"""
import pytest
from httpx import AsyncClient
from datetime import date
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction, Tag, TransactionTag


class TestAccountFiltering:
    """Tests for account filtering via account_tag_id FK"""

    @pytest.mark.asyncio
    async def test_filter_by_single_account(self, client: AsyncClient, seed_transactions):
        """Filter transactions by a single account tag value"""
        # BOFA-1234 has 2 transactions (income)
        response = await client.get("/api/v1/transactions?account=bofa-1234")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for txn in data:
            assert txn["account_source"] == "BOFA-1234"

    @pytest.mark.asyncio
    async def test_filter_by_multiple_accounts_or_logic(self, client: AsyncClient, seed_transactions):
        """Filter transactions by multiple accounts (OR logic)"""
        # Both accounts should return all 6 transactions
        response = await client.get("/api/v1/transactions?account=bofa-1234&account=amex-5678")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 6

    @pytest.mark.asyncio
    async def test_exclude_single_account(self, client: AsyncClient, seed_transactions):
        """Exclude transactions from a single account"""
        # Exclude AMEX-5678 (4 transactions), should leave 2 BOFA transactions
        response = await client.get("/api/v1/transactions?account_exclude=amex-5678")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for txn in data:
            assert txn["account_source"] == "BOFA-1234"

    @pytest.mark.asyncio
    async def test_exclude_multiple_accounts(self, client: AsyncClient, seed_transactions):
        """Exclude transactions from multiple accounts"""
        # Exclude both accounts should return nothing
        response = await client.get("/api/v1/transactions?account_exclude=bofa-1234&account_exclude=amex-5678")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_include_and_exclude_accounts(self, client: AsyncClient, seed_transactions):
        """Include some accounts while excluding others"""
        # Include AMEX, exclude BOFA (should get all AMEX)
        response = await client.get("/api/v1/transactions?account=amex-5678&account_exclude=bofa-1234")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 4
        for txn in data:
            assert txn["account_source"] == "AMEX-5678"

    @pytest.mark.asyncio
    async def test_filter_nonexistent_account(self, client: AsyncClient, seed_transactions):
        """Filter by account that doesn't exist returns empty"""
        response = await client.get("/api/v1/transactions?account=nonexistent-account")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_legacy_account_source_filter(self, client: AsyncClient, seed_transactions):
        """Legacy account_source filter still works"""
        response = await client.get("/api/v1/transactions?account_source=BOFA-1234")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for txn in data:
            assert txn["account_source"] == "BOFA-1234"


class TestTagFiltering:
    """Tests for tag filtering via TransactionTag junction table"""

    @pytest.mark.asyncio
    async def test_filter_by_bucket_tag(self, client: AsyncClient, seed_transactions):
        """Filter transactions by bucket tag"""
        # bucket:shopping has 2 transactions
        response = await client.get("/api/v1/transactions?tag=bucket:shopping")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for txn in data:
            assert txn["category"] == "Shopping"

    @pytest.mark.asyncio
    async def test_filter_by_multiple_tags_and_logic(self, client: AsyncClient, seed_transactions):
        """Filter by multiple tags uses AND logic"""
        # bucket:income AND bucket:shopping = 0 (same transaction can't have both)
        response = await client.get("/api/v1/transactions?tag=bucket:income&tag=bucket:shopping")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_exclude_bucket_tag(self, client: AsyncClient, seed_transactions):
        """Exclude transactions with specific bucket tag"""
        # Exclude income (2 transactions), should leave 4
        response = await client.get("/api/v1/transactions?tag_exclude=bucket:income")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 4
        for txn in data:
            assert txn["category"] != "Income"

    @pytest.mark.asyncio
    async def test_exclude_multiple_tags(self, client: AsyncClient, seed_transactions):
        """Exclude multiple tags"""
        # Exclude income and shopping
        response = await client.get("/api/v1/transactions?tag_exclude=bucket:income&tag_exclude=bucket:shopping")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # groceries and dining remain

    @pytest.mark.asyncio
    async def test_include_and_exclude_tags(self, client: AsyncClient, seed_transactions):
        """Include some tags while excluding others"""
        # All shopping but not dining (shopping has 2)
        response = await client.get("/api/v1/transactions?tag=bucket:shopping&tag_exclude=bucket:dining")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    @pytest.mark.asyncio
    async def test_filter_invalid_tag_format(self, client: AsyncClient, seed_transactions):
        """Invalid tag format (no colon) is ignored"""
        response = await client.get("/api/v1/transactions?tag=invalidformat")
        assert response.status_code == 200
        data = response.json()
        # Should return all transactions since invalid tag is ignored
        assert len(data) == 6


class TestCombinedFilters:
    """Tests for combining multiple filter types"""

    @pytest.mark.asyncio
    async def test_account_and_tag_filter(self, client: AsyncClient, seed_transactions):
        """Combine account and tag filters"""
        # AMEX account + shopping bucket
        response = await client.get("/api/v1/transactions?account=amex-5678&tag=bucket:shopping")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for txn in data:
            assert txn["account_source"] == "AMEX-5678"
            assert txn["category"] == "Shopping"

    @pytest.mark.asyncio
    async def test_account_tag_and_date_filter(self, client: AsyncClient, seed_transactions):
        """Combine account, tag, and date filters"""
        response = await client.get(
            "/api/v1/transactions?account=amex-5678&tag=bucket:shopping&start_date=2025-11-01&end_date=2025-11-30"
        )
        assert response.status_code == 200
        data = response.json()
        # Only the November 2025 shopping transactions from AMEX
        assert len(data) == 1
        assert data[0]["merchant"] == "Amazon"

    @pytest.mark.asyncio
    async def test_account_exclude_with_tag_filter(self, client: AsyncClient, seed_transactions):
        """Combine account exclusion with tag filter"""
        # Shopping transactions but NOT from BOFA
        response = await client.get("/api/v1/transactions?tag=bucket:shopping&account_exclude=bofa-1234")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for txn in data:
            assert txn["account_source"] == "AMEX-5678"

    @pytest.mark.asyncio
    async def test_search_with_account_filter(self, client: AsyncClient, seed_transactions):
        """Combine text search with account filter"""
        response = await client.get("/api/v1/transactions?search=Amazon&account=amex-5678")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["merchant"] == "Amazon"

    @pytest.mark.asyncio
    async def test_amount_range_with_account_filter(self, client: AsyncClient, seed_transactions):
        """Combine amount range with account filter"""
        # Large expenses (> $100) from AMEX
        response = await client.get("/api/v1/transactions?account=amex-5678&amount_max=-100")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["merchant"] == "Amazon"

    @pytest.mark.asyncio
    async def test_all_filters_combined(self, client: AsyncClient, seed_transactions):
        """Test all filter types combined"""
        response = await client.get(
            "/api/v1/transactions"
            "?account=amex-5678"
            "&tag=bucket:shopping"
            "&reconciliation_status=unreconciled"
            "&start_date=2025-11-01"
            "&end_date=2025-11-30"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["merchant"] == "Amazon"
        assert data[0]["reconciliation_status"] == "unreconciled"


class TestAccountStatsEndpoint:
    """Tests for /api/v1/tags/accounts/stats endpoint"""

    @pytest.mark.asyncio
    async def test_account_stats_returns_correct_counts(self, client: AsyncClient, seed_transactions):
        """Account stats endpoint returns accurate transaction counts"""
        response = await client.get("/api/v1/tags/accounts/stats")
        assert response.status_code == 200
        data = response.json()

        accounts = {a["value"]: a for a in data["accounts"]}

        # BOFA-1234 has 2 transactions totaling $7000
        assert accounts["bofa-1234"]["transaction_count"] == 2
        assert accounts["bofa-1234"]["total_amount"] == 7000.0

        # AMEX-5678 has 4 transactions
        assert accounts["amex-5678"]["transaction_count"] == 4

    @pytest.mark.asyncio
    async def test_account_stats_includes_empty_accounts(self, client: AsyncClient, seed_transactions):
        """Account stats includes accounts with zero transactions"""
        response = await client.get("/api/v1/tags/accounts/stats")
        assert response.status_code == 200
        data = response.json()

        # chase-9999 exists but has no transactions
        accounts = {a["value"]: a for a in data["accounts"]}
        assert "chase-9999" in accounts
        assert accounts["chase-9999"]["transaction_count"] == 0


class TestEdgeCases:
    """Edge cases and validation tests"""

    @pytest.mark.asyncio
    async def test_empty_account_filter_returns_all(self, client: AsyncClient, seed_transactions):
        """Empty account filter returns all transactions"""
        response = await client.get("/api/v1/transactions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 6

    @pytest.mark.asyncio
    async def test_pagination_with_filters(self, client: AsyncClient, seed_transactions):
        """Pagination works correctly with filters"""
        response = await client.get("/api/v1/transactions?account=amex-5678&limit=2&skip=0")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        response2 = await client.get("/api/v1/transactions?account=amex-5678&limit=2&skip=2")
        data2 = response2.json()
        assert len(data2) == 2

        # No overlap in IDs
        ids1 = {t["id"] for t in data}
        ids2 = {t["id"] for t in data2}
        assert ids1.isdisjoint(ids2)

    @pytest.mark.asyncio
    async def test_case_sensitivity_in_account_filter(self, client: AsyncClient, seed_transactions):
        """Account filter is case-sensitive (tag values are lowercase)"""
        # Lowercase should work
        response = await client.get("/api/v1/transactions?account=bofa-1234")
        assert response.status_code == 200
        assert len(response.json()) == 2

        # Uppercase should not match (tag values are stored lowercase)
        response2 = await client.get("/api/v1/transactions?account=BOFA-1234")
        assert response2.status_code == 200
        assert len(response2.json()) == 0


class TestOccasionTagFiltering:
    """Tests for filtering by occasion tags"""

    @pytest.mark.asyncio
    async def test_add_and_filter_by_occasion(
        self, client: AsyncClient, seed_transactions, async_session: AsyncSession
    ):
        """Add occasion tag to transaction and filter by it"""
        # Get a transaction
        response = await client.get("/api/v1/transactions")
        txn_id = response.json()[0]["id"]

        # Add vacation occasion tag
        add_response = await client.post(
            f"/api/v1/transactions/{txn_id}/tags",
            json={"tag": "occasion:vacation"}
        )
        assert add_response.status_code == 200

        # Filter by occasion
        filter_response = await client.get("/api/v1/transactions?tag=occasion:vacation")
        assert filter_response.status_code == 200
        data = filter_response.json()
        assert len(data) == 1
        assert data[0]["id"] == txn_id

    @pytest.mark.asyncio
    async def test_exclude_occasion_tag(self, client: AsyncClient, seed_transactions):
        """Exclude transactions with occasion tag"""
        # Add vacation tag to first 2 transactions
        response = await client.get("/api/v1/transactions")
        for txn in response.json()[:2]:
            await client.post(
                f"/api/v1/transactions/{txn['id']}/tags",
                json={"tag": "occasion:vacation"}
            )

        # Exclude vacation
        filter_response = await client.get("/api/v1/transactions?tag_exclude=occasion:vacation")
        assert filter_response.status_code == 200
        data = filter_response.json()
        assert len(data) == 4  # 6 total - 2 with vacation
