"""
Tests for Custom CSV Parser - User-defined column mappings for any CSV format.

Tests cover:
- CustomCsvConfig serialization/deserialization
- CustomCsvParser with named columns
- CustomCsvParser with index-based columns
- Row handling (skip headers/footers, patterns)
- Auto-detection helpers (date formats, amount formats)
- API endpoints for custom format management
"""
import pytest
import json
from datetime import date
from httpx import AsyncClient

from app.parsers import (
    CustomCsvParser,
    CustomCsvConfig,
    RowHandling,
    analyze_csv_columns,
    detect_date_format,
    detect_amount_format,
    compute_header_signature,
    compute_signature_from_csv,
)


# =============================================================================
# Test Data
# =============================================================================

SIMPLE_CSV = """Date,Amount,Description,Merchant
01/15/2025,-50.00,AMAZON PURCHASE,Amazon
01/16/2025,-25.50,GROCERY STORE,Safeway
01/17/2025,100.00,PAYROLL DEPOSIT,Employer
"""

CSV_WITH_HEADERS = """Account Statement
Generated: 2025-01-17

Date,Amount,Description,Category
01/15/2025,-50.00,AMAZON PURCHASE,Shopping
01/16/2025,-25.50,GROCERY STORE,Groceries
"""

CSV_PARENTHESES_AMOUNTS = """Transaction Date,Description,Debit,Credit
01/15/2025,AMAZON PURCHASE,($50.00),
01/16/2025,GROCERY STORE,($25.50),
01/17/2025,PAYROLL DEPOSIT,,$100.00
"""

CSV_PLUS_MINUS_AMOUNTS = """Date,Memo,Amount
01/15/2025,Coffee Shop,- $5.00
01/16/2025,Direct Deposit,+ $1000.00
01/17/2025,Gas Station,- $45.50
"""

CSV_ISO_DATES = """date,amount,description
2025-01-15,-50.00,Amazon Purchase
2025-01-16,-25.50,Grocery Store
"""

CSV_NO_HEADER = """01/15/2025,-50.00,AMAZON PURCHASE,Shopping
01/16/2025,-25.50,GROCERY STORE,Groceries
01/17/2025,100.00,PAYROLL DEPOSIT,Income
"""


# =============================================================================
# CustomCsvConfig Tests
# =============================================================================

class TestCustomCsvConfig:
    """Test CustomCsvConfig dataclass"""

    def test_basic_config(self):
        """Create a basic config"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Date",
            amount_column="Amount",
            description_column="Description",
        )
        assert config.name == "Test Bank"
        assert config.account_source == "TEST-CHECKING"
        assert config.date_format == "%m/%d/%Y"  # default
        assert config.amount_sign_convention == "negative_prefix"  # default

    def test_config_to_json(self):
        """Serialize config to JSON"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Date",
            amount_column="Amount",
            description_column="Description",
            date_format="%Y-%m-%d",
        )
        json_str = config.to_json()
        data = json.loads(json_str)

        assert data["name"] == "Test Bank"
        assert data["account_source"] == "TEST-CHECKING"
        assert data["date_column"] == "Date"
        assert data["date_format"] == "%Y-%m-%d"

    def test_config_from_json(self):
        """Deserialize config from JSON"""
        json_str = json.dumps({
            "name": "Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
            "amount_invert_sign": True,
            "row_handling": {
                "skip_header_rows": 2,
                "skip_patterns": ["PENDING"],
            }
        })
        config = CustomCsvConfig.from_json(json_str)

        assert config.name == "Test Bank"
        assert config.amount_invert_sign is True
        assert config.row_handling.skip_header_rows == 2
        assert "PENDING" in config.row_handling.skip_patterns

    def test_config_roundtrip(self):
        """Config survives JSON roundtrip"""
        original = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Date",
            amount_column="Amount",
            description_column="Description",
            merchant_column="Merchant",
            date_format="%Y-%m-%d",
            amount_sign_convention="parentheses",
            amount_currency_prefix="$",
            row_handling=RowHandling(
                skip_header_rows=3,
                skip_footer_rows=1,
                skip_patterns=["BALANCE", "TOTAL"],
            ),
        )

        json_str = original.to_json()
        restored = CustomCsvConfig.from_json(json_str)

        assert restored.name == original.name
        assert restored.date_format == original.date_format
        assert restored.amount_sign_convention == original.amount_sign_convention
        assert restored.row_handling.skip_header_rows == 3
        assert restored.row_handling.skip_footer_rows == 1
        assert len(restored.row_handling.skip_patterns) == 2


