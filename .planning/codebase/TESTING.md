# Testing Patterns

**Analysis Date:** 2026-02-23

## Test Framework

**Frontend (Unit & Component Tests):**
- Runner: Vitest 4.0.14
- Config: `frontend/vitest.config.ts`
- Environment: jsdom (browser simulation)
- Test library: @testing-library/react 16.3.2
- Assertion library: @testing-library/jest-dom (Vitest auto-imports globals: `describe`, `it`, `expect`, `beforeEach`, etc.)

**Frontend (E2E Tests):**
- Framework: Playwright 1.58.0
- Config: `frontend/playwright.config.ts`
- Test directory: `frontend/e2e/`
- Browsers: Chromium, Firefox, WebKit
- Runs against: Full stack (Next.js frontend on 3000, FastAPI backend on 3001)

**Backend (Unit & Integration Tests):**
- Runner: pytest 7.4.0
- Config: `backend/pyproject.toml` ([tool.pytest.ini_options])
- Async support: pytest-asyncio 0.21.0
- Database: In-memory SQLite for tests (`sqlite+aiosqlite:///:memory:`)
- Test directory: `backend/tests/`

**Run Commands:**

Frontend:
```bash
make test-frontend        # Run unit/component tests
make test-e2e            # Run E2E tests against live servers
make test-e2e-headed     # Run with visible browser
make test-e2e-debug      # Debug mode with PWDEBUG
make test-chaos          # Chaos/monkey tests
```

Backend:
```bash
make test-backend        # Run unit/integration tests
make test-coverage       # Run with coverage report
make test-perf           # Run performance tests
```

## Test File Organization

**Location:**

Frontend:
- Co-located: Test files live next to source files: `src/components/NavBar.tsx` → `src/components/NavBar.test.tsx`
- E2E tests: `frontend/e2e/` (separate directory structure)
- Setup: `src/test/setup.ts`

Backend:
- Separate: `backend/tests/` directory
- Organized by feature: `test_auth.py`, `test_transactions.py`, `test_tags.py`, `test_csv_import.py`, etc.

**Naming:**
- Frontend: `*.test.tsx`, `*.test.ts`, `*.spec.tsx`, `*.spec.ts`
- Backend: `test_*.py`

**Structure (Example):**
```
frontend/
├── src/
│   ├── components/
│   │   ├── NavBar.tsx
│   │   └── NavBar.test.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── AuthContext.test.tsx
│   │   └── DashboardContext.test.tsx
│   ├── test/
│   │   ├── setup.ts
│   │   ├── mocks/
│   │   │   └── server.ts
│   │   └── i18n.test.ts
│   └── app/(main)/
│       ├── page.tsx
│       └── page.test.tsx
└── e2e/
    ├── auth.setup.ts
    ├── test_chaos.ts
    └── test_import_workflow.py
```

## Test Structure

**Unit Test Pattern (Frontend - React):**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavBar } from './NavBar'

// Mock dependencies
const mockPathname = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}))

describe('NavBar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/')
  })

  it('renders the brand logo and name', () => {
    render(<NavBar />)
    expect(screen.getByText("Maxwell's Wallet")).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })
})
```

**Key Patterns:**
- Import `vi` from vitest for mocking
- Use `render()` from @testing-library/react
- Query with semantic role queries: `getByRole('link')`, `getByRole('button')`
- Use `data-testid` for elements without roles (see Test IDs section)
- Mock dependencies at top of file before describe blocks
- Use `beforeEach` to reset state between tests

**Unit Test Pattern (Backend - Python):**

```python
"""Tests for authentication workflow."""

import pytest
from httpx import AsyncClient

class TestAuthUtilities:
    """Test auth utility functions."""

    def test_hash_password_creates_hash(self):
        """Password hashing creates a bcrypt hash."""
        password = "testpassword123"
        hashed = hash_password(password)

        assert hashed != password
        assert hashed.startswith("$2b$")  # bcrypt prefix

class TestAuthStatus:
    """Test GET /api/v1/auth/status endpoint."""

    @pytest.mark.asyncio
    async def test_check_auth_with_valid_token(self, client: AsyncClient):
        """Valid token returns authenticated user."""
        # Setup via fixture, test via client
        response = await client.get("/api/v1/auth/status", ...)
        assert response.status_code == 200
        assert response.json()["authenticated"] is True
