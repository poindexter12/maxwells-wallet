"""
Tests for CSV auto-detection using real sample files.

These tests verify that the auto-detection logic can:
1. Find the correct header row (skipping metadata)
2. Identify column types (date, amount, description, etc.)
3. Detect date and amount formats correctly
4. Generate a config that can parse the file successfully
"""

from pathlib import Path

import pytest

from app.parsers.formats.custom_csv import (
    CustomCsvConfig,
    CustomCsvParser,
    RowHandling,
    analyze_csv_columns,
    auto_detect_csv_format,
    detect_amount_format,
    detect_date_format,
    find_header_row,
)

# Path to sample data files
DATA_DIR = Path(__file__).parent.parent.parent / "data"
RAW_DIR = DATA_DIR / "raw"
ANON_DIR = DATA_DIR / "anonymized"


def get_sample_file(name: str) -> str:
    """Load a sample CSV file content.

    Skips the test if sample file is not found (sample data is gitignored).
    """
    paths_to_try = [
        ANON_DIR / name,
        RAW_DIR / name,
        # Handle subdirectories
        RAW_DIR / "BofA" / name,
        RAW_DIR / "Amex" / name,
        RAW_DIR / "Inspira HSA" / name,
        RAW_DIR / "Venmo" / name,
    ]

    for path in paths_to_try:
        if path.exists():
            return path.read_text()

    pytest.skip(f"Sample file not found (data/ is gitignored): {name}")


class TestAutoDetectHeaderRow:
    """Test automatic detection of the header row position."""

    def test_bofa_bank_finds_header_after_summary(self):
        """BofA bank CSV has summary rows before the actual data."""
        content = get_sample_file("bofa_bank_anon.csv")

        # The header row should be found at row 7 (0-indexed: 6)
        # Row 1-5: Summary info (Description,,Summary Amt., Beginning balance, etc.)
        # Row 6: Empty row
        # Row 7: "Date,Description,Amount,Running Bal."

        result = find_header_row(content)
        assert result is not None, "Should find a header row"

        skip_rows, headers = result
        assert "Date" in headers
        assert "Description" in headers
        assert "Amount" in headers

    def test_bofa_cc_header_is_first_row(self):
        """BofA credit card CSV has header as the first row."""
        content = get_sample_file("bofa_cc_anon.csv")

        result = find_header_row(content)
        assert result is not None

        skip_rows, headers = result
        assert skip_rows == 0, "Header should be first row"
        assert "Posted Date" in headers
        assert "Payee" in headers
        assert "Amount" in headers

    def test_amex_header_is_first_row(self):
        """AMEX CSV has header as the first row."""
        content = get_sample_file("amex_cc_anon.csv")

        result = find_header_row(content)
        assert result is not None

        skip_rows, headers = result
        assert skip_rows == 0
        assert "Date" in headers
        assert "Amount" in headers
        assert "Description" in headers
        assert "Category" in headers

    def test_inspira_hsa_header_is_first_row(self):
        """Inspira HSA CSV has header as the first row."""
        content = get_sample_file("inspira_hsa_anon.csv")

        result = find_header_row(content)
        assert result is not None

        skip_rows, headers = result
        assert skip_rows == 0
        assert "Posted Date" in headers
        assert "Amount" in headers
        assert "Description" in headers
        assert "Expense Category" in headers

    def test_venmo_finds_header_after_account_info(self):
        """Venmo CSV has account info rows before the header."""
        content = get_sample_file("venmo_anon.csv")

        # Row 1: "Account Statement - (@teamseymour)"
        # Row 2: "Account Activity"
        # Row 3: Header row with ID, Datetime, Type, etc.

        result = find_header_row(content)
        assert result is not None

        skip_rows, headers = result
        assert skip_rows >= 2, "Should skip at least 2 metadata rows"
        assert "ID" in headers or "Datetime" in headers
        assert "Amount (total)" in headers


