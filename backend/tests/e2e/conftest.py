"""
End-to-end test fixtures using Playwright.

These tests validate the full application workflow by:
1. Connecting to running backend and frontend servers
2. Using Playwright to interact with the UI
3. Verifying data flows correctly through the entire stack

USAGE:
    1. Start servers in one terminal: make dev
    2. Run tests in another: make test-e2e
"""

import os
import time
from pathlib import Path
from typing import Generator

import pytest
from playwright.sync_api import Browser, BrowserContext, Page, Playwright, sync_playwright

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
TEST_DATA_DIR = PROJECT_ROOT / "data" / "anonymized"

# Server configuration - uses standard dev ports
BACKEND_PORT = int(os.environ.get("E2E_BACKEND_PORT", "8000"))
FRONTEND_PORT = int(os.environ.get("E2E_FRONTEND_PORT", "3000"))
BACKEND_URL = f"http://localhost:{BACKEND_PORT}"
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"


def check_servers_running() -> tuple[bool, bool]:
    """Check if backend and frontend servers are running."""
    import httpx

    backend_ok = False
    frontend_ok = False

    try:
        response = httpx.get(f"{BACKEND_URL}/api/v1/transactions", timeout=2)
        # 307 is redirect (trailing slash), which means server is running
        backend_ok = response.status_code in (200, 307, 404, 500)
    except Exception:
        pass

    try:
        response = httpx.get(FRONTEND_URL, timeout=2)
        frontend_ok = response.status_code == 200
    except Exception:
        pass

    return backend_ok, frontend_ok


@pytest.fixture(scope="session", autouse=True)
def verify_servers():
    """Verify that backend and frontend servers are running before tests."""
    backend_ok, frontend_ok = check_servers_running()

    if not backend_ok:
        pytest.exit(
            f"\n\nBackend server not running at {BACKEND_URL}\n"
            f"Start it with: make backend\n"
            f"Or run: make dev (starts both)\n"
        )

    if not frontend_ok:
        pytest.exit(
            f"\n\nFrontend server not running at {FRONTEND_URL}\n"
            f"Start it with: make frontend\n"
            f"Or run: make dev (starts both)\n"
        )


@pytest.fixture(scope="session")
def playwright_instance() -> Generator[Playwright, None, None]:
    """Session-scoped Playwright instance."""
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope="session")
def browser(playwright_instance: Playwright) -> Generator[Browser, None, None]:
    """Session-scoped browser instance."""
    browser = playwright_instance.chromium.launch(
        headless=os.environ.get("E2E_HEADED", "").lower() != "true",
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    yield browser
    browser.close()


@pytest.fixture(scope="function")
def context(browser: Browser) -> Generator[BrowserContext, None, None]:
    """Function-scoped browser context (isolated per test)."""
    context = browser.new_context(
        viewport={"width": 1280, "height": 720},
        base_url=FRONTEND_URL,
    )
    yield context
    context.close()


@pytest.fixture(scope="function")
def page(context: BrowserContext) -> Generator[Page, None, None]:
    """Function-scoped page."""
    page = context.new_page()
    page.set_default_timeout(10000)  # 10 second timeout
    yield page
    page.close()


@pytest.fixture(scope="session")
def test_data_files() -> dict[str, Path]:
    """Paths to anonymized test data files."""
    files = {}
    for csv_file in TEST_DATA_DIR.glob("*_anon.csv"):
        # Extract format from filename: bofa_bank_anon.csv -> bofa_bank
        name = csv_file.stem.replace("_anon", "")
        files[name] = csv_file
    return files


@pytest.fixture(scope="function")
def clean_database():
    """Reset database before each test (for isolation)."""
    # For now, we rely on the running database
    # Could add API calls to clear data if needed
    yield


# Helper functions for tests
class E2EHelpers:
    """Helper methods for E2E tests."""

    @staticmethod
    def wait_for_toast(page: Page, text: str, timeout: int = 5000):
        """Wait for a toast notification with specific text."""
        page.wait_for_selector(f"text={text}", timeout=timeout)

    @staticmethod
    def wait_for_loading_complete(page: Page, timeout: int = 10000):
        """Wait for any loading indicators to disappear."""
        # Wait for common loading patterns
        page.wait_for_load_state("networkidle", timeout=timeout)

    @staticmethod
    def get_table_row_count(page: Page, table_selector: str = "table tbody tr") -> int:
        """Count rows in a table."""
        return page.locator(table_selector).count()

    @staticmethod
    def upload_file(page: Page, input_selector: str, file_path: Path):
        """Upload a file to a file input."""
        page.set_input_files(input_selector, str(file_path))

    @staticmethod
    def select_dropdown(page: Page, selector: str, value: str):
        """Select a value from a dropdown."""
        page.select_option(selector, value)

    @staticmethod
    def fill_form_field(page: Page, selector: str, value: str):
        """Fill a form field."""
        page.fill(selector, value)

    @staticmethod
    def click_button(page: Page, text: str):
        """Click a button by text content."""
        page.click(f"button:has-text('{text}')")

    @staticmethod
    def navigate_to(page: Page, path: str):
        """Navigate to a specific page path."""
        page.goto(path)
        page.wait_for_load_state("networkidle")


@pytest.fixture(scope="session")
def helpers() -> E2EHelpers:
    """E2E helper methods."""
    return E2EHelpers()


# Pytest configuration
def pytest_configure(config):
    """Configure pytest markers for E2E tests."""
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow-running"
    )
