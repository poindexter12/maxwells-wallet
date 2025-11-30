"""
Tests for Batch Import Feature
"""
import pytest
from httpx import AsyncClient
import io


class TestBatchImport:
    """Tests for batch import functionality"""

    @pytest.mark.asyncio
    async def test_batch_upload_preview(self, client: AsyncClient, seed_categories):
        """Test batch upload endpoint with multiple files"""
        # Sample AMEX CSV content
        amex_csv = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        # Sample BOFA CSV content
        bofa_csv = """Summary Bal.,$1234.56

Date,Description,Amount,Running Bal.
11/15/2025,AMAZON PAYMENT,-199.99,1034.57
11/10/2025,STARBUCKS PURCHASE,-12.50,1234.56
"""

        files = [
            ("files", ("amex.csv", io.BytesIO(amex_csv.encode()), "text/csv")),
            ("files", ("bofa.csv", io.BytesIO(bofa_csv.encode()), "text/csv")),
        ]

        response = await client.post("/api/v1/import/batch/upload", files=files)

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "files" in data
        assert "total_files" in data
        assert "total_transactions" in data
        assert "total_duplicates" in data

        assert data["total_files"] == 2
        assert len(data["files"]) == 2

        # Check each file preview
        for file_preview in data["files"]:
            assert "filename" in file_preview
            assert "detected_format" in file_preview
            assert "transaction_count" in file_preview
            assert "duplicate_count" in file_preview
            assert "cross_file_duplicate_count" in file_preview
            assert "total_amount" in file_preview

    @pytest.mark.asyncio
    async def test_batch_cross_file_duplicate_detection(self, client: AsyncClient, seed_categories):
        """Test cross-file duplicate detection in batch import"""
        # Two files with the same transaction
        csv1 = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
"""

        csv2 = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        files = [
            ("files", ("file1.csv", io.BytesIO(csv1.encode()), "text/csv")),
            ("files", ("file2.csv", io.BytesIO(csv2.encode()), "text/csv")),
        ]

        response = await client.post("/api/v1/import/batch/upload", files=files)

        assert response.status_code == 200
        data = response.json()

        # Second file should have 1 cross-file duplicate
        file2_preview = next(f for f in data["files"] if f["filename"] == "file2.csv")
        assert file2_preview["cross_file_duplicate_count"] == 1

    @pytest.mark.asyncio
    async def test_batch_confirm_import(self, client: AsyncClient, seed_categories):
        """Test batch confirm endpoint imports selected files"""
        csv1 = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
"""

        csv2 = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        files = [
            ("files", ("file1.csv", io.BytesIO(csv1.encode()), "text/csv")),
            ("files", ("file2.csv", io.BytesIO(csv2.encode()), "text/csv")),
        ]

        # Build request JSON
        request_json = {
            "files": [
                {
                    "filename": "file1.csv",
                    "account_source": None,
                    "format_type": "amex_cc"
                },
                {
                    "filename": "file2.csv",
                    "account_source": None,
                    "format_type": "amex_cc"
                }
            ],
            "save_format": False
        }

        # Send as multipart form data with JSON in a field
        import json
        form_data = [
            ("files", ("file1.csv", io.BytesIO(csv1.encode()), "text/csv")),
            ("files", ("file2.csv", io.BytesIO(csv2.encode()), "text/csv")),
            ("request", (None, json.dumps(request_json), "application/json"))
        ]

        response = await client.post("/api/v1/import/batch/confirm", files=form_data)

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "batch_id" in data
        assert "total_imported" in data
        assert "total_duplicates" in data
        assert "files" in data

        assert data["total_imported"] == 2
        assert len(data["files"]) == 2

    @pytest.mark.asyncio
    async def test_batch_partial_selection(self, client: AsyncClient, seed_categories):
        """Test batch import with only some files selected"""
        csv1 = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
"""

        csv2 = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        # Only import file1
        import json
        request_json = {
            "files": [
                {
                    "filename": "file1.csv",
                    "account_source": None,
                    "format_type": "amex_cc"
                }
            ],
            "save_format": False
        }

        form_data = [
            ("files", ("file1.csv", io.BytesIO(csv1.encode()), "text/csv")),
            ("request", (None, json.dumps(request_json), "application/json"))
        ]

        response = await client.post("/api/v1/import/batch/confirm", files=form_data)

        assert response.status_code == 200
        data = response.json()

        # Only 1 transaction should be imported
        assert data["total_imported"] == 1
        assert len(data["files"]) == 1

    @pytest.mark.asyncio
    async def test_batch_mixed_formats(self, client: AsyncClient, seed_categories):
        """Test batch import with mixed file formats"""
        amex_csv = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
"""

        bofa_csv = """Summary Bal.,$1234.56

Date,Description,Amount,Running Bal.
11/10/2025,STARBUCKS PURCHASE,-12.50,1234.56
"""

        files = [
            ("files", ("amex.csv", io.BytesIO(amex_csv.encode()), "text/csv")),
            ("files", ("bofa.csv", io.BytesIO(bofa_csv.encode()), "text/csv")),
        ]

        response = await client.post("/api/v1/import/batch/upload", files=files)

        assert response.status_code == 200
        data = response.json()

        # Check that different formats were detected
        formats = [f["detected_format"] for f in data["files"]]
        assert "amex_cc" in formats
        assert "bofa_bank" in formats

    @pytest.mark.asyncio
    async def test_batch_duplicate_against_db(self, client: AsyncClient, seed_categories):
        """Test batch import duplicate detection against existing DB transactions"""
        # First, import a transaction
        csv_initial = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
"""

        files_initial = {"file": ("initial.csv", io.BytesIO(csv_initial.encode()), "text/csv")}
        data_payload = {"format_type": "amex_cc"}

        await client.post("/api/v1/import/confirm", files=files_initial, data=data_payload)

        # Now try batch import with the same transaction
        csv_batch = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        files_batch = [
            ("files", ("batch.csv", io.BytesIO(csv_batch.encode()), "text/csv")),
        ]

        response = await client.post("/api/v1/import/batch/upload", files=files_batch)

        assert response.status_code == 200
        data = response.json()

        # First transaction should be detected as duplicate against DB
        file_preview = data["files"][0]
        assert file_preview["duplicate_count"] == 1