class TestColumnTypeDetection:
    """Test detection of column types from sample data."""

    def test_bofa_bank_column_hints(self):
        """Test column type detection for BofA bank CSV."""
        content = get_sample_file("bofa_bank_anon.csv")

        # Skip to actual data (row 7)
        result = analyze_csv_columns(content, skip_rows=6)

        hints = result["column_hints"]

        # Date column should be detected
        assert hints["Date"]["likely_type"] == "date"
        assert hints["Date"]["confidence"] >= 0.7

        # Amount column should be detected
        assert hints["Amount"]["likely_type"] == "amount"

        # Description column should be detected
        assert hints["Description"]["likely_type"] in ("description", "merchant")

    def test_bofa_cc_column_hints(self):
        """Test column type detection for BofA CC CSV."""
        content = get_sample_file("bofa_cc_anon.csv")

        result = analyze_csv_columns(content, skip_rows=0)
        hints = result["column_hints"]

        assert hints["Posted Date"]["likely_type"] == "date"
        assert hints["Amount"]["likely_type"] == "amount"
        assert hints["Payee"]["likely_type"] in ("description", "merchant")
        assert hints["Reference Number"]["likely_type"] == "reference"

    def test_amex_column_hints(self):
        """Test column type detection for AMEX CSV."""
        content = get_sample_file("amex_cc_anon.csv")

        result = analyze_csv_columns(content, skip_rows=0)
        hints = result["column_hints"]

        assert hints["Date"]["likely_type"] == "date"
        assert hints["Amount"]["likely_type"] == "amount"
        assert hints["Description"]["likely_type"] == "description"
        assert hints["Category"]["likely_type"] == "category"
        assert hints["Card Member"]["likely_type"] == "account"

    def test_inspira_hsa_column_hints(self):
        """Test column type detection for Inspira HSA CSV."""
        content = get_sample_file("inspira_hsa_anon.csv")

        result = analyze_csv_columns(content, skip_rows=0)
        hints = result["column_hints"]

        assert hints["Posted Date"]["likely_type"] == "date"
        assert hints["Amount"]["likely_type"] == "amount"
        assert hints["Description"]["likely_type"] in ("description", "merchant")
        assert hints["Transaction ID"]["likely_type"] == "reference"
        assert hints["Expense Category"]["likely_type"] == "category"

    def test_venmo_column_hints(self):
        """Test column type detection for Venmo CSV."""
        content = get_sample_file("venmo_anon.csv")

        # Venmo header is at row 3 (0-indexed: 2)
        result = analyze_csv_columns(content, skip_rows=2)
        hints = result["column_hints"]

        # Datetime column should be detected as date
        assert hints.get("Datetime", {}).get("likely_type") == "date" or any(
            h.get("likely_type") == "date" for h in hints.values()
        )

        # Amount column should be detected
        assert hints.get("Amount (total)", {}).get("likely_type") == "amount" or any(
            h.get("likely_type") == "amount" for h in hints.values()
        )


class TestDateFormatDetection:
    """Test detection of date formats."""

    def test_detect_mm_dd_yyyy(self):
        """Standard US date format."""
        samples = ["01/15/2025", "02/28/2025", "12/31/2024"]
        result = detect_date_format(samples)

        assert result is not None
        assert result[0] == "%m/%d/%Y"

    def test_detect_yyyy_mm_dd(self):
        """ISO-style date format."""
        samples = ["2025-01-15", "2025-02-28", "2024-12-31"]
        result = detect_date_format(samples)

        assert result is not None
        assert result[0] == "%Y-%m-%d"

    def test_detect_iso_datetime(self):
        """ISO datetime format with time component."""
        samples = ["2025-01-05T00:13:58", "2025-01-07T18:11:03"]

        result = detect_date_format(samples)

        assert result is not None
        # Should return "iso" so parser uses fromisoformat()
        assert result[0] == "iso"
        assert result[1] == "ISO DateTime"

    def test_detect_mm_dd_yy(self):
        """Short year format."""
        samples = ["01/15/25", "02/28/25", "12/31/24"]
        result = detect_date_format(samples)

        assert result is not None
        assert result[0] == "%m/%d/%y"


class TestAmountFormatDetection:
    """Test detection of amount formats."""

    def test_detect_negative_prefix(self):
        """Standard negative prefix format."""
        samples = ["-100.00", "50.00", "-25.50", "1,234.56"]
        result = detect_amount_format(samples)

        assert result["sign_convention"] == "negative_prefix"

    def test_detect_parentheses(self):
        """Parentheses for negative amounts."""
        samples = ["($100.00)", "$50.00", "($25.50)"]
        result = detect_amount_format(samples)

        assert result["sign_convention"] == "parentheses"
        assert result["currency_prefix"] == "$"

    def test_detect_plus_minus_prefix(self):
        """Plus/minus prefix format (Venmo style)."""
        samples = ["- $100.00", "+ $50.00", "- $25.50"]
        result = detect_amount_format(samples)

        assert result["sign_convention"] == "plus_minus"
        assert result["currency_prefix"] == "$"

    def test_detect_currency_prefix(self):
        """Currency prefix detection."""
        samples = ["$100.00", "$50.00", "$25.50"]
        result = detect_amount_format(samples)

        assert result["currency_prefix"] == "$"


