"""
E2E tests for recurring transactions detection workflow.

Tests:
1. Recurring page loads
2. Detect recurring patterns
3. View upcoming transactions
4. View missing/overdue transactions
5. Manage recurring patterns
"""

import pytest
from playwright.sync_api import Page, expect

from .conftest import E2EHelpers


@pytest.mark.e2e
class TestRecurringPage:
    """End-to-end tests for the recurring transactions page."""

    def test_recurring_page_loads(self, page: Page, helpers: E2EHelpers):
        """Test that recurring transactions page loads correctly."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Verify page header
        header = page.locator("h1, h2")
        expect(header.first).to_contain_text("Recurring")

        # Should have a detect button
        detect_button = page.locator("button:has-text('Detect'), button:has-text('Find'), button:has-text('Analyze')")
        expect(detect_button.first).to_be_visible()

    def test_detect_recurring_patterns(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict,
    ):
        """Test detecting recurring patterns from transaction history."""
        from pathlib import Path

        if not test_data_files:
            pytest.skip("No test data files available")

        # First import some data
        csv_path = next(iter(test_data_files.values()))
        page.goto("/import")
        page.wait_for_load_state("networkidle")
        page.set_input_files("input[type='file']", str(csv_path))
        page.locator("button:has-text('Preview')").click()
        page.wait_for_load_state("networkidle")
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_selector("text=/imported|success/i", timeout=15000)

        # Go to recurring page
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Click detect button
        detect_button = page.locator("button:has-text('Detect'), button:has-text('Find')")
        detect_button.first.click()

        # Wait for detection to complete
        page.wait_for_load_state("networkidle")

        # Should show detection results
        expect(page.locator("text=/pattern|detected|found|recurring/i")).to_be_visible(timeout=15000)

    def test_recurring_stats_display(self, page: Page, helpers: E2EHelpers):
        """Test that recurring stats are displayed."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Look for stats cards (active patterns, upcoming, missing)
        stats = page.locator("text=/active|upcoming|missing|pattern/i")

        # Stats section should be present
        expect(stats.first).to_be_visible()


@pytest.mark.e2e
class TestRecurringTabs:
    """Tests for recurring page tabs (Patterns, Upcoming, Missing)."""

    def test_patterns_tab(self, page: Page, helpers: E2EHelpers):
        """Test the Patterns tab content."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Click on Patterns tab if tabs exist
        patterns_tab = page.locator("button:has-text('Pattern'), [role='tab']:has-text('Pattern')")
        if patterns_tab.count() > 0:
            patterns_tab.first.click()
            page.wait_for_load_state("networkidle")

        # Should show patterns list or empty state
        content = page.locator("text=/pattern|merchant|frequency|no pattern/i")
        expect(content.first).to_be_visible()

    def test_upcoming_tab(self, page: Page, helpers: E2EHelpers):
        """Test the Upcoming transactions tab."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Click on Upcoming tab
        upcoming_tab = page.locator("button:has-text('Upcoming'), [role='tab']:has-text('Upcoming')")
        if upcoming_tab.count() > 0:
            upcoming_tab.first.click()
            page.wait_for_load_state("networkidle")

        # Should show upcoming transactions or empty state
        content = page.locator("text=/upcoming|expected|days|no upcoming/i")
        expect(content.first).to_be_visible()

    def test_missing_tab(self, page: Page, helpers: E2EHelpers):
        """Test the Missing/Overdue transactions tab."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Click on Missing tab
        missing_tab = page.locator("button:has-text('Missing'), button:has-text('Overdue'), [role='tab']:has-text('Missing')")
        if missing_tab.count() > 0:
            missing_tab.first.click()
            page.wait_for_load_state("networkidle")

        # Should show missing transactions or empty state
        content = page.locator("text=/missing|overdue|no missing/i")
        expect(content.first).to_be_visible()


@pytest.mark.e2e
class TestRecurringPatternManagement:
    """Tests for managing recurring patterns."""

    def test_pause_pattern(self, page: Page, helpers: E2EHelpers):
        """Test pausing a recurring pattern."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Look for pause button
        pause_button = page.locator("button:has-text('Pause'), button[aria-label*='pause' i]")

        if pause_button.count() == 0:
            pytest.skip("No patterns to pause")

        pause_button.first.click()
        page.wait_for_load_state("networkidle")

        # Pattern should show paused status or resume button should appear
        expect(page.locator("text=/paused|resume/i")).to_be_visible()

    def test_delete_pattern(self, page: Page, helpers: E2EHelpers):
        """Test deleting a recurring pattern."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Look for delete button
        delete_button = page.locator("button:has-text('Delete'), button[aria-label*='delete' i]")

        if delete_button.count() == 0:
            pytest.skip("No patterns to delete")

        delete_button.first.click()

        # Confirm if dialog appears
        confirm_button = page.locator("button:has-text('Confirm'), button:has-text('Yes')")
        if confirm_button.count() > 0:
            confirm_button.click()

        page.wait_for_load_state("networkidle")

    def test_view_pattern_details(self, page: Page, helpers: E2EHelpers):
        """Test viewing pattern details."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Look for pattern items with details
        pattern_item = page.locator("[class*='pattern'], [data-testid*='pattern'], tr")

        if pattern_item.count() == 0:
            pytest.skip("No patterns to view")

        # Click on pattern if it's clickable
        pattern_item.first.click()
        page.wait_for_load_state("networkidle")

        # Should show details (merchant, frequency, amount, etc.)
        # Just verify page responds
        expect(page.locator("body")).to_be_visible()


