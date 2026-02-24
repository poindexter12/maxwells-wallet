# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Frontend Runner:**
- Vitest 4.0+ with jsdom environment
- Config: `frontend/vitest.config.ts`
- Globals enabled (describe, it, expect available without imports)

**Frontend Assertion Library:**
- Vitest (uses Chai assertions)
- `@testing-library/react` for component testing
- `@testing-library/jest-dom` for DOM matchers

**Backend Runner:**
- pytest 7.4+ with pytest-asyncio plugin
- Config: `backend/pyproject.toml` (markers: `performance`, `slow`)
- AsyncIO mode: auto-detection

**Backend Assertion Library:**
- pytest assertions (standard `assert` statements)

**Run Commands:**
```bash
# Frontend - unit/component tests
npm run test              # Watch mode
npm run test:run          # Single run
npm run test:coverage     # With V8 coverage report

# Frontend - E2E tests
npm run test:e2e          # Headless
npm run test:e2e:ui       # Interactive UI mode

# Backend - all tests
uv run pytest             # Watch (if configured)
uv run pytest -k "not slow"  # Skip slow tests
uv run pytest -m "not performance"  # Skip performance tests

# Backend - with coverage
uv run pytest --cov=app --cov-report=term-missing
```

## Test File Organization

**Location:**
- Frontend: Colocated with source (e.g., `components/NavBar.tsx` → `components/NavBar.test.tsx`)
- Backend: Separate `tests/` directory at repo root (e.g., `tests/test_tags.py`)

**Naming:**
- Frontend: `{ComponentName}.test.tsx` or `{module}.test.ts`
- Backend: `test_{module}.py` (pytest convention)
- E2E: `{feature}.spec.ts` in `frontend/e2e/` directory

**Structure:**
```
frontend/
├── src/
│   ├── components/
│   │   ├── NavBar.tsx
│   │   └── NavBar.test.tsx
│   ├── contexts/
│   │   ├── DashboardContext.tsx
│   │   └── DashboardContext.test.tsx
│   └── test/
│       ├── setup.ts          # Global test setup
│       ├── mocks/
│       │   ├── server.ts      # MSW server instance
│       │   └── handlers.ts    # MSW request handlers

backend/
├── tests/
│   ├── test_auth.py
│   ├── test_tags.py
│   ├── test_dashboard.py
│   └── conftest.py           # Pytest fixtures
```

## Test Structure

**Frontend Unit/Component Test:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardProvider, useDashboard } from './DashboardContext'

// Test component that exposes context for testing
function TestConsumer({ onMount }: { onMount?: (ctx: ReturnType<typeof useDashboard>) => void }) {
  const ctx = useDashboard()
  if (onMount) onMount(ctx)
  return <div data-testid="status">{ctx.loading ? 'loading' : 'loaded'}</div>
}

describe('DashboardContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial loading', () => {
    it('shows loading state initially', async () => {
      render(<DashboardProvider><TestConsumer /></DashboardProvider>)
      expect(screen.getByTestId('status')).toHaveTextContent('loading')

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('loaded')
      })
    })
  })
})
```

**Patterns:**
- Use `data-testid` for element selection (translation-agnostic)
- Use `waitFor()` for async operations
- Use `act()` wrapper for state updates outside render
- Create test consumer components to expose hook state

**Backend Test Structure:**
```python
"""Tests for Tags API (v0.4)"""

import pytest
from httpx import AsyncClient

class TestTags:
    """Tags API Tests"""

    @pytest.mark.asyncio
    async def test_list_tags(self, client: AsyncClient, seed_tags):
        """List all tags"""
        response = await client.get("/api/v1/tags/")
        assert response.status_code == 200
        data = response.json()

        assert len(data) > 0
        assert any(t["namespace"] == "bucket" for t in data)

    @pytest.mark.asyncio
    async def test_get_tag_by_id(self, client: AsyncClient, seed_tags):
        """Get a tag by ID"""
        list_response = await client.get("/api/v1/tags/")
        tags = list_response.json()
        tag_id = tags[0]["id"]

        response = await client.get(f"/api/v1/tags/{tag_id}")
        assert response.status_code == 200
        assert response.json()["id"] == tag_id