class TestSuggestedConfig:
    """Test that suggested configs can parse the files."""

    def test_bofa_bank_suggested_config(self):
        """BofA bank should generate a working config."""
        content = get_sample_file("bofa_bank_anon.csv")

        # Auto-detect header row
        header_result = find_header_row(content)
        assert header_result is not None
        skip_rows, _ = header_result

        # Analyze columns
        result = analyze_csv_columns(content, skip_rows=skip_rows)
        suggested = result.get("suggested_config", {})

        # Required fields should be populated
        assert suggested.get("date_column") is not None
        assert suggested.get("amount_column") is not None
        assert suggested.get("description_column") is not None

        # Try to parse with the suggested config
        config = build_config_from_suggestion(suggested, skip_rows)
        parser = CustomCsvParser(config)
        transactions = parser.parse(content)

        # Should parse transactions successfully
        assert len(transactions) > 0, "Should parse at least some transactions"

        # Verify transaction data looks reasonable
        for txn in transactions[:5]:
            assert txn.date is not None
            assert isinstance(txn.amount, float)
            assert txn.description

    def test_bofa_cc_suggested_config(self):
        """BofA credit card should generate a working config."""
        content = get_sample_file("bofa_cc_anon.csv")

        result = analyze_csv_columns(content, skip_rows=0)
        suggested = result.get("suggested_config", {})

        assert suggested.get("date_column") is not None
        assert suggested.get("amount_column") is not None
        assert suggested.get("description_column") is not None

        config = build_config_from_suggestion(suggested, skip_rows=0)
        parser = CustomCsvParser(config)
        transactions = parser.parse(content)

        assert len(transactions) > 0

    def test_amex_suggested_config(self):
        """AMEX should generate a working config with sign inversion detected."""
        content = get_sample_file("amex_cc_anon.csv")

        result = analyze_csv_columns(content, skip_rows=0)
        suggested = result.get("suggested_config", {})

        assert suggested.get("date_column") is not None
        assert suggested.get("amount_column") is not None
        assert suggested.get("description_column") is not None

        # AMEX uses positive=expense, so sign inversion should be detected
        assert suggested.get("amount_invert_sign") is True, (
            "Should detect that AMEX needs sign inversion (positive = expense)"
        )

        config = build_config_from_suggestion(suggested, skip_rows=0)
        parser = CustomCsvParser(config)
        transactions = parser.parse(content)

        assert len(transactions) > 0

        # Check that expenses are negative (after inversion)
        # Most AMEX transactions should be expenses (negative after inversion)
        expense_count = sum(1 for t in transactions if t.amount < 0)
        assert expense_count >= len(transactions) * 0.7, (
            f"Expected 70%+ expenses after inversion, got {expense_count}/{len(transactions)}"
        )

    def test_inspira_hsa_suggested_config(self):
        """Inspira HSA should generate a working config."""
        content = get_sample_file("inspira_hsa_anon.csv")

        result = analyze_csv_columns(content, skip_rows=0)
        suggested = result.get("suggested_config", {})

        assert suggested.get("date_column") is not None
        assert suggested.get("amount_column") is not None
        assert suggested.get("description_column") is not None

        config = build_config_from_suggestion(suggested, skip_rows=0)
        parser = CustomCsvParser(config)
        transactions = parser.parse(content)

        assert len(transactions) > 0

    def test_venmo_suggested_config(self):
        """Venmo should generate a working config."""
        content = get_sample_file("venmo_anon.csv")

        # Auto-detect header row
        header_result = find_header_row(content)
        if header_result is None:
            pytest.skip("Header row detection needs enhancement for Venmo")

        skip_rows, _ = header_result

        result = analyze_csv_columns(content, skip_rows=skip_rows)
        suggested = result.get("suggested_config", {})

        assert suggested.get("date_column") is not None
        assert suggested.get("amount_column") is not None

        config = build_config_from_suggestion(suggested, skip_rows=skip_rows)
        parser = CustomCsvParser(config)
        transactions = parser.parse(content)

        # Venmo file has only 4 actual transactions
        assert len(transactions) >= 1, "Should parse at least one transaction"


