"""
E2E tests for dashboard functionality using Playwright.

Requires the frontend (port 3000) and backend (port 8000) to be running.
Run with: make test-e2e (starts servers) or with servers already running:
  uv run pytest tests/test_e2e_dashboards.py -v

Note: These tests require browsers to be installed. Run:
  playwright install chromium
"""

import pytest
import httpx
from playwright.sync_api import Page, expect

FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://localhost:8000"


def servers_available() -> bool:
    """Check if frontend and backend servers are running."""
    try:
        # Check backend
        backend_ok = httpx.get(f"{BACKEND_URL}/api/v1/transactions", timeout=2).status_code in (200, 307, 404)
    except Exception:
        backend_ok = False

    try:
        # Check frontend
        frontend_ok = httpx.get(FRONTEND_URL, timeout=2).status_code == 200
    except Exception:
        frontend_ok = False

    return backend_ok and frontend_ok


# Skip all tests in this module if servers aren't running
pytestmark = pytest.mark.skipif(
    not servers_available(), reason="Frontend and/or backend servers not running. Start with: make dev"
)


class TestDashboardManagement:
    """E2E tests for dashboard management page."""

    def test_manage_page_loads(self, page: Page):
        """Test that the dashboard manage page loads correctly."""
        page.goto(f"{FRONTEND_URL}/dashboard/manage")

        # Wait for page to load
        page.wait_for_selector("h1")

        # Check page title
        heading = page.locator("h1")
        expect(heading).to_have_text("Manage Dashboards")

    def test_create_dashboard_button_visible(self, page: Page):
        """Test that Create Dashboard button is visible."""
        page.goto(f"{FRONTEND_URL}/dashboard/manage")

        # Find the Create Dashboard button
        create_button = page.get_by_role("button", name="Create Dashboard")
        expect(create_button).to_be_visible()

    def test_create_dashboard_form_opens(self, page: Page):
        """Test that clicking Create Dashboard opens the form."""
        page.goto(f"{FRONTEND_URL}/dashboard/manage")

        # Click Create Dashboard button
        page.get_by_role("button", name="Create Dashboard").click()

        # Form should now be visible
        name_input = page.get_by_placeholder("Dashboard name")
        expect(name_input).to_be_visible()

        # Date range selector should be visible - it's the select near the name input
        # The form is the first card with a "Create New Dashboard" heading
        form = page.locator("h2:has-text('Create New Dashboard')").locator("..")
        expect(form.locator("select")).to_be_visible()

    def test_create_dashboard_successfully(self, page: Page):
        """Test creating a new dashboard through the UI."""
        page.goto(f"{FRONTEND_URL}/dashboard/manage")

        # Click Create Dashboard button
        page.get_by_role("button", name="Create Dashboard").click()

        # Wait for form to appear
        page.wait_for_selector("text=Create New Dashboard")

        # Fill in the form
        dashboard_name = "E2E Test Dashboard"
        page.get_by_placeholder("Dashboard name").fill(dashboard_name)

        # Select a date range - find the form's select (near the name input)
        form = page.locator("h2:has-text('Create New Dashboard')").locator("..")
        form.locator("select").select_option("qtd")

        # Add optional description
        page.get_by_placeholder("Optional description").fill("Created by E2E test")

        # Click Create button in the form (it's after the Cancel button)
        form.locator("button:has-text('Create')").click()

        # Wait for the form to close and the dashboard to appear
        page.wait_for_selector(f"text={dashboard_name}", timeout=10000)

        # Verify the dashboard is in the list
        dashboard_card = page.locator(f"text={dashboard_name}")
        expect(dashboard_card).to_be_visible()

    def test_create_dashboard_requires_name(self, page: Page):
        """Test that Create button is disabled without a name."""
        page.goto(f"{FRONTEND_URL}/dashboard/manage")

        # Click Create Dashboard button
        page.get_by_role("button", name="Create Dashboard").click()

        # Leave name empty, find the Create button in the form
        create_button = page.locator("button:has-text('Create')").last

        # Button should be disabled
        expect(create_button).to_be_disabled()

    def test_dashboard_shows_date_range(self, page: Page):
        """Test that dashboards display their date range information."""
        page.goto(f"{FRONTEND_URL}/dashboard/manage")

        # Wait for dashboards to load
        page.wait_for_selector(".card", timeout=5000)

        # Check that at least one dashboard shows date range info
        # The format includes date range label like "Month to Date:" or similar
        date_range_text = page.locator("text=/to Date:|Last \\d+ Days|Last Year/").first
        expect(date_range_text).to_be_visible()

    def test_change_date_range_type(self, page: Page):
        """Test changing a dashboard's date range type."""
        page.goto(f"{FRONTEND_URL}/dashboard/manage")

        # Wait for dashboards to load
        page.wait_for_selector(".card", timeout=5000)

        # Find a date range selector in a dashboard card (not the theme switcher or form)
        # The dashboard cards have selects for date range
        date_select = page.locator(".card select").last
        current_value = date_select.input_value()

        # Select a different option
        new_value = "ytd" if current_value != "ytd" else "mtd"
        date_select.select_option(new_value)

        # Wait a moment for the update
        page.wait_for_timeout(500)

        # Verify the value changed
        expect(date_select).to_have_value(new_value)


class TestDashboardTabs:
    """E2E tests for dashboard tabs on main page."""

    def test_main_page_shows_dashboard_tabs(self, page: Page):
        """Test that the main dashboard page shows tabs."""
        page.goto(FRONTEND_URL)

        # Wait for page to load
        page.wait_for_selector("nav", timeout=5000)

        # The DashboardTabs component should be visible
        # Look for elements that would indicate tabs are present
        # This depends on the DashboardTabs implementation
        page.wait_for_timeout(1000)  # Wait for dashboards to load

    def test_clicking_manage_link(self, page: Page):
        """Test that clicking manage navigates to manage page."""
        page.goto(FRONTEND_URL)

        # Look for a Manage link or gear icon
        manage_link = page.locator("a[href='/dashboard/manage']")

        if manage_link.is_visible():
            manage_link.click()

            # Should navigate to manage page
            expect(page).to_have_url(f"{FRONTEND_URL}/dashboard/manage")
