"""
Tests for FR-001: CSV Import
"""
import pytest
from httpx import AsyncClient
import io


class TestCSVImport:
    """FR-001: CSV Import"""

    @pytest.mark.asyncio
    async def test_preview_amex_csv(self, client: AsyncClient, seed_categories):
        """FR-001.4: Import Preview - AMEX format"""
        # Sample AMEX CSV content
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
11/05/2025,TARGET,JANE DOE,XXXXX-53012,-45.50,,,,,,,320251050001,Merchandise
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = await client.post("/api/v1/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()

        # FR-001.2: Format Detection
        assert data["detected_format"] == "amex_cc"

        # FR-001.4: Preview requirements
        assert "transactions" in data
        assert "transaction_count" in data
        assert "total_amount" in data

        # Verify transactions parsed correctly
        assert len(data["transactions"]) == 3
        assert data["transaction_count"] == 3

    @pytest.mark.asyncio
    async def test_preview_bofa_csv(self, client: AsyncClient, seed_categories):
        """FR-001.4: Import Preview - BOFA format"""
        csv_content = """Summary Bal.,$1234.56
Line 1
Line 2

Date,Description,Amount,Running Bal.
11/15/2025,AMAZON PAYMENT,-199.99,1034.57
11/10/2025,STARBUCKS PURCHASE,-12.50,1234.56
11/05/2025,PAYROLL DEPOSIT,3500.00,1247.06
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"account_source": "BOFA-1234"}

        response = await client.post(
            "/api/v1/import/preview",
            files=files,
            data=data_payload
        )

        assert response.status_code == 200
        data = response.json()

        # FR-001.2: Format Detection
        assert data["detected_format"] == "bofa_bank"

        # FR-001.3: BOFA requires account source
        assert "transactions" in data
        assert len(data["transactions"]) == 3

    @pytest.mark.asyncio
    async def test_preview_bofa_cc_csv(self, client: AsyncClient, seed_categories):
        """FR-001.4: Import Preview - BOFA Credit Card format"""
        csv_content = """Posted Date,Reference Number,Payee,Address,Amount
11/26/2025,74863985329012411622105,"Mantarraya Cafe Puntarenas,Co","",-85.78
11/25/2025,24138935328002638002967,"THE ROASTERY PUNTARENAS","",-70.18
11/21/2025,32583204320112100065939,"PAYMENT - THANK YOU","",3846.96
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"account_source": "BOFA-CC-1234"}

        response = await client.post(
            "/api/v1/import/preview",
            files=files,
            data=data_payload
        )

        assert response.status_code == 200
        data = response.json()

        # FR-001.2: Format Detection
        assert data["detected_format"] == "bofa_cc"

        # Verify transactions parsed correctly
        assert "transactions" in data
        assert len(data["transactions"]) == 3
        assert data["transaction_count"] == 3

        # Verify amounts (negative for charges, positive for payments)
        amounts = [t["amount"] for t in data["transactions"]]
        assert -85.78 in amounts
        assert 3846.96 in amounts  # Payment should be positive

    @pytest.mark.asyncio
    async def test_confirm_import(self, client: AsyncClient, seed_categories):
        """FR-001.4 & FR-001.5: Confirm import and duplicate detection"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        # First import
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"format_type": "amex_cc"}

        confirm_response = await client.post(
            "/api/v1/import/confirm",
            files=files,
            data=data_payload
        )
        assert confirm_response.status_code == 200
        confirm_data = confirm_response.json()

        assert confirm_data["imported"] == 2
        assert confirm_data["duplicates"] == 0

        # Second import (should detect duplicates)
        files2 = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload2 = {"format_type": "amex_cc"}

        confirm_response2 = await client.post(
            "/api/v1/import/confirm",
            files=files2,
            data=data_payload2
        )
        assert confirm_response2.status_code == 200
        confirm_data2 = confirm_response2.json()

        # FR-001.5: Duplicate Detection
        assert confirm_data2["duplicates"] == 2
        assert confirm_data2["imported"] == 0

    @pytest.mark.asyncio
    async def test_format_preferences(self, client: AsyncClient, seed_categories):
        """FR-001.6: Format Preferences - Save and retrieve"""
        # Get saved formats
        response = await client.get("/api/v1/import/formats")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_invalid_csv_format(self, client: AsyncClient):
        """FR-001.2: Handle unknown formats gracefully"""
        csv_content = """Invalid,CSV,Format
1,2,3
4,5,6
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = await client.post("/api/v1/import/preview", files=files)

        # Should handle gracefully, not crash
        assert response.status_code in [200, 400]

    @pytest.mark.asyncio
    async def test_category_mapping_from_amex(self, client: AsyncClient, seed_categories):
        """FR-001.3: Map AMEX category to simplified categories"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = await client.post("/api/v1/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()

        # Verify transactions have bucket tags assigned
        transactions = data["transactions"]
        # Category field now contains title-cased bucket value
        assert any(txn.get("category") or txn.get("bucket") for txn in transactions)