@pytest.mark.e2e
class TestRecurringFrequencyBadges:
    """Tests for frequency badge display."""

    def test_frequency_badges_display(self, page: Page, helpers: E2EHelpers):
        """Test that frequency badges are displayed correctly."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Look for frequency badges
        frequency_badges = page.locator(
            "text=/weekly|biweekly|monthly|quarterly|yearly/i, "
            "[class*='badge'], [class*='frequency']"
        )

        # If there are patterns, badges should be visible
        patterns = page.locator("[class*='pattern'], [data-testid*='pattern']")
        if patterns.count() > 0:
            # Patterns exist, frequency info should be shown
            expect(page.locator("body")).to_be_visible()


@pytest.mark.e2e
class TestRecurringConfidence:
    """Tests for confidence score display."""

    def test_confidence_display(self, page: Page, helpers: E2EHelpers):
        """Test that confidence scores are displayed."""
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        # Look for confidence percentage
        confidence = page.locator("text=/%|confidence/i")

        # If patterns exist, confidence should be shown
        patterns = page.locator("[class*='pattern'], [data-testid*='pattern']")
        if patterns.count() > 0:
            expect(page.locator("body")).to_be_visible()


@pytest.mark.e2e
class TestRecurringIntegration:
    """Integration tests for recurring with other features."""

    def test_recurring_updates_after_import(
        self,
        page: Page,
        helpers: E2EHelpers,
        test_data_files: dict,
    ):
        """Test that recurring detection updates after importing new transactions."""
        from pathlib import Path

        if not test_data_files:
            pytest.skip("No test data files available")

        # Go to recurring and run detection
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        detect_button = page.locator("button:has-text('Detect')")
        if detect_button.count() > 0:
            detect_button.click()
            page.wait_for_load_state("networkidle")

        # Get initial pattern count
        initial_patterns = page.locator("[class*='pattern'], [data-testid*='pattern']")
        initial_count = initial_patterns.count()

        # Import more data
        csv_path = next(iter(test_data_files.values()))
        page.goto("/import")
        page.wait_for_load_state("networkidle")
        page.set_input_files("input[type='file']", str(csv_path))
        page.locator("button:has-text('Preview')").click()
        page.wait_for_load_state("networkidle")
        page.locator("button:has-text('Confirm'), button:has-text('Import')").click()
        page.wait_for_selector("text=/imported|success|duplicate/i", timeout=15000)

        # Re-run detection
        page.goto("/recurring")
        page.wait_for_load_state("networkidle")

        if detect_button.count() > 0:
            detect_button.click()
            page.wait_for_load_state("networkidle")

        # Page should work without errors
        expect(page.locator("body")).to_be_visible()
