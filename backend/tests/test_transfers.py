"""
Tests for Transfer Detection functionality (v0.1)
"""
import pytest
from httpx import AsyncClient
from datetime import date


class TestTransferPatternDetection:
    """Tests for transfer pattern detection"""

    @pytest.mark.asyncio
    async def test_detect_autopay(self, client: AsyncClient):
        """Detect autopay as transfer"""
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -500.00,
            "description": "AUTOPAY CREDIT CARD",
            "merchant": "Bank Payment",
            "account_source": "TEST",
            "reference_id": "test_autopay_1"
        })

        response = await client.get("/api/v1/transfers/suggestions")
        assert response.status_code == 200
        data = response.json()

        suggestions = [s for s in data["suggestions"] if "AUTOPAY" in s["description"]]
        assert len(suggestions) >= 1
        assert "autopay" in suggestions[0]["match_reason"].lower()

    @pytest.mark.asyncio
    async def test_detect_online_payment(self, client: AsyncClient):
        """Detect online payment as transfer"""
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -200.00,
            "description": "ONLINE PAYMENT THANK YOU",
            "merchant": "Credit Card",
            "account_source": "TEST",
            "reference_id": "test_online_1"
        })

        response = await client.get("/api/v1/transfers/suggestions")
        data = response.json()

        suggestions = [s for s in data["suggestions"] if "ONLINE PAYMENT" in s["description"]]
        assert len(suggestions) >= 1

    @pytest.mark.asyncio
    async def test_detect_bank_transfer(self, client: AsyncClient):
        """Detect bank transfer"""
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -1000.00,
            "description": "BANK TRANSFER TO SAVINGS",
            "merchant": "Internal",
            "account_source": "TEST",
            "reference_id": "test_bank_transfer_1"
        })

        response = await client.get("/api/v1/transfers/suggestions")
        data = response.json()

        suggestions = [s for s in data["suggestions"] if "BANK TRANSFER" in s["description"]]
        assert len(suggestions) >= 1

    @pytest.mark.asyncio
    async def test_detect_paypal_transfer(self, client: AsyncClient):
        """Detect PayPal transfer patterns"""
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -50.00,
            "description": "PAYPAL INSTANT TRANSFER",
            "merchant": "PayPal",
            "account_source": "TEST",
            "reference_id": "test_paypal_1"
        })

        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -75.00,
            "description": "PAYPAL TRANSFER TO BANK",
            "merchant": "PayPal",
            "account_source": "TEST",
            "reference_id": "test_paypal_2"
        })

        response = await client.get("/api/v1/transfers/suggestions")
        data = response.json()

        paypal_suggestions = [s for s in data["suggestions"] if "PAYPAL" in s["description"]]
        assert len(paypal_suggestions) >= 2

    @pytest.mark.asyncio
    async def test_detect_ach_payment(self, client: AsyncClient):
        """Detect ACH payment as transfer"""
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -300.00,
            "description": "ACH PAYMENT TO VENDOR",
            "merchant": "ACH",
            "account_source": "TEST",
            "reference_id": "test_ach_1"
        })

        response = await client.get("/api/v1/transfers/suggestions")
        data = response.json()

        suggestions = [s for s in data["suggestions"] if "ACH" in s["description"]]
        assert len(suggestions) >= 1

    @pytest.mark.asyncio
    async def test_non_transfer_not_suggested(self, client: AsyncClient):
        """Normal transactions should not be suggested as transfers"""
        await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -25.00,
            "description": "STARBUCKS COFFEE",
            "merchant": "Starbucks",
            "account_source": "TEST",
            "reference_id": "test_normal_1"
        })

        response = await client.get("/api/v1/transfers/suggestions")
        data = response.json()

        starbucks = [s for s in data["suggestions"] if "STARBUCKS" in s["description"]]
        assert len(starbucks) == 0


class TestTransferMarking:
    """Tests for marking transactions as transfers"""

    @pytest.mark.asyncio
    async def test_mark_as_transfer(self, client: AsyncClient):
        """Mark transactions as transfers"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -100.00,
            "description": "Test transaction",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_mark_1"
        })
        txn_id = txn_response.json()["id"]

        response = await client.post("/api/v1/transfers/mark", json={
            "transaction_ids": [txn_id],
            "is_transfer": True
        })
        assert response.status_code == 200
        data = response.json()

        assert data["updated_count"] == 1
        assert data["is_transfer"] is True

        # Verify transaction was updated
        txn = await client.get(f"/api/v1/transactions/{txn_id}")
        assert txn.json()["is_transfer"] is True

    @pytest.mark.asyncio
    async def test_unmark_transfer(self, client: AsyncClient):
        """Unmark transactions as transfers"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -100.00,
            "description": "Test transaction",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_unmark_1"
        })
        txn_id = txn_response.json()["id"]

        # Mark as transfer
        await client.post("/api/v1/transfers/mark", json={
            "transaction_ids": [txn_id],
            "is_transfer": True
        })

        # Unmark
        response = await client.post("/api/v1/transfers/mark", json={
            "transaction_ids": [txn_id],
            "is_transfer": False
        })
        assert response.status_code == 200
        assert response.json()["is_transfer"] is False

        # Verify
        txn = await client.get(f"/api/v1/transactions/{txn_id}")
        assert txn.json()["is_transfer"] is False

    @pytest.mark.asyncio
    async def test_mark_multiple_transactions(self, client: AsyncClient):
        """Mark multiple transactions as transfers"""
        ids = []
        for i in range(3):
            txn_response = await client.post("/api/v1/transactions", json={
                "date": date.today().isoformat(),
                "amount": -50.00,
                "description": f"Bulk test {i}",
                "merchant": "Test",
                "account_source": "TEST",
                "reference_id": f"test_bulk_{i}"
            })
            ids.append(txn_response.json()["id"])

        response = await client.post("/api/v1/transfers/mark", json={
            "transaction_ids": ids,
            "is_transfer": True
        })
        assert response.status_code == 200
        assert response.json()["updated_count"] == 3

    @pytest.mark.asyncio
    async def test_mark_nonexistent_transaction(self, client: AsyncClient):
        """Marking nonexistent transaction should fail"""
        response = await client.post("/api/v1/transfers/mark", json={
            "transaction_ids": [99999],
            "is_transfer": True
        })
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_mark_empty_list(self, client: AsyncClient):
        """Marking empty list should fail"""
        response = await client.post("/api/v1/transfers/mark", json={
            "transaction_ids": [],
            "is_transfer": True
        })
        assert response.status_code == 400