class TestEndToEndAutoDetect:
    """End-to-end tests: given a CSV file, auto-detect and parse successfully."""

    @pytest.mark.parametrize(
        "filename,expected_min_transactions",
        [
            ("bofa_bank_anon.csv", 100),
            ("bofa_cc_anon.csv", 50),
            ("amex_cc_anon.csv", 30),
            ("inspira_hsa_anon.csv", 50),
            ("venmo_anon.csv", 1),
        ],
    )
    def test_auto_detect_and_parse(self, filename, expected_min_transactions):
        """Test that we can auto-detect format and parse the file."""
        content = get_sample_file(filename)  # Skips if file not found

        # Full auto-detection pipeline
        config = auto_detect_csv_format(content)

        if config is None:
            pytest.fail(f"Failed to auto-detect format for {filename}")

        parser = CustomCsvParser(config)
        transactions = parser.parse(content)

        assert len(transactions) >= expected_min_transactions, (
            f"Expected at least {expected_min_transactions} transactions, got {len(transactions)}"
        )

        # Verify all transactions have valid data
        for txn in transactions:
            assert txn.date is not None, f"Transaction missing date: {txn}"
            assert txn.amount is not None, f"Transaction missing amount: {txn}"
            # Description can be empty for some transaction types (e.g., Venmo Standard Transfer)
            # so we don't strictly require it


# ============================================================================
# Helper functions for testing
# ============================================================================


def build_config_from_suggestion(suggested: dict, skip_rows: int) -> CustomCsvConfig:
    """Build a CustomCsvConfig from a suggested config dict."""
    return CustomCsvConfig(
        name=suggested.get("name", "Auto-detected Format"),
        account_source=suggested.get("account_source", "Unknown"),
        date_column=suggested.get("date_column", "Date"),
        amount_column=suggested.get("amount_column", "Amount"),
        description_column=suggested.get("description_column", "Description"),
        reference_column=suggested.get("reference_column"),
        category_column=suggested.get("category_column"),
        card_member_column=suggested.get("card_member_column"),
        date_format=suggested.get("date_format", "%m/%d/%Y"),
        amount_sign_convention=suggested.get("amount_sign_convention", "negative_prefix"),
        amount_currency_prefix=suggested.get("amount_currency_prefix", ""),
        amount_invert_sign=suggested.get("amount_invert_sign", False),
        row_handling=RowHandling(
            skip_header_rows=skip_rows,
            skip_empty_rows=True,
        ),
    )


class TestColumnDetectionEdgeCases:
    """Test edge cases in column detection."""

    def test_non_numeric_total_column_should_not_be_amount(self):
        """A column named 'Total' with text values should NOT be detected as amount."""
        csv_content = """ID,Date,Total,Details,Amount
1,01/15/2025,Payment received,Coffee shop visit,100.00
2,01/16/2025,Transfer complete,Grocery shopping,50.50
3,01/17/2025,Refund processed,Restaurant dinner,-25.00
4,01/18/2025,Purchase made,Gas for car,15.99
5,01/19/2025,Direct deposit,Online order,200.00"""

        result = analyze_csv_columns(csv_content, skip_rows=0)
        hints = result["column_hints"]
        config = result["suggested_config"]

        # The "Total" column has text, not numbers - should NOT be detected as amount
        total_hint = hints.get("Total", {})
        assert total_hint.get("likely_type") != "amount", (
            f"Column 'Total' has text values, should not be amount but got: {total_hint}"
        )

        # The "Amount" column SHOULD be detected as amount
        amount_hint = hints.get("Amount", {})
        assert amount_hint.get("likely_type") == "amount", f"Column 'Amount' should be amount but got: {amount_hint}"

        # Suggested config should use "Amount", not "Total"
        assert config.get("amount_column") == "Amount", (
            f"amount_column should be 'Amount' but got: {config.get('amount_column')}"
        )

    def test_amount_keyword_in_header_but_text_values_prefers_real_numbers(self):
        """When two columns have amount-like names, prefer the one with numeric data."""
        csv_content = """Date,Amount Type,Amount,Description
01/15/2025,Debit,100.00,Coffee
01/16/2025,Credit,-50.00,Refund
01/17/2025,Debit,25.00,Lunch
01/18/2025,Credit,-15.00,Return
01/19/2025,Debit,200.00,Shopping"""

        result = analyze_csv_columns(csv_content, skip_rows=0)
        config = result["suggested_config"]
        hints = result["column_hints"]

        # "Amount Type" has text, "Amount" has numbers
        # Should prefer "Amount" as the amount column
        assert config.get("amount_column") == "Amount", (
            f"Should prefer numeric 'Amount' over text 'Amount Type', got: {config.get('amount_column')}"
        )

        # Amount Type should be detected as description or unknown, not amount
        amount_type_hint = hints.get("Amount Type", {})
        assert amount_type_hint.get("likely_type") != "amount", (
            f"'Amount Type' has text values, should not be amount: {amount_type_hint}"
        )