# =============================================================================
# CustomCsvParser Tests - Named Columns
# =============================================================================

class TestCustomCsvParserNamedColumns:
    """Test CustomCsvParser with column names"""

    def test_parse_simple_csv(self):
        """Parse simple CSV with named columns"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Date",
            amount_column="Amount",
            description_column="Description",
            merchant_column="Merchant",
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(SIMPLE_CSV)

        assert len(transactions) == 3

        # First transaction
        assert transactions[0].date == date(2025, 1, 15)
        assert transactions[0].amount == -50.00
        assert transactions[0].description == "AMAZON PURCHASE"
        assert transactions[0].merchant == "Amazon"
        assert transactions[0].account_source == "TEST-CHECKING"

        # Third transaction (income)
        assert transactions[2].amount == 100.00

    def test_parse_with_skip_header_rows(self):
        """Parse CSV with metadata rows before header"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Date",
            amount_column="Amount",
            description_column="Description",
            row_handling=RowHandling(skip_header_rows=3),  # Skip 3 rows before header
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(CSV_WITH_HEADERS)

        assert len(transactions) == 2
        assert transactions[0].date == date(2025, 1, 15)
        assert transactions[0].amount == -50.00

    def test_parse_iso_dates(self):
        """Parse CSV with ISO date format"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="date",
            amount_column="amount",
            description_column="description",
            date_format="iso",
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(CSV_ISO_DATES)

        assert len(transactions) == 2
        assert transactions[0].date == date(2025, 1, 15)
        assert transactions[1].date == date(2025, 1, 16)

    def test_parse_parentheses_amounts(self):
        """Parse CSV with parentheses for negative amounts"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Transaction Date",
            amount_column="Debit",
            description_column="Description",
            amount_sign_convention="parentheses",
            amount_currency_prefix="$",
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(CSV_PARENTHESES_AMOUNTS)

        # Should only get the debit transactions (credit column is empty)
        assert len(transactions) == 2
        assert transactions[0].amount == -50.00
        assert transactions[1].amount == -25.50

    def test_parse_plus_minus_amounts(self):
        """Parse CSV with +/- prefix for amounts"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Date",
            amount_column="Amount",
            description_column="Memo",
            amount_sign_convention="plus_minus",
            amount_currency_prefix="$",
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(CSV_PLUS_MINUS_AMOUNTS)

        assert len(transactions) == 3
        assert transactions[0].amount == -5.00  # Coffee Shop
        assert transactions[1].amount == 1000.00  # Deposit
        assert transactions[2].amount == -45.50  # Gas Station

    def test_skip_patterns(self):
        """Skip rows matching patterns"""
        csv_with_pending = """Date,Amount,Description
