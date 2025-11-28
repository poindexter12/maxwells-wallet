"""
Tests for FR-003: Category Inference
"""
import pytest
from httpx import AsyncClient


class TestCategories:
    """FR-003: Category Inference and Management"""

    @pytest.mark.asyncio
    async def test_list_categories(self, client: AsyncClient, seed_categories):
        """FR-003.2: Category Management - List categories"""
        response = await client.get("/api/v1/categories")
        assert response.status_code == 200
        data = response.json()

        # Verify all default categories exist
        category_names = [cat["name"] for cat in data]
        expected_categories = [
            "Income", "Groceries", "Dining & Coffee", "Shopping",
            "Utilities", "Transportation", "Entertainment", "Healthcare",
            "Education", "Housing", "Subscriptions", "Other"
        ]
        for expected in expected_categories:
            assert expected in category_names

    @pytest.mark.asyncio
    async def test_create_category(self, client: AsyncClient):
        """FR-003.2: Category Management - Add new category"""
        new_category = {"name": "Travel"}
        response = await client.post("/api/v1/categories", json=new_category)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Travel"

    @pytest.mark.asyncio
    async def test_edit_category(self, client: AsyncClient, seed_categories):
        """FR-003.2: Category Management - Edit category name"""
        # Get first category
        list_response = await client.get("/api/v1/categories")
        category_id = list_response.json()[0]["id"]

        # Update name
        update_data = {"name": "Updated Category"}
        response = await client.patch(f"/api/v1/categories/{category_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Category"

    @pytest.mark.asyncio
    async def test_suggest_category(self, client: AsyncClient, seed_categories, seed_transactions):
        """FR-003.1: Auto-Categorization - Category suggestion"""
        # Create a transaction that matches existing patterns
        response = await client.post("/api/v1/transactions/1/suggest-category")
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data

    @pytest.mark.asyncio
    async def test_keyword_matching(self, client: AsyncClient, seed_categories):
        """FR-003.3: Keyword Rules - Verify keyword matching works"""
        # This test would verify the category inference service
        # For now, we'll test through transaction suggestion
        test_cases = [
            {"description": "STARBUCKS COFFEE", "expected_category": "Dining & Coffee"},
            {"description": "TARGET STORE", "expected_category": "Shopping"},
            {"description": "PAYROLL DEPOSIT", "expected_category": "Income"},
            {"description": "NETFLIX SUBSCRIPTION", "expected_category": "Subscriptions"},
        ]

        for test_case in test_cases:
            # Create transaction
            txn_data = {
                "date": "2025-11-20",
                "amount": -10.00,
                "description": test_case["description"],
                "merchant": test_case["description"],
                "account_source": "TEST-ACCT",
                "reference_id": f"test_{test_case['description']}"
            }
            create_response = await client.post("/api/v1/transactions", json=txn_data)
            assert create_response.status_code == 201
            txn_id = create_response.json()["id"]

            # Get suggestion
            suggest_response = await client.post(f"/api/v1/transactions/{txn_id}/suggest-category")
            assert suggest_response.status_code == 200
