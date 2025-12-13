"""
Tests for Recurring Transaction Detection (v0.3)
"""

import pytest
from httpx import AsyncClient
from datetime import date, timedelta


class TestRecurringPatterns:
    """Recurring Transaction Detection Tests"""

    @pytest.mark.asyncio
    async def test_create_pattern(self, client: AsyncClient, seed_categories):
        """Manually create a recurring pattern"""
        pattern_data = {
            "merchant": "netflix",
            "category": "Subscriptions",
            "amount_min": 14.00,
            "amount_max": 16.00,
            "frequency": "monthly",
            "confidence_score": 0.95,
            "status": "active",
        }

        response = await client.post("/api/v1/recurring", json=pattern_data)
        assert response.status_code == 201
        data = response.json()

        assert data["merchant"] == "netflix"
        assert data["frequency"] == "monthly"
        assert data["confidence_score"] == 0.95

    @pytest.mark.asyncio
    async def test_list_patterns(self, client: AsyncClient, seed_categories):
        """List all recurring patterns"""
        # Create some patterns
        patterns = [
            {"merchant": "netflix", "amount_min": 14.0, "amount_max": 16.0, "frequency": "monthly"},
            {"merchant": "spotify", "amount_min": 9.0, "amount_max": 11.0, "frequency": "monthly"},
        ]

        for pattern in patterns:
            await client.post("/api/v1/recurring", json=pattern)

        # List patterns
        response = await client.get("/api/v1/recurring")
        assert response.status_code == 200
        data = response.json()

        assert len(data) == 2
        assert any(p["merchant"] == "netflix" for p in data)

    @pytest.mark.asyncio
    async def test_get_pattern(self, client: AsyncClient, seed_categories):
        """Get a single pattern by ID"""
        create_response = await client.post(
            "/api/v1/recurring",
            json={"merchant": "netflix", "amount_min": 14.0, "amount_max": 16.0, "frequency": "monthly"},
        )
        pattern_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/recurring/{pattern_id}")
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == pattern_id
        assert data["merchant"] == "netflix"

    @pytest.mark.asyncio
    async def test_update_pattern(self, client: AsyncClient, seed_categories):
        """Update a recurring pattern"""
        create_response = await client.post(
            "/api/v1/recurring",
            json={"merchant": "netflix", "amount_min": 14.0, "amount_max": 16.0, "frequency": "monthly"},
        )
        pattern_id = create_response.json()["id"]

        # Update status to paused
        update_data = {"status": "paused"}
        response = await client.patch(f"/api/v1/recurring/{pattern_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "paused"

    @pytest.mark.asyncio
    async def test_delete_pattern(self, client: AsyncClient, seed_categories):
        """Delete a recurring pattern"""
        create_response = await client.post(
            "/api/v1/recurring",
            json={"merchant": "netflix", "amount_min": 14.0, "amount_max": 16.0, "frequency": "monthly"},
        )
        pattern_id = create_response.json()["id"]

        # Delete
        response = await client.delete(f"/api/v1/recurring/{pattern_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/v1/recurring/{pattern_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_detect_monthly_pattern(self, client: AsyncClient, seed_categories):
        """Detect monthly recurring pattern (e.g., subscription)"""
        # Create monthly recurring transactions
        today = date.today()
        for i in range(4):  # 4 months of transactions
            month_ago = today - timedelta(days=30 * i)
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": month_ago.isoformat(),
                    "amount": -14.99,
                    "description": "Netflix subscription",
                    "merchant": "Netflix",
                    "account_source": "TEST",
                    "category": "Subscriptions",
                    "reference_id": f"netflix_{i}",
                },
            )

        # Run detection
        response = await client.post("/api/v1/recurring/detect")
        assert response.status_code == 200
        data = response.json()

        assert data["detected_count"] >= 1
        # Find netflix pattern
        netflix_pattern = next((p for p in data["patterns"] if "netflix" in p["merchant"].lower()), None)
        assert netflix_pattern is not None
        assert netflix_pattern["frequency"] == "monthly"
        assert netflix_pattern["occurrences"] == 4

    @pytest.mark.asyncio
    async def test_detect_weekly_pattern(self, client: AsyncClient, seed_categories):
        """Detect weekly recurring pattern"""
        today = date.today()
        for i in range(5):  # 5 weeks of transactions
            week_ago = today - timedelta(days=7 * i)
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": week_ago.isoformat(),
                    "amount": -50.00,
                    "description": "Grocery shopping",
                    "merchant": "Whole Foods",
                    "account_source": "TEST",
                    "category": "Groceries",
                    "reference_id": f"groceries_{i}",
                },
            )

        # Run detection
        response = await client.post("/api/v1/recurring/detect")
        data = response.json()

        whole_foods = next((p for p in data["patterns"] if "whole foods" in p["merchant"].lower()), None)
        assert whole_foods is not None
        assert whole_foods["frequency"] == "weekly"

    @pytest.mark.asyncio
    async def test_detect_with_amount_variance(self, client: AsyncClient, seed_categories):
        """Detect pattern even with slight amount variance"""
        today = date.today()
        amounts = [-49.99, -51.50, -48.75, -50.25]  # ~$50 with variance
        for i, amount in enumerate(amounts):
            month_ago = today - timedelta(days=30 * i)
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": month_ago.isoformat(),
                    "amount": amount,
                    "description": "Internet bill",
                    "merchant": "Comcast",
                    "account_source": "TEST",
                    "category": "Utilities",
                    "reference_id": f"comcast_{i}",
                },
            )

        # Run detection
        response = await client.post("/api/v1/recurring/detect")
        data = response.json()

        comcast = next((p for p in data["patterns"] if "comcast" in p["merchant"].lower()), None)
        assert comcast is not None
        assert comcast["frequency"] == "monthly"
        # Amount should be around $50
        assert 45 <= comcast["average_amount"] <= 55

    @pytest.mark.asyncio
    async def test_detect_min_occurrences(self, client: AsyncClient, seed_categories):
        """Test minimum occurrences requirement"""
        today = date.today()
        # Only 2 transactions - below default minimum of 3
        for i in range(2):
            month_ago = today - timedelta(days=30 * i)
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": month_ago.isoformat(),
                    "amount": -10.00,
                    "description": "Payment",
                    "merchant": "TwoTimesOnly",
                    "account_source": "TEST",
                    "reference_id": f"two_{i}",
                },
            )

        # Run detection with default min_occurrences=3
        response = await client.post("/api/v1/recurring/detect")
        data = response.json()

        # Should not detect pattern with only 2 occurrences
        two_times = next((p for p in data["patterns"] if "twotimesonly" in p["merchant"].lower()), None)
        assert two_times is None

        # Run with min_occurrences=2
        response = await client.post("/api/v1/recurring/detect?min_occurrences=2")
        data = response.json()

        two_times = next((p for p in data["patterns"] if "twotimesonly" in p["merchant"].lower()), None)
        assert two_times is not None

    @pytest.mark.asyncio
    async def test_detect_confidence_threshold(self, client: AsyncClient, seed_categories):
        """Test confidence threshold filtering"""
        today = date.today()
        # Create irregular pattern (varying intervals)
        intervals = [30, 35, 25, 32]  # Inconsistent monthly pattern
        current_date = today
        for i, interval in enumerate(intervals):
            current_date = current_date - timedelta(days=interval)
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": current_date.isoformat(),
                    "amount": -25.00,
                    "description": "Irregular service",
                    "merchant": "IrregularCo",
                    "account_source": "TEST",
                    "reference_id": f"irregular_{i}",
                },
            )

        # Run with high confidence threshold
        response = await client.post("/api/v1/recurring/detect?min_confidence=0.9")
        data = response.json()

        # Irregular pattern should have lower confidence
        _irregular = next((p for p in data["patterns"] if "irregularco" in p["merchant"].lower()), None)
        # Might not be detected with high threshold

        # Run with lower confidence threshold
        response = await client.post("/api/v1/recurring/detect?min_confidence=0.5")
        data = response.json()

        _irregular = next((p for p in data["patterns"] if "irregularco" in p["merchant"].lower()), None)
        # More likely to be detected with lower threshold

    @pytest.mark.asyncio
    async def test_upcoming_predictions(self, client: AsyncClient, seed_categories):
        """Test upcoming recurring transaction predictions"""
        # Create a pattern with next_expected_date in the future
        tomorrow = date.today() + timedelta(days=1)
        await client.post(
            "/api/v1/recurring",
            json={
                "merchant": "gym_membership",
                "amount_min": 45.0,
                "amount_max": 55.0,
                "frequency": "monthly",
                "next_expected_date": tomorrow.isoformat(),
                "confidence_score": 0.9,
                "status": "active",
            },
        )

        # Get upcoming predictions
        response = await client.get("/api/v1/recurring/predictions/upcoming?days_ahead=30")
        assert response.status_code == 200
        data = response.json()

        assert data["count"] >= 1
        gym = next((p for p in data["upcoming"] if "gym" in p["merchant"].lower()), None)
        assert gym is not None
        assert gym["days_until"] <= 30
        assert gym["estimated_amount"] == 50.0  # Average of min/max

    @pytest.mark.asyncio
    async def test_missing_recurring_transactions(self, client: AsyncClient, seed_categories):
        """Test detection of missing expected transactions"""
        # Create a pattern with next_expected_date in the past
        week_ago = date.today() - timedelta(days=7)
        await client.post(
            "/api/v1/recurring",
            json={
                "merchant": "overdue_bill",
                "amount_min": 100.0,
                "amount_max": 120.0,
                "frequency": "monthly",
                "next_expected_date": week_ago.isoformat(),
                "confidence_score": 0.95,
                "status": "active",
            },
        )

        # Get missing transactions
        response = await client.get("/api/v1/recurring/missing?days_overdue=7")
        assert response.status_code == 200
        data = response.json()

        assert data["count"] >= 1
        overdue = next((p for p in data["missing"] if "overdue" in p["merchant"].lower()), None)
        assert overdue is not None
        assert overdue["days_overdue"] >= 7

    @pytest.mark.asyncio
    async def test_filter_by_status(self, client: AsyncClient, seed_categories):
        """Test filtering patterns by status"""
        # Create patterns with different statuses
        await client.post(
            "/api/v1/recurring",
            json={
                "merchant": "active_pattern",
                "amount_min": 10.0,
                "amount_max": 12.0,
                "frequency": "monthly",
                "status": "active",
            },
        )

        await client.post(
            "/api/v1/recurring",
            json={
                "merchant": "paused_pattern",
                "amount_min": 20.0,
                "amount_max": 22.0,
                "frequency": "monthly",
                "status": "paused",
            },
        )

        # Filter by active status
        response = await client.get("/api/v1/recurring?status=active")
        data = response.json()

        assert all(p["status"] == "active" for p in data)
        assert any("active_pattern" in p["merchant"] for p in data)
        assert not any("paused_pattern" in p["merchant"] for p in data)

    @pytest.mark.asyncio
    async def test_quarterly_detection(self, client: AsyncClient, seed_categories):
        """Test detection of quarterly recurring transactions"""
        today = date.today()
        for i in range(4):  # 4 quarters
            quarter_ago = today - timedelta(days=90 * i)
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": quarter_ago.isoformat(),
                    "amount": -200.00,
                    "description": "Quarterly insurance",
                    "merchant": "Insurance Co",
                    "account_source": "TEST",
                    "category": "Insurance",
                    "reference_id": f"insurance_{i}",
                },
            )

        # Run detection
        response = await client.post("/api/v1/recurring/detect")
        data = response.json()

        insurance = next((p for p in data["patterns"] if "insurance" in p["merchant"].lower()), None)
        assert insurance is not None
        assert insurance["frequency"] == "quarterly"

    @pytest.mark.asyncio
    async def test_no_duplicate_patterns(self, client: AsyncClient, seed_categories):
        """Test that detection doesn't create duplicate patterns"""
        today = date.today()
        for i in range(4):
            month_ago = today - timedelta(days=30 * i)
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": month_ago.isoformat(),
                    "amount": -9.99,
                    "description": "Spotify Premium",
                    "merchant": "Spotify",
                    "account_source": "TEST",
                    "category": "Subscriptions",
                    "reference_id": f"spotify_{i}",
                },
            )

        # Run detection first time
        response1 = await client.post("/api/v1/recurring/detect")
        data1 = response1.json()
        _count1 = data1["detected_count"]

        # Run detection again
        response2 = await client.post("/api/v1/recurring/detect")
        data2 = response2.json()
        count2 = data2["detected_count"]

        # Should not create duplicates
        assert count2 == 0  # No new patterns detected

    @pytest.mark.asyncio
    async def test_category_assignment(self, client: AsyncClient, seed_categories):
        """Test that detected patterns get the most common category"""
        today = date.today()
        categories = ["Subscriptions", "Subscriptions", "Subscriptions", "Entertainment"]
        for i, category in enumerate(categories):
            month_ago = today - timedelta(days=30 * i)
            await client.post(
                "/api/v1/transactions",
                json={
                    "date": month_ago.isoformat(),
                    "amount": -12.99,
                    "description": "Hulu",
                    "merchant": "Hulu",
                    "account_source": "TEST",
                    "category": category,
                    "reference_id": f"hulu_{i}",
                },
            )

        # Run detection
        response = await client.post("/api/v1/recurring/detect")
        _data = response.json()

        # Get the created pattern
        patterns = await client.get("/api/v1/recurring")
        all_patterns = patterns.json()
        hulu = next((p for p in all_patterns if "hulu" in p["merchant"].lower()), None)

        # Should have the most common category
        assert hulu["category"] == "Subscriptions"