class TestTransferLinking:
    """Tests for linking transfer pairs"""

    @pytest.mark.asyncio
    async def test_link_transactions(self, client: AsyncClient):
        """Link two transactions as transfer pair"""
        # Create two transactions
        txn1_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -500.00,
            "description": "Payment to credit card",
            "merchant": "Credit Card",
            "account_source": "CHECKING",
            "reference_id": "test_link_1"
        })
        txn1_id = txn1_response.json()["id"]

        txn2_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": 500.00,
            "description": "Payment received",
            "merchant": "Payment",
            "account_source": "CREDIT",
            "reference_id": "test_link_2"
        })
        txn2_id = txn2_response.json()["id"]

        # Link them
        response = await client.post(f"/api/v1/transfers/{txn1_id}/link", json={
            "linked_transaction_id": txn2_id
        })
        assert response.status_code == 200
        data = response.json()

        assert data["transaction_id"] == txn1_id
        assert data["linked_transaction_id"] == txn2_id

        # Verify both are marked as transfers and linked
        txn1 = await client.get(f"/api/v1/transactions/{txn1_id}")
        txn2 = await client.get(f"/api/v1/transactions/{txn2_id}")

        assert txn1.json()["is_transfer"] is True
        assert txn2.json()["is_transfer"] is True
        assert txn1.json()["linked_transaction_id"] == txn2_id
        assert txn2.json()["linked_transaction_id"] == txn1_id

    @pytest.mark.asyncio
    async def test_unlink_transactions(self, client: AsyncClient):
        """Unlink a transfer pair"""
        # Create and link two transactions
        txn1_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -300.00,
            "description": "Transfer out",
            "merchant": "Transfer",
            "account_source": "TEST",
            "reference_id": "test_unlink_1"
        })
        txn1_id = txn1_response.json()["id"]

        txn2_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": 300.00,
            "description": "Transfer in",
            "merchant": "Transfer",
            "account_source": "TEST2",
            "reference_id": "test_unlink_2"
        })
        txn2_id = txn2_response.json()["id"]

        await client.post(f"/api/v1/transfers/{txn1_id}/link", json={
            "linked_transaction_id": txn2_id
        })

        # Unlink
        response = await client.delete(f"/api/v1/transfers/{txn1_id}/link")
        assert response.status_code == 200
        data = response.json()

        assert data["previously_linked_to"] == txn2_id

        # Verify both are unlinked (but still marked as transfers)
        txn1 = await client.get(f"/api/v1/transactions/{txn1_id}")
        txn2 = await client.get(f"/api/v1/transactions/{txn2_id}")

        assert txn1.json()["linked_transaction_id"] is None
        assert txn2.json()["linked_transaction_id"] is None
        # Note: is_transfer remains True

    @pytest.mark.asyncio
    async def test_unlink_not_linked(self, client: AsyncClient):
        """Unlinking an unlinked transaction should fail"""
        txn_response = await client.post("/api/v1/transactions", json={
            "date": date.today().isoformat(),
            "amount": -100.00,
            "description": "Not linked",
            "merchant": "Test",
            "account_source": "TEST",
            "reference_id": "test_not_linked"
        })
        txn_id = txn_response.json()["id"]

        response = await client.delete(f"/api/v1/transfers/{txn_id}/link")
        assert response.status_code == 400


class TestTransferStats:
    """Tests for transfer statistics"""

    @pytest.mark.asyncio
    async def test_transfer_stats(self, client: AsyncClient):
        """Get transfer statistics"""
        # Create some transfers
        for i in range(3):
            txn_response = await client.post("/api/v1/transactions", json={
                "date": date.today().isoformat(),
                "amount": -100.00 * (i + 1),
                "description": f"Transfer {i}",
                "merchant": "Transfer",
                "account_source": "TEST",
                "reference_id": f"test_stats_{i}"
            })
            txn_id = txn_response.json()["id"]
            await client.post("/api/v1/transfers/mark", json={
                "transaction_ids": [txn_id],
                "is_transfer": True
            })

        response = await client.get("/api/v1/transfers/stats")
        assert response.status_code == 200
        data = response.json()

        assert "transfer_count" in data
        assert "transfer_total" in data
        assert "linked_pairs" in data
        assert data["transfer_count"] >= 3
        assert data["transfer_total"] >= 600.0  # 100 + 200 + 300
