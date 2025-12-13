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
    async def test_top_merchants_with_filters(
        self, client: AsyncClient, seed_transactions
    ):
        """Top merchants respects filters."""
        response = await client.get(
            "/api/v1/reports/top-merchants",
            params={"period": "current_month", "accounts": "AMEX-53004"},
        )
        assert response.status_code == 200
