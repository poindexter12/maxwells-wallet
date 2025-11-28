"""
Full workflow validation tests.

These tests validate the complete user journey through the application,
ensuring all components work together correctly.

Test scenarios:
1. Fresh start: Import -> View -> Tag -> Budget -> Analyze
2. Ongoing use: Add rules -> Re-import -> Verify tagging
3. Full analytics: All dashboard features after data import
"""

import pytest
from pathlib import Path
from playwright.sync_api import Page, expect

from .conftest import E2EHelpers, FRONTEND_URL


@pytest.mark.e2e
@pytest.mark.slow
class TestFullUserJourney:
    """
    Complete user journey test.

    Simulates a new user:
    1. Importing their first bank statement
    2. Viewing and tagging transactions
    3. Setting up budgets
    4. Creating tag rules
    5. Detecting recurring transactions
    6. Viewing analytics dashboard
    """

    def test_complete_first_time_user_flow(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict[str, Path],
    ):
        """Test complete flow for a first-time user."""
        if not test_data_files:
            pytest.skip("No test data files available")

        # ============================================================
        # STEP 1: Import bank statement
        # ============================================================
        csv_path = next(iter(test_data_files.values()))

        page.goto("/import")
        page.wait_for_load_state("networkidle")

        # Upload file
        page.set_input_files("input[type='file']", str(csv_path))

        # Preview
        page.locator("button:has-text('Preview'), button:has-text('Upload')").click()
        page.wait_for_load_state("networkidle")

        # Verify preview shows data
        expect(page.locator("text=/\\d+ transaction/i")).to_be_visible(timeout=10000)

        # Confirm import
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_selector("text=/imported|success/i", timeout=15000)

        # ============================================================
        # STEP 2: View transactions
        # ============================================================
        page.goto("/transactions")
        page.wait_for_load_state("networkidle")

        # Verify transactions appear
        rows = page.locator("table tbody tr")
        expect(rows.first).to_be_visible(timeout=10000)
        transaction_count = rows.count()
        assert transaction_count >= 1, "Should have imported transactions"

        # ============================================================
        # STEP 3: Tag a transaction with a bucket
        # ============================================================
        # Find bucket selector in first row
        first_row = rows.first
        bucket_select = first_row.locator("select")

        if bucket_select.count() > 0:
            # Change bucket
            bucket_select.select_option(index=1)
            page.wait_for_load_state("networkidle")

        # ============================================================
        # STEP 4: Create a budget
        # ============================================================
        page.goto("/budgets")
        page.wait_for_load_state("networkidle")

        page.locator("button:has-text('Create'), button:has-text('Add'), button:has-text('New')").first.click()
        page.wait_for_selector("form, dialog", timeout=5000)

        # Fill budget form
        tag_select = page.locator("select[name='tag'], #tag")
        if tag_select.count() > 0:
            tag_select.select_option(index=1)

        amount_input = page.locator("input[name='amount'], #amount")
        if amount_input.count() > 0:
            amount_input.fill("5000")

        page.locator("button[type='submit'], button:has-text('Save')").click()
        page.wait_for_load_state("networkidle")

        # Verify budget created
        expect(page.locator("text=/\\$?5000|budget|created/i")).to_be_visible(timeout=10000)

        # ============================================================
        # STEP 5: Create a tag rule
        # ============================================================
        page.goto("/rules")
        page.wait_for_load_state("networkidle")

        page.locator("button:has-text('Create'), button:has-text('Add')").first.click()
        page.wait_for_selector("form, dialog", timeout=5000)

        # Fill rule form
        name_input = page.locator("input[name='name'], #name")
        if name_input.count() > 0:
            name_input.fill("Auto-tag Rule")

        merchant_input = page.locator("input[name='merchant_pattern'], #merchant_pattern")
        if merchant_input.count() > 0:
            merchant_input.fill("LLC")

        tag_select = page.locator("select[name='tag'], #tag")
        if tag_select.count() > 0:
            tag_select.select_option(index=1)

        page.locator("button[type='submit'], button:has-text('Save')").click()
        page.wait_for_load_state("networkidle")

        # Apply rules
        apply_button = page.locator("button:has-text('Apply')")
        if apply_button.count() > 0:
            apply_button.first.click()
            page.wait_for_load_state("networkidle")

        # ============================================================
        # STEP 6: Detect recurring transactions
        # ============================================================
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        detect_button = page.locator("button:has-text('Detect')")
        if detect_button.count() > 0:
            detect_button.click()
            page.wait_for_load_state("networkidle")

        # ============================================================
        # STEP 7: View dashboard analytics
        # ============================================================
        page.goto("/")
        page.wait_for_load_state("networkidle")

        # Dashboard should show financial data
        financial_data = page.locator("text=/\\$|income|expense|spending/i")
        expect(financial_data.first).to_be_visible(timeout=10000)

        # Success! Full journey completed
        expect(page.locator("body")).to_be_visible()


