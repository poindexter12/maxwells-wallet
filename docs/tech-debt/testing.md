# Testing Strategy & Coverage Review

**Date:** 2025-12-05
**Grade:** A-
**Overall Coverage:** HIGH (~70-80% estimated for critical paths)

## Overview

The project demonstrates strong testing practices with excellent coverage breadth, well-structured test suites, and proper separation of concerns. Minor gaps remain primarily in frontend testing depth and some edge case coverage.

---

## Coverage Analysis

### Backend Coverage: Excellent

- **16,105 lines** of test code across 36+ test files
- **780+ test functions** (unit and integration combined)
- **35 source modules** in `app/` being tested

**Critical paths covered:**
- Transaction management (CRUD, filtering, reconciliation)
- CSV/QIF import (7 different formats, auto-detection)
- Tag system (bucket tags, account tags, occasion tags)
- Budgets, recurring transactions, tag rules
- Reports, analytics, dashboards
- Merchant aliasing, account management

### Frontend Coverage: Severely Lacking

- **2 component tests** (PageHelp.test.tsx, Tooltip.test.tsx)
- Vitest configured but minimal coverage
- **High risk:** Main app components (transactions, dashboards, import UI) untested
- Estimated coverage: **5-10% of critical paths**

### E2E Coverage: Manual Only

- **5 dedicated workflow tests** with Playwright
- Tests: full workflow, import, transactions, budgets, tag rules, recurring
- Requires running servers (good for integration validation)
- **Not integrated into CI** - manual execution only

---

## Top 3 Strengths

### 1. Comprehensive Backend Test Architecture

- Well-organized fixture system (conftest.py) with reusable fixtures (seed_tags, seed_transactions, seed_categories)
- Proper async/await patterns with pytest-asyncio
- In-memory SQLite for isolated, deterministic tests
- Dependency injection overrides for clean testing (get_session override)

**Example fixture pattern:**
```python
@pytest.fixture
async def async_session(async_engine):
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async with async_session_maker() as session:
        yield session
```

### 2. Test Diversity & Purposeful Test Files

- Organized by feature domain (transactions, tags, budgets, reports, etc.)
- Strategic "comprehensive" test files fill coverage gaps (test_coverage_gaps.py, test_*_comprehensive.py)
- Both happy-path and edge-case testing (validation, error handling, pagination)
- Format-specific import tests validate 7 different CSV/QIF parsers

### 3. Solid CI/CD Integration

- Automated test runs on push/PR to main
- Coverage reporting to Codecov (XML export)
- Linting (ruff), type checking (mypy) included (though permissive with `continue-on-error`)
- E2E tests runnable in both headless and headed modes

---

## Top 3 Gaps & Risks

### 1. Frontend Testing Almost Non-Existent

**Severity:** HIGH

- Only 2 simple component tests exist; 99% of frontend untested
- No tests for: Transaction page, Dashboard views, Import workflow UI, Budgets page, Tag management
- No integration tests verifying API contract with backend

**Risk:** UI bugs, broken layouts, broken form submissions ship to production

**Recommendation:**
Add Vitest tests for:
- TransactionList page (sorting, filtering, pagination)
- DashboardPage (chart rendering, date range selection)
- ImportPage (file upload, preview, confirm flow)
- BudgetsPage (CRUD operations via UI)

Use React Testing Library + user-event for interactive flows. Target: 50%+ coverage of critical pages.

### 2. Flaky E2E Test Dependency on Manual Server Setup

**Severity:** HIGH

- E2E tests require `just dev::dev` running (manual prerequisite)
- No automatic server startup/teardown in CI
- CI doesn't run E2E tests (only unit/integration)
- E2E tests fail silently if servers aren't running (verify_servers fixture exits with pytest.exit)

**Risk:** E2E tests become stale, regressions in full workflows undetected in CI

**Recommendation:**
- Add Docker Compose setup in CI to spin up backend + frontend
- Or use test database fixture to avoid server startup
- Run subset of E2E tests (full_workflow + import_workflow) on each PR
- Add GitHub check to prevent merge if E2E fails

### 3. Incomplete Test Isolation & Determinism Issues

**Severity:** MEDIUM