```

**Patterns:**
- Organize tests into classes by feature/endpoint
- Use descriptive docstrings for test purpose
- Decorate async tests with `@pytest.mark.asyncio`
- Use fixtures (`client`, `seed_tags`) for setup
- Assert both status code and response data

## Mocking

**Frontend Framework:** MSW (Mock Service Worker)
- Server instance: `frontend/src/test/mocks/server.ts`
- Request handlers: `frontend/src/test/mocks/handlers.ts`
- Setup in `frontend/src/test/setup.ts` (runs before all tests)

**Mocking Pattern:**
```typescript
// vi.mock creates module-level mocks
vi.mock('@/contexts/DashboardContext', () => ({
  useDashboard: () => ({
    dashboards: mockDashboards,
    currentDashboard: mockDashboards[0],
    setCurrentDashboard: vi.fn(),
    createDashboard: vi.fn(),
    loading: false,
  }),
}))

// vi.fn() creates spies/mocks for functions
const mockSetCurrentDashboard = vi.fn()

// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

// Assert mock calls
expect(mockSetCurrentDashboard).toHaveBeenCalledWith(expectedDashboard)
```

**What to Mock:**
- Context providers and hooks (DashboardContext, AuthContext)
- External API calls (via MSW handlers)
- Third-party libraries with side effects (recharts, complex UI libs)
- Browser APIs (localStorage via window mock)

**What NOT to Mock:**
- Utility functions and helpers (test real implementation)
- React hooks like useState, useEffect (test behavior)
- Page components using context (use real provider instead)
- Component composition (test integrated behavior)

**Backend Framework:** pytest fixtures + freezegun for time
```python
# In conftest.py
@pytest.fixture
async def client(session):
    """Async HTTP client for testing API endpoints"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
def seed_tags(session):
    """Create test tags for tag tests"""
    tags = [
        Tag(namespace="bucket", value="groceries", ...),
        Tag(namespace="bucket", value="entertainment", ...),
    ]
    session.add_all(tags)
    session.commit()
    return tags

# In test
from freezegun import freeze_time
@freeze_time("2024-12-06")
def test_date_ranges():
    # Test with fixed date
    pass
```

## Fixtures and Factories

**Test Data (Frontend):**
```typescript
// In test files - inline mock data
const mockDashboards = [
  {
    id: 1,
    name: 'Default',
    date_range_type: 'mtd',
    date_range: { label: 'Month to Date', start: '2024-12-01', end: '2024-12-06' },
    is_default: true,
  },
  {
    id: 2,
    name: 'Yearly',
    date_range_type: 'ytd',
    date_range: { label: 'Year to Date', start: '2024-01-01', end: '2024-12-06' },
    is_default: false,
  },
]

// Helper functions for setup
function TestConsumer({ onMount }: { onMount?: (ctx) => void }) {
  // Component that exposes state for testing
}
```

**Test Data (Backend):**
- Location: `backend/tests/conftest.py` (pytest fixtures)
- Fixtures provide `client`, `session`, `seed_tags`, etc.
- Seed functions in routers (e.g., `resetMockDashboards()` in handlers.ts)

**Coverage:**
- Required: 70% lines, branches, functions, statements (enforced by Vitest config)
- Report: `frontend/vitest.config.ts` → `coverage: { reporter: ['text', 'json', 'html'] }`
- View coverage: Open `coverage/index.html` after `npm run test:coverage`
- Backend coverage: `uv run pytest --cov=app` generates HTML report

## Test Types

**Frontend Unit Tests:**
- Scope: Individual functions, hooks, small components
- Approach: Vitest + React Testing Library
- Example: Test a context hook in isolation with mock provider

**Frontend Component Tests:**
- Scope: Components with props/state/effects
- Approach: Render with test harness, assert DOM state
- Example: `DashboardContext.test.tsx` - render provider, test all hook methods

**Frontend Integration Tests:**
- Scope: Multiple components + context + API
- Approach: E2E with Playwright (see E2E section)
- Example: Full user flow: login → dashboard → create item

**Frontend E2E Tests:**
- Framework: Playwright 1.58+
- Location: `frontend/e2e/*.spec.ts`
- Config: `frontend/playwright.config.ts` (or default Next.js config)
- Run: `npm run test:e2e` (headless) or `npm run test:e2e:ui` (interactive)

**E2E Pattern:**
```typescript
import { test, expect, ConsoleMessage } from '@playwright/test'

test.describe('Dashboard Tab Switching @e2e', () => {
  let consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
  })

  test('switches between tabs without error', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    await page.locator('[data-testid="dashboard-tab-2"]').click()
    await page.waitForTimeout(500)
    expect(consoleErrors).toHaveLength(0)
  })
})
```

**Backend Unit Tests:**
- Scope: Individual functions, utilities, business logic
- Approach: pytest with mock dependencies
- Example: Test auth utilities (`test_hash_password`, `test_verify_password`)

**Backend Integration Tests:**
- Scope: Full API endpoints with database
- Approach: pytest with fixtures, real database (SQLite in-memory)
- Example: `TestTags.test_list_tags` - call endpoint, verify response + DB state

## Common Patterns

**Async Testing (Frontend):**
```typescript
// Use act() for state updates, waitFor() for async effects
await act(async () => {
  await contextRef!.createDashboard({ name: 'New' })
})

await waitFor(() => {
  expect(screen.getByTestId('count')).toHaveTextContent('3')
})
```

**Async Testing (Backend):**
```python
@pytest.mark.asyncio
async def test_async_operation(self, client: AsyncClient):
    """All test methods are async, use await"""
    response = await client.get("/api/v1/endpoint")
    assert response.status_code == 200
```

**Error Testing (Frontend):**
```typescript
// Mock error response via MSW
server.use(
  http.get('/api/v1/endpoint', () => {
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  })
)

// Test error handling
await waitFor(() => {
  expect(screen.getByTestId('error')).toHaveTextContent('Not found')
})
```

**Error Testing (Backend):**
```python
@pytest.mark.asyncio
async def test_not_found(self, client: AsyncClient, seed_tags):
    """Non-existent resource returns 404"""
    response = await client.get("/api/v1/tags/by-name/bucket/nonexistent")
    assert response.status_code == 404
    assert response.json()["error_code"] == "TAG_NOT_FOUND"
```

**Test Isolation (Frontend):**
```typescript
beforeEach(() => {
  vi.clearAllMocks()  // Clear all mocks
  localStorageMock.getItem.mockClear()  // Reset specific mocks
})

afterEach(() => {
  server.resetHandlers()  // Reset MSW handlers to defaults
})
```

**Test Isolation (Backend):**
```python
class TestTags:
    @pytest.fixture(autouse=True)
    def setup(self, session):
        """Reset state before each test"""
        session.query(Tag).delete()
        session.commit()
        yield
        session.query(Tag).delete()
        session.commit()
```

## Test IDs (Critical for i18n)

**Always use `data-testid` for element selection - never rely on text content.**

**Central Registry:**
- Location: `frontend/src/test-ids.ts`
- Contains: `TEST_IDS` (normal elements), `CHAOS_EXCLUDED_IDS` (destructive actions)

**Pattern:**
```typescript
// In test-ids.ts
export const TEST_IDS = {
  FILTER_SEARCH: 'filter-search',
  FILTER_BUCKET: 'filter-bucket',
  TRANSACTIONS_LIST: 'transactions-list',
  DASHBOARD_PAGE: 'dashboard-page',
} as const

// In component
import { TEST_IDS } from '@/test-ids'
<input data-testid={TEST_IDS.FILTER_SEARCH} />

// In test
import { TEST_IDS } from '@/test-ids'
expect(screen.getByTestId(TEST_IDS.FILTER_SEARCH)).toBeInTheDocument()

// In E2E test
await page.locator(`[data-testid="${TEST_IDS.FILTER_SEARCH}"]`).fill('groceries')
```

**Naming Convention:**
- Format: `<component>-<element>` or `<page>-<element>`
- Examples: `filter-search`, `transactions-list`, `dashboard-page`, `help-dismiss`

---

*Testing analysis: 2026-02-24*