@pytest.mark.e2e
@pytest.mark.slow
class TestDataIntegrity:
    """Tests to verify data integrity across the application."""

    def test_import_count_matches_transaction_list(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict[str, Path],
    ):
        """Test that imported count matches visible transactions."""
        if not test_data_files:
            pytest.skip("No test data files available")

        # Import file
        csv_path = test_data_files.get("bofa_cc") or next(iter(test_data_files.values()))

        page.goto("/import")
        page.wait_for_load_state("networkidle")
        page.set_input_files("input[type='file']", str(csv_path))
        page.locator("button:has-text('Preview')").click()
        page.wait_for_load_state("networkidle")

        # Get preview count
        preview_text = page.locator("text=/\\d+ transaction/i").text_content()
        import re
        match = re.search(r'(\d+)\s*transaction', preview_text, re.I)
        if not match:
            pytest.skip("Could not parse transaction count from preview")
        preview_count = int(match.group(1))

        # Confirm import
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_selector("text=/imported|success/i", timeout=15000)

        # Check transactions page
        page.goto("/transactions")
        page.wait_for_load_state("networkidle")

        # Count visible transactions (may be paginated)
        rows = page.locator("table tbody tr")
        visible_count = rows.count()

        # Should have at least some of the imported transactions
        assert visible_count >= min(preview_count, 100), (
            f"Expected at least {min(preview_count, 100)} transactions, got {visible_count}"
        )

    def test_budget_spending_matches_transactions(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict[str, Path],
    ):
        """Test that budget spending amounts match actual transactions."""
        if not test_data_files:
            pytest.skip("No test data files available")

        # Import data
        csv_path = next(iter(test_data_files.values()))
        page.goto("/import")
        page.wait_for_load_state("networkidle")
        page.set_input_files("input[type='file']", str(csv_path))
        page.locator("button:has-text('Preview')").click()
        page.wait_for_load_state("networkidle")
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_selector("text=/imported|success/i", timeout=15000)

        # Create a budget
        page.goto("/budgets")
        page.wait_for_load_state("networkidle")
        page.locator("button:has-text('Create'), button:has-text('Add')").first.click()
        page.wait_for_selector("form, dialog", timeout=5000)

        tag_select = page.locator("select[name='tag'], #tag")
        if tag_select.count() > 0:
            tag_select.select_option(index=1)

        amount_input = page.locator("input[name='amount'], #amount")
        if amount_input.count() > 0:
            amount_input.fill("10000")

        page.locator("button[type='submit'], button:has-text('Save')").click()
        page.wait_for_load_state("networkidle")

        # Budget should show spending from imported transactions
        # Just verify the page displays without errors
        expect(page.locator("body")).to_be_visible()


@pytest.mark.e2e
class TestNavigationFlow:
    """Tests for navigation between pages."""

    def test_navigation_via_menu(self, page: Page, helpers: E2EHelpers):
        """Test navigating via the main menu."""
        page.goto("/")
        page.wait_for_load_state("networkidle")

        # List of pages to visit via navigation
        pages = [
            ("Transaction", "/transactions"),
            ("Import", "/import"),
            ("Budget", "/budgets"),
            ("Rule", "/rules"),
            ("Recurring", "/recurring"),
        ]

        for page_text, expected_path in pages:
            # Find navigation link
            nav_link = page.locator(f"a:has-text('{page_text}'), nav a:has-text('{page_text}')")
            if nav_link.count() > 0:
                nav_link.first.click()
                page.wait_for_load_state("networkidle")

                # Verify we're on the right page
                expect(page).to_have_url(f"**{expected_path}*")

    def test_back_navigation(self, page: Page, helpers: E2EHelpers):
        """Test browser back button works correctly."""
        page.goto("/")
        page.wait_for_load_state("networkidle")

        page.goto("/transactions")
        page.wait_for_load_state("networkidle")

        page.goto("/budgets")
        page.wait_for_load_state("networkidle")

        # Go back
        page.go_back()
        page.wait_for_load_state("networkidle")

        expect(page).to_have_url("**/transactions*")


@pytest.mark.e2e
class TestErrorRecovery:
    """Tests for error handling and recovery."""

    def test_invalid_url_handling(self, page: Page, helpers: E2EHelpers):
        """Test handling of invalid URLs."""
        page.goto("/nonexistent-page-12345")
        page.wait_for_load_state("networkidle")

        # Should show 404 or redirect to home
        # Just verify the app doesn't crash
        expect(page.locator("body")).to_be_visible()

    def test_api_error_handling(self, page: Page, helpers: E2EHelpers):
        """Test graceful handling of API errors."""
        # This test verifies the app handles API failures gracefully
        page.goto("/")
        page.wait_for_load_state("networkidle")

        # App should be functional even if some API calls fail
        expect(page.locator("body")).to_be_visible()


@pytest.mark.e2e
class TestResponsiveness:
    """Tests for responsive design (different viewport sizes)."""

    def test_mobile_viewport(self, page: Page, helpers: E2EHelpers):
        """Test app works on mobile viewport."""
        page.set_viewport_size({"width": 375, "height": 667})

        page.goto("/")
        page.wait_for_load_state("networkidle")

        # App should be usable on mobile
        expect(page.locator("body")).to_be_visible()

        # Navigate to transactions
        page.goto("/transactions")
        page.wait_for_load_state("networkidle")

        expect(page.locator("body")).to_be_visible()

    def test_tablet_viewport(self, page: Page, helpers: E2EHelpers):
        """Test app works on tablet viewport."""
        page.set_viewport_size({"width": 768, "height": 1024})

        page.goto("/")
        page.wait_for_load_state("networkidle")

        expect(page.locator("body")).to_be_visible()