```

**Key Patterns:**
- Docstrings explain what is being tested
- Class-based organization: `TestAuthUtilities`, `TestAuthStatus`
- `@pytest.mark.asyncio` for async tests (auto-mode enabled)
- Use `client` fixture for HTTP testing (AsyncClient)
- Use `seed_tags` fixture for pre-populated data

## Mocking

**Framework:**

Frontend: `vitest` with `vi.fn()`, `vi.mock()`
Backend: `unittest.mock` (via pytest)

**Frontend Patterns:**

```typescript
// Mock a module
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}))

// Mock a context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' },
    logout: vi.fn(),
  }),
}))

// Mock recharts (complex charting library)
vi.mock('recharts', () => ({
  ResponsiveContainer: () => null,
  PieChart: () => null,
  // ... all chart components mapped to null
}))

// In test setup file (src/test/setup.ts):
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) => {
      // Return actual English translation or key
      return getNestedValue(messages, `${namespace}.${key}`) || key
    }
    return t
  },
}))
```

**Backend Patterns:**

Use fixtures in `conftest.py`:

```python
@pytest.fixture(scope="function")
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with dependency override"""
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield async_session

    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
```

**What to Mock:**
- External dependencies: Next.js routing, third-party libraries, charts
- API calls: Use MSW (Mock Service Worker) on frontend
- Database: Use in-memory SQLite, fixtures provide fresh data
- Time-dependent functions: Use `freezegun` (in dev dependencies)

**What NOT to Mock:**
- Core business logic (auth utilities, validation)
- Database layer (use fixtures instead)
- Your own utility functions (test them directly)
- Error handling (test error cases with real code)

## Fixtures and Factories

**Frontend Test Setup:**

File: `src/test/setup.ts`

```typescript
import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { server } from './mocks/server'  // MSW server
import messages from '../messages/en-US.json'  // i18n translations

// Mock next-intl to return actual translations
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => ({
    t: (key: string) => getNestedValue(messages, `${namespace}.${key}`) || key,
  }),
}))

// MSW setup for API mocking
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Reset mocks between tests
beforeEach(() => {
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
})
```

**Backend Test Fixtures:**

File: `backend/tests/conftest.py`

```python
@pytest.fixture(scope="function")
async def async_engine():
    """Create async engine with fresh schema"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture(scope="function")
async def seed_tags(async_session: AsyncSession):
    """Seed default bucket tags and account tags"""
    default_bucket_tags = [
        ("bucket", "none", "Uncategorized"),
        ("bucket", "income", "Income and earnings"),
        # ... more tags
    ]
    # Create and commit tags
