"""
Tests for Advanced Visualization API endpoints
"""
import pytest
from httpx import AsyncClient


class TestSankeyFlow:
    """Tests for Sankey diagram data endpoint"""

    @pytest.mark.asyncio
    async def test_sankey_empty_month(self, client: AsyncClient):
        """Sankey returns empty for month with no transactions"""
        response = await client.get("/api/v1/reports/sankey-flow?year=2020&month=1")
        assert response.status_code == 200
        data = response.json()
        assert data["nodes"] == []
        assert data["links"] == []

    @pytest.mark.asyncio
    async def test_sankey_with_income(self, client: AsyncClient, seed_categories):
        """Sankey shows income flow to accounts"""
        # Create income transaction
        await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": 5000.00,
            "description": "Paycheck",
            "merchant": "Employer",
            "account_source": "CHECKING",
            "reference_id": "sankey_income_1"
        })

        response = await client.get("/api/v1/reports/sankey-flow?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Should have Income node and CHECKING account node
        node_names = [n["name"] for n in data["nodes"]]
        assert "Income" in node_names
        assert "CHECKING" in node_names

        # Should have link from Income to CHECKING
        assert len(data["links"]) >= 1
        assert any(l["value"] == 5000.0 for l in data["links"])

    @pytest.mark.asyncio
    async def test_sankey_with_expenses(self, client: AsyncClient, seed_categories):
        """Sankey shows expense flow from accounts to buckets"""
        # Create expense transaction
        txn_response = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -150.00,
            "description": "Grocery shopping",
            "merchant": "Costco",
            "account_source": "CREDIT_CARD",
            "reference_id": "sankey_expense_1"
        })
        txn_id = txn_response.json()["id"]

        # Tag with bucket
        await client.post(f"/api/v1/transactions/{txn_id}/tags", json={
            "tag": "bucket:groceries"
        })

        response = await client.get("/api/v1/reports/sankey-flow?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Should have account and bucket nodes
        node_names = [n["name"] for n in data["nodes"]]
        assert "CREDIT_CARD" in node_names
        assert "Groceries" in node_names

        # Should have link from account to bucket
        assert any(l["value"] == 150.0 for l in data["links"])

    @pytest.mark.asyncio
    async def test_sankey_excludes_transfers(self, client: AsyncClient, seed_categories):
        """Sankey excludes transfer transactions"""
        # Create transfer (should be excluded)
        await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -500.00,
            "description": "Transfer to savings",
            "merchant": "Internal Transfer",
            "account_source": "CHECKING",
            "reference_id": "sankey_transfer_1",
            "is_transfer": True
        })

        response = await client.get("/api/v1/reports/sankey-flow?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Transfer should not appear in links
        assert not any(l["value"] == 500.0 for l in data["links"])


class TestTreemap:
    """Tests for Treemap data endpoint"""

    @pytest.mark.asyncio
    async def test_treemap_empty_month(self, client: AsyncClient):
        """Treemap returns empty for month with no transactions"""
        response = await client.get("/api/v1/reports/treemap?year=2020&month=1")
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["children"] == []

    @pytest.mark.asyncio
    async def test_treemap_with_expenses(self, client: AsyncClient, seed_categories):
        """Treemap shows hierarchical spending data"""
        # Create expense transactions
        txn1 = await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -100.00,
            "description": "Groceries",
            "merchant": "Costco",
            "account_source": "CREDIT",
            "reference_id": "treemap_1"
        })
        txn2 = await client.post("/api/v1/transactions", json={
            "date": "2025-11-16",
            "amount": -50.00,
            "description": "More groceries",
            "merchant": "Trader Joes",
            "account_source": "CREDIT",
            "reference_id": "treemap_2"
        })

        # Tag both with groceries bucket
        await client.post(f"/api/v1/transactions/{txn1.json()['id']}/tags", json={
            "tag": "bucket:groceries"
        })
        await client.post(f"/api/v1/transactions/{txn2.json()['id']}/tags", json={
            "tag": "bucket:groceries"
        })

        response = await client.get("/api/v1/reports/treemap?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Should have groceries bucket
        buckets = data["data"]["children"]
        assert len(buckets) >= 1

        groceries_bucket = next((b for b in buckets if b["name"] == "Groceries"), None)
        assert groceries_bucket is not None
        assert groceries_bucket["value"] == 150.0

        # Should have both merchants as children
        merchant_names = [m["name"] for m in groceries_bucket["children"]]
        assert "Costco" in merchant_names
        assert "Trader Joes" in merchant_names

    @pytest.mark.asyncio
    async def test_treemap_excludes_income(self, client: AsyncClient, seed_categories):
        """Treemap only shows expenses, not income"""
        # Create income
        await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": 5000.00,
            "description": "Paycheck",
            "merchant": "Employer",
            "account_source": "CHECKING",
            "reference_id": "treemap_income_1"
        })

        response = await client.get("/api/v1/reports/treemap?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Income should not appear
        all_values = []
        for bucket in data["data"]["children"]:
            all_values.append(bucket["value"])
            for merchant in bucket.get("children", []):
                all_values.append(merchant["value"])

        assert 5000.0 not in all_values


class TestSpendingHeatmap:
    """Tests for spending heatmap endpoint"""

    @pytest.mark.asyncio
    async def test_heatmap_empty_month(self, client: AsyncClient):
        """Heatmap returns all days even with no transactions"""
        response = await client.get("/api/v1/reports/spending-heatmap?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # November has 30 days
        assert len(data["days"]) == 30

        # All should have zero spending
        for day in data["days"]:
            assert day["amount"] == 0
            assert day["intensity"] == 0

    @pytest.mark.asyncio
    async def test_heatmap_with_spending(self, client: AsyncClient, seed_categories):
        """Heatmap shows spending intensity by day"""
        # Create transactions on different days
        await client.post("/api/v1/transactions", json={
            "date": "2025-11-05",
            "amount": -100.00,
            "description": "Small purchase",
            "merchant": "Store A",
            "account_source": "CREDIT",
            "reference_id": "heatmap_1"
        })
        await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -500.00,
            "description": "Big purchase",
            "merchant": "Store B",
            "account_source": "CREDIT",
            "reference_id": "heatmap_2"
        })
        await client.post("/api/v1/transactions", json={
            "date": "2025-11-15",
            "amount": -200.00,
            "description": "Another purchase",
            "merchant": "Store C",
            "account_source": "CREDIT",
            "reference_id": "heatmap_3"
        })

        response = await client.get("/api/v1/reports/spending-heatmap?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Find specific days
        day5 = next(d for d in data["days"] if d["day"] == 5)
        day15 = next(d for d in data["days"] if d["day"] == 15)
        day20 = next(d for d in data["days"] if d["day"] == 20)

        assert day5["amount"] == 100.0
        assert day5["count"] == 1

        assert day15["amount"] == 700.0
        assert day15["count"] == 2

        assert day20["amount"] == 0
        assert day20["count"] == 0

        # Day 15 should have highest intensity
        assert day15["intensity"] >= day5["intensity"]

    @pytest.mark.asyncio
    async def test_heatmap_summary(self, client: AsyncClient, seed_categories):
        """Heatmap includes summary statistics"""
        await client.post("/api/v1/transactions", json={
            "date": "2025-11-10",
            "amount": -300.00,
            "description": "Purchase",
            "merchant": "Store",
            "account_source": "CREDIT",
            "reference_id": "heatmap_sum_1"
        })

        response = await client.get("/api/v1/reports/spending-heatmap?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        assert "summary" in data
        assert data["summary"]["total_spending"] == 300.0
        assert data["summary"]["max_daily"] == 300.0
        assert data["summary"]["days_with_spending"] == 1

    @pytest.mark.asyncio
    async def test_heatmap_weekday_info(self, client: AsyncClient, seed_categories):
        """Heatmap includes weekday information"""
        response = await client.get("/api/v1/reports/spending-heatmap?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Nov 1, 2025 is a Saturday (weekday=5)
        day1 = next(d for d in data["days"] if d["day"] == 1)
        assert day1["weekday"] == 5  # Saturday

        # Nov 3, 2025 is a Monday (weekday=0)
        day3 = next(d for d in data["days"] if d["day"] == 3)
        assert day3["weekday"] == 0  # Monday

    @pytest.mark.asyncio
    async def test_heatmap_excludes_transfers(self, client: AsyncClient, seed_categories):
        """Heatmap excludes transfer transactions"""
        await client.post("/api/v1/transactions", json={
            "date": "2025-11-10",
            "amount": -1000.00,
            "description": "Transfer",
            "merchant": "Internal",
            "account_source": "CHECKING",
            "reference_id": "heatmap_transfer_1",
            "is_transfer": True
        })

        response = await client.get("/api/v1/reports/spending-heatmap?year=2025&month=11")
        assert response.status_code == 200
        data = response.json()

        # Transfer should not appear
        day10 = next(d for d in data["days"] if d["day"] == 10)
        assert day10["amount"] == 0
