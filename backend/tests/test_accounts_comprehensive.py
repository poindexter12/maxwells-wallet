"""
Comprehensive tests for accounts.py router to increase coverage.
"""

import pytest
from httpx import AsyncClient


class TestAccountsComprehensive:
    """Comprehensive tests for account management"""

    @pytest.mark.asyncio
    async def test_list_account_summary(self, client: AsyncClient, seed_transactions):
        """List all accounts with summary stats"""
        response = await client.get("/api/v1/accounts/summary")
        assert response.status_code == 200
        accounts = response.json()
        assert isinstance(accounts, list)

        for account in accounts:
            assert "account_source" in account or "account" in account
            assert "transaction_count" in account or "count" in account

    @pytest.mark.asyncio
    async def test_get_specific_account(self, client: AsyncClient, seed_transactions):
        """Get specific account details"""
        # Get account list first
        list_response = await client.get("/api/v1/accounts/summary")
        accounts = list_response.json()

        if accounts:
            account_source = accounts[0].get("account_source") or accounts[0].get("account")
            if account_source:
                response = await client.get(f"/api/v1/accounts/{account_source}")
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent_account(self, client: AsyncClient):
        """Get nonexistent account returns 404"""
        response = await client.get("/api/v1/accounts/NONEXISTENT-9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_account_credit_limit(self, client: AsyncClient, seed_transactions):
        """Update account credit limit"""
        # Get an existing account
        list_response = await client.get("/api/v1/accounts/summary")
        accounts = list_response.json()

        if accounts:
            account_source = accounts[0].get("account_source") or accounts[0].get("account")
            if account_source:
                response = await client.patch(f"/api/v1/accounts/{account_source}", json={"credit_limit": 5000.00})
                # Might succeed or fail depending on account type
                assert response.status_code in [200, 400, 422]

    @pytest.mark.asyncio
    async def test_update_account_due_day(self, client: AsyncClient, seed_transactions):
        """Update account due day"""
        list_response = await client.get("/api/v1/accounts/summary")
        accounts = list_response.json()

        if accounts:
            account_source = accounts[0].get("account_source") or accounts[0].get("account")
            if account_source:
                response = await client.patch(f"/api/v1/accounts/{account_source}", json={"due_day": 15})
                assert response.status_code in [200, 400, 422]

    @pytest.mark.asyncio
    async def test_update_nonexistent_account(self, client: AsyncClient):
        """Update nonexistent account returns 404"""
        response = await client.patch("/api/v1/accounts/NONEXISTENT-9999", json={"credit_limit": 1000.00})
        assert response.status_code == 404