01/15/2025,-50.00,AMAZON PURCHASE
01/16/2025,-25.50,PENDING: GROCERY STORE
01/17/2025,100.00,PAYROLL DEPOSIT
"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Date",
            amount_column="Amount",
            description_column="Description",
            row_handling=RowHandling(skip_patterns=["PENDING"]),
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(csv_with_pending)

        assert len(transactions) == 2
        assert transactions[0].description == "AMAZON PURCHASE"
        assert transactions[1].description == "PAYROLL DEPOSIT"

    def test_skip_footer_rows(self):
        """Skip footer rows"""
        csv_with_footer = """Date,Amount,Description
01/15/2025,-50.00,AMAZON PURCHASE
01/16/2025,-25.50,GROCERY STORE
Total,-75.50,
End of Statement
"""
        config = CustomCsvConfig(
            name="Test Bank",
            account_source="TEST-CHECKING",
            date_column="Date",
            amount_column="Amount",
            description_column="Description",
            row_handling=RowHandling(skip_footer_rows=2),
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(csv_with_footer)

        assert len(transactions) == 2

    def test_invert_sign(self):
        """Invert sign for credit card statements"""
        # Credit card: positive = charge (should become negative expense)
        cc_csv = """Date,Amount,Description
01/15/2025,50.00,AMAZON PURCHASE
01/16/2025,25.50,GROCERY STORE
01/17/2025,-100.00,PAYMENT RECEIVED
"""
        config = CustomCsvConfig(
            name="Credit Card",
            account_source="TEST-CC",
            date_column="Date",
            amount_column="Amount",
            description_column="Description",
            amount_invert_sign=True,
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(cc_csv)

        assert transactions[0].amount == -50.00  # Expense
        assert transactions[1].amount == -25.50  # Expense
        assert transactions[2].amount == 100.00  # Payment (credit)


# =============================================================================
# CustomCsvParser Tests - Index-Based Columns
# =============================================================================

class TestCustomCsvParserIndexColumns:
    """Test CustomCsvParser with column indexes"""

    def test_parse_by_index(self):
        """Parse CSV using column indexes"""
        config = CustomCsvConfig(
            name="No Header Bank",
            account_source="TEST-CHECKING",
            date_column=0,  # First column
            amount_column=1,  # Second column
            description_column=2,  # Third column
            row_handling=RowHandling(skip_header_rows=0),  # No header
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(CSV_NO_HEADER)

        assert len(transactions) == 3
        assert transactions[0].date == date(2025, 1, 15)
        assert transactions[0].amount == -50.00
        assert transactions[0].description == "AMAZON PURCHASE"

    def test_parse_mixed_with_category_index(self):
        """Parse with additional column by index"""
        config = CustomCsvConfig(
            name="No Header Bank",
            account_source="TEST-CHECKING",
            date_column=0,
            amount_column=1,
            description_column=2,
            category_column=3,  # Fourth column is category
        )
        parser = CustomCsvParser(config)
        transactions = parser.parse(CSV_NO_HEADER)

        assert len(transactions) == 3
        assert transactions[0].source_category == "Shopping"
        assert transactions[1].source_category == "Groceries"
        assert transactions[2].source_category == "Income"


# =============================================================================
# Auto-Detection Helper Tests
# =============================================================================

class TestAutoDetection:
    """Test auto-detection helper functions"""

    def test_detect_date_format_mmddyyyy(self):
        """Detect MM/DD/YYYY format"""
        samples = ["01/15/2025", "02/28/2025", "12/31/2024"]
        result = detect_date_format(samples)

        assert result is not None
        assert result[0] == "%m/%d/%Y"
        assert result[1] == "MM/DD/YYYY"

    def test_detect_date_format_iso(self):
        """Detect YYYY-MM-DD format"""
        samples = ["2025-01-15", "2025-02-28", "2024-12-31"]
        result = detect_date_format(samples)

        assert result is not None
        assert result[0] == "%Y-%m-%d"
        assert result[1] == "YYYY-MM-DD"

    def test_detect_date_format_ddmmyyyy(self):
        """Detect DD/MM/YYYY format"""
        samples = ["15/01/2025", "28/02/2025", "31/12/2024"]
        result = detect_date_format(samples)

        assert result is not None
        assert result[0] == "%d/%m/%Y"

    def test_detect_date_format_invalid(self):
        """Return None for invalid samples"""
        samples = ["not-a-date", "also-not", "nope"]
        result = detect_date_format(samples)
        assert result is None

    def test_detect_amount_format_negative_prefix(self):
        """Detect negative prefix format"""
        samples = ["-50.00", "25.50", "-100.00"]
        result = detect_amount_format(samples)

        assert result["sign_convention"] == "negative_prefix"

    def test_detect_amount_format_parentheses(self):
        """Detect parentheses format"""
        samples = ["($50.00)", "$25.50", "($100.00)"]
        result = detect_amount_format(samples)

        assert result["sign_convention"] == "parentheses"
        assert result["currency_prefix"] == "$"

    def test_detect_amount_format_plus_minus(self):
        """Detect plus/minus prefix format"""
        samples = ["- $50.00", "+ $25.50", "- $100.00"]
        result = detect_amount_format(samples)

        assert result["sign_convention"] == "plus_minus"
        assert result["currency_prefix"] == "$"


class TestAnalyzeCsvColumns:
    """Test CSV column analysis"""

    def test_analyze_simple_csv(self):
        """Analyze a simple CSV file"""
        result = analyze_csv_columns(SIMPLE_CSV)

        assert "headers" in result
        assert "sample_rows" in result
        assert "column_hints" in result

        assert result["headers"] == ["Date", "Amount", "Description", "Merchant"]
        assert len(result["sample_rows"]) == 3  # All data rows

        # Check hints
        assert result["column_hints"]["Date"]["likely_type"] == "date"
        assert result["column_hints"]["Amount"]["likely_type"] == "amount"

    def test_analyze_with_skip_rows(self):
        """Analyze CSV with header rows to skip"""
        result = analyze_csv_columns(CSV_WITH_HEADERS, skip_rows=3)

        assert result["headers"] == ["Date", "Amount", "Description", "Category"]
        assert len(result["sample_rows"]) == 2

    def test_suggested_config(self):
        """Analysis should include suggested config"""
        result = analyze_csv_columns(SIMPLE_CSV)

        assert "suggested_config" in result
        suggested = result["suggested_config"]

        # Should have detected the required columns
        assert suggested["date_column"] == "Date"
        assert suggested["amount_column"] == "Amount"
        assert suggested["description_column"] in ["Description", "Merchant"]

        # Should have detected date format
        assert suggested["date_format"] == "%m/%d/%Y"

        # Should have completeness score
        assert suggested["_completeness"] == 1.0

    def test_suggested_config_unknown_format(self):
        """Suggested config handles unknown columns gracefully"""
        unknown_csv = """Col1,Col2,Col3
abc,def,ghi
jkl,mno,pqr
"""
        result = analyze_csv_columns(unknown_csv)
        suggested = result["suggested_config"]

        # Should have low completeness when columns not recognized
        assert suggested["_completeness"] < 1.0


# =============================================================================
# API Endpoint Tests
# =============================================================================

@pytest.mark.asyncio
class TestCustomCsvApiEndpoints:
    """Test API endpoints for custom CSV format management"""

    async def test_analyze_endpoint(self, client: AsyncClient):
        """Test POST /api/v1/import/analyze"""
        files = {"file": ("test.csv", SIMPLE_CSV, "text/csv")}
        data = {"skip_rows": "0"}

        response = await client.post("/api/v1/import/analyze", files=files, data=data)

        assert response.status_code == 200
        result = response.json()
        assert result["headers"] == ["Date", "Amount", "Description", "Merchant"]
        assert result["row_count"] == 3

    async def test_custom_preview_endpoint(self, client: AsyncClient):
        """Test POST /api/v1/import/custom/preview"""
        config = {
            "name": "Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }

        files = {"file": ("test.csv", SIMPLE_CSV, "text/csv")}
        data = {"config_json": json.dumps(config)}

        response = await client.post("/api/v1/import/custom/preview", files=files, data=data)

        assert response.status_code == 200
        result = response.json()
        assert result["transaction_count"] == 3
        assert len(result["transactions"]) == 3
        assert result["total_amount"] == 24.50  # -50 - 25.50 + 100

    async def test_custom_preview_invalid_config(self, client: AsyncClient):
        """Test preview with invalid config"""
        files = {"file": ("test.csv", SIMPLE_CSV, "text/csv")}
        data = {"config_json": "not valid json"}

        response = await client.post("/api/v1/import/custom/preview", files=files, data=data)

        assert response.status_code == 400
        assert "Invalid config JSON" in response.json()["detail"]

    async def test_custom_confirm_endpoint(self, client: AsyncClient):
        """Test POST /api/v1/import/custom/confirm"""
        config = {
            "name": "Test Bank Import",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }

        files = {"file": ("test.csv", SIMPLE_CSV, "text/csv")}
        data = {
            "config_json": json.dumps(config),
            "save_config": "false",
        }

        response = await client.post("/api/v1/import/custom/confirm", files=files, data=data)

        assert response.status_code == 200
        result = response.json()
        assert result["imported"] == 3
        assert result["duplicates"] == 0
        assert result["config_saved"] is False
        assert "import_session_id" in result

    async def test_custom_confirm_with_save_config(self, client: AsyncClient):
        """Test custom confirm saves config when requested"""
        config = {
            "name": "Saved Bank Format",
            "account_source": "TEST-SAVINGS",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }

        files = {"file": ("test.csv", SIMPLE_CSV, "text/csv")}
        data = {
            "config_json": json.dumps(config),
            "save_config": "true",
        }

        response = await client.post("/api/v1/import/custom/confirm", files=files, data=data)

        assert response.status_code == 200
        result = response.json()
        assert result["config_saved"] is True

        # Verify config was saved
        configs_response = await client.get("/api/v1/import/custom/configs")
        configs = configs_response.json()
        assert any(c["name"] == "Saved Bank Format" for c in configs)

    async def test_custom_confirm_invalid_config(self, client: AsyncClient):
        """Test confirm with invalid config returns error"""
        files = {"file": ("test.csv", SIMPLE_CSV, "text/csv")}
        data = {"config_json": "not valid json"}

        response = await client.post("/api/v1/import/custom/confirm", files=files, data=data)

        assert response.status_code == 400
        assert "Invalid config JSON" in response.json()["detail"]

    async def test_create_custom_config(self, client: AsyncClient):
        """Test POST /api/v1/import/custom/configs"""
        config = {
            "name": "Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }

        response = await client.post(
            "/api/v1/import/custom/configs",
            json={
                "name": "My Test Config",
                "description": "Test configuration",
                "config_json": json.dumps(config),
            }
        )

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "My Test Config"
        assert result["id"] is not None

    async def test_list_custom_configs(self, client: AsyncClient):
        """Test GET /api/v1/import/custom/configs"""
        # Create a config first
        config = {
            "name": "Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }
        await client.post(
            "/api/v1/import/custom/configs",
            json={
                "name": "List Test Config",
                "config_json": json.dumps(config),
            }
        )

        response = await client.get("/api/v1/import/custom/configs")

        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)
        assert any(c["name"] == "List Test Config" for c in result)

    async def test_get_custom_config(self, client: AsyncClient):
        """Test GET /api/v1/import/custom/configs/{id}"""
        # Create a config first
        config = {
            "name": "Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }
        create_response = await client.post(
            "/api/v1/import/custom/configs",
            json={
                "name": "Get Test Config",
                "config_json": json.dumps(config),
            }
        )
        config_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/import/custom/configs/{config_id}")

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "Get Test Config"

    async def test_update_custom_config(self, client: AsyncClient):
        """Test PUT /api/v1/import/custom/configs/{id}"""
        # Create a config first
        config = {
            "name": "Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }
        create_response = await client.post(
            "/api/v1/import/custom/configs",
            json={
                "name": "Update Test Config",
                "config_json": json.dumps(config),
            }
        )
        config_id = create_response.json()["id"]

        response = await client.put(
            f"/api/v1/import/custom/configs/{config_id}",
            json={"name": "Updated Config Name"}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["name"] == "Updated Config Name"

    async def test_delete_custom_config(self, client: AsyncClient):
        """Test DELETE /api/v1/import/custom/configs/{id}"""
        # Create a config first
        config = {
            "name": "Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }
        create_response = await client.post(
            "/api/v1/import/custom/configs",
            json={
                "name": "Delete Test Config",
                "config_json": json.dumps(config),
            }
        )
        config_id = create_response.json()["id"]

        response = await client.delete(f"/api/v1/import/custom/configs/{config_id}")

        assert response.status_code == 200
        assert response.json()["deleted"] is True

        # Verify it's gone
        get_response = await client.get(f"/api/v1/import/custom/configs/{config_id}")
        assert get_response.status_code == 404

    async def test_export_import_config(self, client: AsyncClient):
        """Test export and import of config"""
        # Create a config
        config = {
            "name": "Export Test",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }
        create_response = await client.post(
            "/api/v1/import/custom/configs",
            json={
                "name": "Export Test Config",
                "description": "Test export",
                "config_json": json.dumps(config),
            }
        )
        config_id = create_response.json()["id"]

        # Export it
        export_response = await client.get(f"/api/v1/import/custom/configs/{config_id}/export")
        assert export_response.status_code == 200
        exported = export_response.json()

        # Import it with a new name
        import_response = await client.post(
            "/api/v1/import/custom/configs/import",
            json={
                "name": "Imported Config",
                "config": exported["config"],
            }
        )

        assert import_response.status_code == 200
        imported = import_response.json()
        assert imported["name"] == "Imported Config"
        assert imported["id"] != config_id


class TestCustomCsvConfigParsing:
    """Test CustomCsvConfig JSON parsing edge cases."""

    def test_from_json_ignores_unknown_fields(self):
        """Config JSON should ignore unknown fields like 'description'.

        This is a regression test for the bug where the frontend sends
        'description' in the config_json, causing parsing to fail.
        The description should be stored separately, not in config_json.
        """
        config_json = '''{
            "name": "Test Format",
            "account_source": "test-account",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
            "date_format": "%m/%d/%Y",
            "amount_sign_convention": "negative_prefix",
            "description": "This field should be ignored",
            "some_future_field": "also ignored"
        }'''

        # This should NOT raise an error
        config = CustomCsvConfig.from_json(config_json)

        assert config.name == "Test Format"
        assert config.account_source == "test-account"
        assert config.date_column == "Date"
        assert config.amount_column == "Amount"
        assert config.description_column == "Description"

    def test_from_json_with_row_handling(self):
        """Config JSON with nested row_handling should parse correctly."""
        config_json = '''{
            "name": "Test Format",
            "account_source": "test-account",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
            "row_handling": {
                "skip_header_rows": 5,
                "skip_footer_rows": 2,
                "skip_empty_rows": true
            }
        }'''

        config = CustomCsvConfig.from_json(config_json)

        assert config.row_handling.skip_header_rows == 5
        assert config.row_handling.skip_footer_rows == 2
        assert config.row_handling.skip_empty_rows is True


# =============================================================================
# Header Signature Tests
# =============================================================================

class TestHeaderSignature:
    """Test header signature computation for auto-matching CSV formats."""

    def test_compute_signature_basic(self):
        """Signature is computed from normalized, sorted headers."""
        headers = ["Date", "Amount", "Description"]
        signature = compute_header_signature(headers)

        # Signature should be a 16-char hex string
        assert len(signature) == 16
        assert all(c in "0123456789abcdef" for c in signature)

    def test_signature_is_consistent(self):
        """Same headers always produce the same signature."""
        headers = ["Date", "Amount", "Description"]
        sig1 = compute_header_signature(headers)
        sig2 = compute_header_signature(headers)
        assert sig1 == sig2

    def test_signature_ignores_order(self):
        """Column order doesn't affect signature."""
        headers1 = ["Date", "Amount", "Description"]
        headers2 = ["Description", "Date", "Amount"]
        headers3 = ["Amount", "Description", "Date"]

        sig1 = compute_header_signature(headers1)
        sig2 = compute_header_signature(headers2)
        sig3 = compute_header_signature(headers3)

        assert sig1 == sig2 == sig3

    def test_signature_ignores_case(self):
        """Case doesn't affect signature."""
        headers1 = ["Date", "Amount", "Description"]
        headers2 = ["DATE", "AMOUNT", "DESCRIPTION"]
        headers3 = ["date", "amount", "description"]

        sig1 = compute_header_signature(headers1)
        sig2 = compute_header_signature(headers2)
        sig3 = compute_header_signature(headers3)

        assert sig1 == sig2 == sig3

    def test_signature_ignores_whitespace(self):
        """Leading/trailing whitespace doesn't affect signature."""
        headers1 = ["Date", "Amount", "Description"]
        headers2 = [" Date ", "  Amount", "Description  "]

        sig1 = compute_header_signature(headers1)
        sig2 = compute_header_signature(headers2)

        assert sig1 == sig2

    def test_different_headers_different_signature(self):
        """Different headers produce different signatures."""
        headers1 = ["Date", "Amount", "Description"]
        headers2 = ["Date", "Amount", "Memo"]  # Different column name

        sig1 = compute_header_signature(headers1)
        sig2 = compute_header_signature(headers2)

        assert sig1 != sig2

    def test_signature_filters_empty_headers(self):
        """Empty headers are filtered out."""
        headers1 = ["Date", "Amount", "Description"]
        headers2 = ["Date", "", "Amount", "Description", "  "]

        sig1 = compute_header_signature(headers1)
        sig2 = compute_header_signature(headers2)

        assert sig1 == sig2

    def test_compute_signature_from_csv(self):
        """Compute signature directly from CSV content."""
        csv_content = """Date,Amount,Description
01/15/2025,-50.00,Amazon
01/16/2025,-25.50,Grocery
"""
        signature = compute_signature_from_csv(csv_content)

        assert signature is not None
        assert len(signature) == 16

        # Should match direct header computation
        expected = compute_header_signature(["Date", "Amount", "Description"])
        assert signature == expected

    def test_compute_signature_from_csv_with_skip_rows(self):
        """Signature computation handles skip_rows correctly."""
        csv_content = """Bank Statement
Generated: 2025-01-17

Date,Amount,Description
01/15/2025,-50.00,Amazon
"""
        # Auto-detect should find header at row 3 (0-indexed)
        signature = compute_signature_from_csv(csv_content, skip_rows=0)

        assert signature is not None
        expected = compute_header_signature(["Date", "Amount", "Description"])
        assert signature == expected


@pytest.mark.asyncio
class TestHeaderSignatureApi:
    """Test API endpoints that use header signatures."""

    async def test_auto_detect_returns_signature(self, client: AsyncClient):
        """Auto-detect endpoint returns header signature."""
        csv_content = """Date,Amount,Description
01/15/2025,-50.00,Amazon
01/16/2025,-25.50,Grocery
"""
        files = {"file": ("test.csv", csv_content, "text/csv")}

        response = await client.post("/api/v1/import/custom/auto-detect", files=files)

        assert response.status_code == 200
        result = response.json()
        assert "header_signature" in result
        assert result["header_signature"] is not None
        assert len(result["header_signature"]) == 16

    async def test_create_config_with_signature(self, client: AsyncClient):
        """Create config with header signature for auto-matching."""
        config = {
            "name": "Signature Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }
        signature = compute_header_signature(["Date", "Amount", "Description"])

        response = await client.post(
            "/api/v1/import/custom/configs",
            json={
                "name": "Signature Test Config",
                "config_json": json.dumps(config),
                "header_signature": signature,
            }
        )

        assert response.status_code == 200
        result = response.json()
        assert result["header_signature"] == signature

    async def test_auto_detect_matches_saved_config(self, client: AsyncClient):
        """Auto-detect returns matched config when signature matches."""
        # First, create a config with a signature
        config = {
            "name": "Match Test Bank",
            "account_source": "TEST-CHECKING",
            "date_column": "Date",
            "amount_column": "Amount",
            "description_column": "Description",
        }
        signature = compute_header_signature(["Date", "Amount", "Description"])

        await client.post(
            "/api/v1/import/custom/configs",
            json={
                "name": "Match Test Config",
                "config_json": json.dumps(config),
                "header_signature": signature,
            }
        )

        # Now auto-detect a CSV with matching headers
        csv_content = """Date,Amount,Description
01/15/2025,-50.00,Amazon
01/16/2025,-25.50,Grocery
"""
        files = {"file": ("test.csv", csv_content, "text/csv")}

        response = await client.post("/api/v1/import/custom/auto-detect", files=files)

        assert response.status_code == 200
        result = response.json()

        # Should find the matching config
        assert result["matched_config"] is not None
        assert result["matched_config"]["name"] == "Match Test Config"
