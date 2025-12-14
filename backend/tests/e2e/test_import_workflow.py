"""
E2E tests for CSV import workflow.

Tests the complete flow:
1. Navigate to import page
2. Upload CSV file
3. Preview transactions
4. Confirm import
5. Verify transactions appear in list
"""

import pytest
from pathlib import Path
from playwright.sync_api import Page, expect

from .conftest import E2EHelpers


@pytest.mark.e2e
class TestImportWorkflow:
    """End-to-end tests for the CSV import workflow."""

    def test_import_page_loads(self, page: Page, helpers: E2EHelpers):
        """Test that import page loads correctly."""
        page.goto("/import")
        page.wait_for_load_state("networkidle")

        # Verify page title or header
        expect(page.locator("h1, h2").first).to_contain_text("Import")

        # Verify file input exists
        expect(page.locator("input[type='file']")).to_be_visible()

    def test_import_bofa_bank_csv(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict[str, Path],
    ):
        """Test importing a Bank of America bank statement CSV."""
        if "bofa_bank" not in test_data_files:
            pytest.skip("bofa_bank_anon.csv not found in test data")

        csv_path = test_data_files["bofa_bank"]

        # Navigate to import page
        page.goto("/import")
        page.wait_for_load_state("networkidle")

        # Upload the CSV file
        page.set_input_files("input[type='file']", str(csv_path))

        # Select account source if dropdown exists
        account_select = page.locator("select[name='account_source'], #account-source")
        if account_select.count() > 0:
            account_select.select_option(label="BOFA-Checking")

        # Click preview button
        preview_button = page.locator("button:has-text('Preview'), button:has-text('Upload')")
        preview_button.click()

        # Wait for preview to load
        page.wait_for_load_state("networkidle")

        # Verify preview shows transaction count
        # Look for text like "347 transactions" or transaction table
        page.wait_for_selector("text=/\\d+ transaction/i", timeout=10000)

        # Verify detected format indicator
        expect(page.locator("text=/bofa|bank of america/i")).to_be_visible()

        # Click confirm/import button
        confirm_button = page.locator("button:has-text('Confirm'), button:has-text('Import')")
        confirm_button.click()

        # Wait for import to complete
        page.wait_for_load_state("networkidle")

        # Verify success message
        page.wait_for_selector("text=/imported|success/i", timeout=15000)

    def test_import_amex_csv(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict[str, Path],
    ):
        """Test importing an AMEX credit card statement CSV."""
        if "amex_cc" not in test_data_files:
            pytest.skip("amex_cc_anon.csv not found in test data")

        csv_path = test_data_files["amex_cc"]

        # Navigate to import page
        page.goto("/import")
        page.wait_for_load_state("networkidle")

        # Upload the CSV file
        page.set_input_files("input[type='file']", str(csv_path))

        # Select AMEX format hint if available
        format_select = page.locator("select[name='format_hint'], #format-hint")
        if format_select.count() > 0:
            format_select.select_option(value="amex_cc")

        # Click preview button
        page.locator("button:has-text('Preview'), button:has-text('Upload')").click()

        # Wait for preview
        page.wait_for_load_state("networkidle")

        # Verify AMEX format detected
        expect(page.locator("text=/amex|american express/i")).to_be_visible()

        # Confirm import
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_load_state("networkidle")

        # Verify success
        page.wait_for_selector("text=/imported|success/i", timeout=15000)

    def test_import_bofa_cc_csv(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict[str, Path],
    ):
        """Test importing a Bank of America credit card CSV."""
        if "bofa_cc" not in test_data_files:
            pytest.skip("bofa_cc_anon.csv not found in test data")

        csv_path = test_data_files["bofa_cc"]

        # Navigate to import page
        page.goto("/import")
        page.wait_for_load_state("networkidle")

        # Upload the CSV file
        page.set_input_files("input[type='file']", str(csv_path))

        # Click preview button
        page.locator("button:has-text('Preview'), button:has-text('Upload')").click()

        # Wait for preview
        page.wait_for_load_state("networkidle")

        # Verify format detected
        page.wait_for_selector("text=/\\d+ transaction/i", timeout=10000)

        # Confirm import
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_load_state("networkidle")

        # Verify success
        page.wait_for_selector("text=/imported|success/i", timeout=15000)

    def test_duplicate_detection(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict[str, Path],
    ):
        """Test that duplicate transactions are detected on re-import."""
        if "bofa_cc" not in test_data_files:
            pytest.skip("bofa_cc_anon.csv not found in test data")

        csv_path = test_data_files["bofa_cc"]

        # First import
        page.goto("/import")
        page.wait_for_load_state("networkidle")
        page.set_input_files("input[type='file']", str(csv_path))
        page.locator("button:has-text('Preview'), button:has-text('Upload')").click()
        page.wait_for_load_state("networkidle")
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_selector("text=/imported|success/i", timeout=15000)

        # Second import of same file
        page.goto("/import")
        page.wait_for_load_state("networkidle")
        page.set_input_files("input[type='file']", str(csv_path))
        page.locator("button:has-text('Preview'), button:has-text('Upload')").click()
        page.wait_for_load_state("networkidle")
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_load_state("networkidle")

        # Verify duplicates were detected
        # Look for "X duplicates" or "0 imported" message
        result_text = page.locator("text=/duplicate|already|skipped|0 imported/i")
        expect(result_text).to_be_visible(timeout=15000)

    def test_preview_shows_transactions(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict[str, Path],
    ):
        """Test that preview shows sample transactions."""
        if not test_data_files:
            pytest.skip("No test data files available")

        # Use any available test file
        csv_path = next(iter(test_data_files.values()))

        page.goto("/import")
        page.wait_for_load_state("networkidle")

        # Upload file
        page.set_input_files("input[type='file']", str(csv_path))
        page.locator("button:has-text('Preview'), button:has-text('Upload')").click()
        page.wait_for_load_state("networkidle")

        # Verify preview table has rows
        preview_rows = page.locator("table tbody tr")
        expect(preview_rows.first).to_be_visible(timeout=10000)

        # Should show at least one transaction in preview
        assert preview_rows.count() >= 1, "Preview should show at least one transaction"


@pytest.mark.e2e
class TestImportValidation:
    """Tests for import validation and error handling."""

    def test_empty_file_handling(self, page: Page, helpers: E2EHelpers, tmp_path: Path):
        """Test handling of empty CSV file."""
        # Create empty CSV
        empty_csv = tmp_path / "empty.csv"
        empty_csv.write_text("Date,Description,Amount\n")

        page.goto("/import")
        page.wait_for_load_state("networkidle")

        page.set_input_files("input[type='file']", str(empty_csv))
        page.locator("button:has-text('Preview'), button:has-text('Upload')").click()
        page.wait_for_load_state("networkidle")

        # Should show error or zero transactions message
        error_or_zero = page.locator("text=/error|0 transaction|no transaction|empty/i")
        expect(error_or_zero).to_be_visible(timeout=10000)

    def test_invalid_file_handling(self, page: Page, helpers: E2EHelpers, tmp_path: Path):
        """Test handling of invalid file format."""
        # Create invalid file
        invalid_file = tmp_path / "invalid.txt"
        invalid_file.write_text("This is not a CSV file")

        page.goto("/import")
        page.wait_for_load_state("networkidle")

        page.set_input_files("input[type='file']", str(invalid_file))
        page.locator("button:has-text('Preview'), button:has-text('Upload')").click()
        page.wait_for_load_state("networkidle")

        # Should show error message
        error = page.locator("text=/error|invalid|failed|unable/i")
        expect(error).to_be_visible(timeout=10000)