- E2E tests have `clean_database` fixture but it's a pass-through (yield with no cleanup)
- E2E tests interact with a real running database—potential cross-test pollution if tests run in parallel
- Some tests depend on file system (test_data_files from data/anonymized/*.csv)—will skip if files missing (gitignored)
- test_csv_autodetect uses pytest.skip() when sample files missing (no way to run without gitignored data)

**Recommendation:**
- Implement `clean_database` fixture to actually reset tables between tests
- Or use per-test database snapshots (transactions rolled back)
- Add parallel execution support (pytest-xdist) with isolated DBs
- Make test data files non-gitignored or provide sample data in repo

---

## Test Quality Assessment

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Determinism** | Good | In-memory DB, isolated fixtures per test |
| **Isolation** | Good | Function-scoped fixtures, dependency overrides |
| **Maintainability** | Good | Clear test naming, organized into classes, fixture reuse |
| **Flakiness** | Medium | E2E manual setup, some path dependencies |
| **Speed** | Good | Unit tests run quickly; E2E tests slow (requires UI interaction) |
| **Error Messages** | Good | AssertResponse.status_code == 200 and content checks clear |

---

## Test Types Breakdown

| Type | Count | Quality | Status |
|------|-------|---------|--------|
| **Unit Tests** | ~500+ | Excellent | Core business logic, parsers, filters well-tested |
| **Integration Tests** | ~250+ | Excellent | Router + service layer interactions via AsyncClient |
| **E2E Tests** | ~50+ | Good | Full workflow validation via Playwright; manual server setup |
| **Frontend Components** | 2 | Good | Vitest, React Testing Library; minimal coverage |

---

## Fixtures & Mocks Quality: Strong

### Strengths

- `async_engine` (function-scoped): Creates fresh in-memory DB per test
- `async_session`: Proper AsyncSession management, expire_on_commit=False for read access post-commit
- `client` (AsyncClient with ASGITransport): Clean dependency override pattern
- `seed_tags`, `seed_transactions`, `seed_categories`: Composable, reusable fixtures
- `helpers` (E2EHelpers class): Playwright utilities centralized

### Weaknesses

- E2E `clean_database` fixture is a no-op (doesn't actually clean)
- No fixtures for edge cases (e.g., malformed CSV, missing file permissions)
- Backend fixtures hardcoded 2025 dates—may fail in future years without update

---

## CI Integration Assessment

### CI Targets

| Target | Status | Notes |
|--------|--------|-------|
| Frontend tests | `npm test:run` (Vitest) | Runs but minimal tests exist |
| Backend tests | pytest with coverage XML | Codecov integration works |
| Linting | ruff + mypy | Permissive (`continue-on-error`) |
| E2E | **Not run in CI** | Manual prerequisite only |
| Frontend linting | Commented out | ESLint 9 + Next.js 16 incompatibility |

### CI Health

- Codecov token integrated
- Coverage reports uploaded
- No blocking failures (linting/typecheck are soft failures)
- E2E completely bypassed in automation

---

## Critical Path Coverage Matrix

| Component | Status | Tests | Risk |
|-----------|--------|-------|------|
| Transaction CRUD | Full | 15+ | Low |
| CSV Import (7 formats) | Full | 50+ | Low |
| Tag System | Full | 25+ | Low |
| Budgets | Full | 20+ | Low |
| Recurring Detection | Full | 15+ | Low |
| Tag Rules | Full | 20+ | Low |
| Reports & Analytics | Full | 15+ | Low |
| **UI Components** | None | 2 | **High** |
| **API Contract** | Partial | Implicit | Medium |
| **Full Workflows (E2E)** | Manual | 5 | Medium |

---

## Recommendations

### P0 - Expand Frontend Test Coverage

Add Vitest tests for:
- TransactionList page (sorting, filtering, pagination)
- DashboardPage (chart rendering, date range selection)
- ImportPage (file upload, preview, confirm flow)
- BudgetsPage (CRUD operations via UI)

Use React Testing Library + user-event for interactive flows. Target: 50%+ coverage of critical pages.

### P0 - Enable E2E in CI Pipeline

- Add Docker Compose setup in CI to spin up backend + frontend
- Or use test database fixture to avoid server startup
- Run subset of E2E tests (full_workflow + import_workflow) on each PR
- Add GitHub check to prevent merge if E2E fails

### P1 - Fix E2E Test Isolation

- Implement `clean_database` fixture to actually reset tables between tests
- Or use per-test database snapshots (transactions rolled back)
- Add parallel execution support (pytest-xdist) with isolated DBs
- Make test data files non-gitignored or provide sample data in repo

### P1 - Improve Linting in CI

- Remove `continue-on-error: true` from ruff/mypy steps
- Make linting failures block merges
- Fix ESLint 9 + Next.js 16 incompatibility (currently commented out)
- Add Prettier check for consistent formatting

### P2 - Add API Contract Tests

- Generate Pydantic OpenAPI schema from backend
- Use contract tests to verify frontend API calls match backend expectations
- Catch breaking API changes early

### P2 - Strengthen Edge Case Coverage

Add tests for:
- Malformed CSV (missing fields, invalid dates)
- Concurrent import requests (race conditions)
- Database constraint violations (FK, unique constraints)
- Large file handling (1M+ rows)

Parameterize existing tests where applicable (pytest.mark.parametrize)

### P3 - Document Test Patterns

Add README to `backend/tests/` explaining:
- How fixtures compose (conftest.py structure)
- When to write unit vs. integration vs. E2E
- How to run specific test subsets
- Common debugging patterns (PWDEBUG=1, --pdb)

### P3 - Set Coverage Baselines

Configure codecov.io with:
- Minimum coverage threshold (target: 70% for backend)
- Commit status checks (fail if coverage drops >2%)

Currently coverage is uploaded but no enforcement.

---

## Summary

Maxwell's Wallet has **excellent backend test coverage** with 780+ tests, well-organized fixtures, and proper async patterns. The CI/CD pipeline runs linting, type checking, and coverage reporting.

However, **frontend testing is severely lacking** (2 tests for an entire Next.js app), and **E2E tests are manual-only** (not integrated into CI). This creates a blind spot where UI regressions, form submission bugs, and API integration failures could slip through undetected.

**Immediate actions:**
1. Add 20-30 Vitest tests for critical frontend pages
2. Integrate E2E tests into CI with Docker/test database
3. Remove soft-fail linting enforcement (make linter failures block PRs)

With these changes, the project would move from A- to A+ grade with confidence in both backend AND frontend quality.