```

**Location:**
- Frontend: `src/test/` directory
- Backend: `tests/conftest.py` (pytest auto-discovers)
- Shared mock handlers: `src/test/mocks/server.ts` (MSW)

## Coverage

**Frontend:**

Reporter: v8 coverage
View coverage:
```bash
make test-coverage  # Generates HTML report in coverage/
```

**Backend:**

Configuration in `pyproject.toml`:
```toml
[tool.coverage.run]
concurrency = ["greenlet"]
source = ["app"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
```

View coverage:
```bash
make test-coverage  # Generates HTML report in backend/htmlcov/
```

**Requirements:** No enforced minimum; goal is to grow coverage over time

## Test Types

**Unit Tests:**

Frontend (components):
- Scope: Single component in isolation
- Approach: Mock all external dependencies, test component logic and rendering
- Example: `NavBar.test.tsx` tests link rendering and active state detection
- Location: Co-located with component

Frontend (utilities):
- Scope: Pure functions and hooks
- Approach: No mocking unless external dependencies
- Example: `DashboardContext.test.tsx` tests context CRUD operations

Backend (utilities):
- Scope: Single function (auth, hashing, validation)
- Approach: No database, no mocking unless needed
- Example: `test_hash_password_creates_hash()` tests bcrypt hashing directly

**Integration Tests:**

Backend:
- Scope: Full API endpoint with database
- Approach: Use test client (`AsyncClient`) with real database (in-memory SQLite)
- Example: `test_list_tags()` tests API response with seeded data
- Fixtures: `client`, `seed_tags`, `async_session`

**E2E Tests:**

Frontend (Playwright):
- Scope: Full user workflows across pages
- Approach: Test against live backend and frontend servers
- Example: Import workflow: upload CSV → preview → confirm → verify results
- Auth: Uses setup project to authenticate once, then runs tests with auth state
- Location: `frontend/e2e/`

Backend (pytest-playwright):
- Scope: Critical workflows (import, auth, budgets)
- Approach: Use Playwright to automate user interactions
- Files: `tests/e2e/test_import_workflow.py`, `test_full_workflow.py`
- Run with: `make test-e2e`

**Performance Tests:**

Backend:
- Scope: Stress testing with large datasets (10k+ transactions)
- Approach: Benchmark query performance, measure response times
- Marker: `@pytest.mark.performance`
- Run with: `make test-perf`

**Chaos Tests:**

Frontend (Playwright):
- Scope: Random interaction testing (stress test UI)
- Approach: Randomly click buttons, fill inputs, change selects
- Discovery: Uses `data-chaos-target` attribute (auto-discovered)
- Exclusions: `data-chaos-exclude` for destructive actions (delete)
- Run with: `make test-chaos`

## Common Patterns

**Async Testing (Frontend):**

Vitest globals handle async automatically:
```typescript
it('loads and displays data', async () => {
  render(<Dashboard />)

  // Data loading happens via useEffect/SWR
  const element = await screen.findByText('some text')  // Waits for async
  expect(element).toBeInTheDocument()
})
```

**Async Testing (Backend):**

```python
@pytest.mark.asyncio
async def test_list_transactions(self, client: AsyncClient, seed_tags):
    """List all transactions"""
    response = await client.get("/api/v1/transactions/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
```

**Error Testing (Frontend):**

```typescript
it('displays error message on failed login', async () => {
  server.use(
    rest.post('/api/v1/auth/login', (_req, res, ctx) =>
      res(ctx.status(401), ctx.json({ error_code: 'INVALID_CREDENTIALS' }))
    )
  )

  render(<LoginForm />)
  // Trigger submission and verify error display
})
```

**Error Testing (Backend):**

```python
@pytest.mark.asyncio
async def test_get_nonexistent_tag(self, client: AsyncClient):
    """Get non-existent tag returns 404"""
    response = await client.get("/api/v1/tags/by-name/bucket/nonexistent")
    assert response.status_code == 404
    data = response.json()
    assert data["error_code"] == "TAG_NOT_FOUND"
```

## Test IDs (Critical for All Tests)

**Usage (REQUIRED for E2E and Unit Tests):**

- **Always use `data-testid`** for element selection in tests
- Never rely on text content, CSS classes, or DOM structure
- Text content changes when translations are added; test IDs are translation-agnostic

**Test ID Constants:**

Centralized in `frontend/src/test-ids/index.ts`:
```typescript
import { TEST_IDS } from '@/test-ids'

// In component:
<button data-testid={TEST_IDS.HELP_DISMISS}>Got it</button>

// In unit test:
expect(screen.getByTestId(TEST_IDS.HELP_DISMISS)).toBeInTheDocument()

// In E2E test:
await page.locator(`[data-testid="${TEST_IDS.IMPORT_RESULT}"]`).click()
```

**Naming Convention:**
- Format: `<component>-<element>` or `<page>-<action>`
- Examples:
  - `filter-search` (component: filter, element: search input)
  - `transactions-list` (page: transactions, element: list container)
  - `help-dismiss` (component: help, element: dismiss button)
  - `overview-stat-total-transactions-value` (overview page, stat component, total transactions field value)

**Two Test ID Groups:**

1. `TEST_IDS` - Normal elements safe for chaos testing
   ```typescript
   <button data-testid={TEST_IDS.BUDGET_NEW}>New Budget</button>
   ```

2. `CHAOS_EXCLUDED_IDS` - Destructive actions (delete, purge, remove)
   ```typescript
   <button data-chaos-exclude>Delete</button>  // Not selected by chaos tests
   ```

---

*Testing analysis: 2026-02-23*
