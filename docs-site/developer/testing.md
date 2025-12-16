# Testing

## Running Tests

### Frontend Unit Tests (Vitest)

```bash
# Run all frontend unit tests
make test-frontend

# Run with watch mode
cd frontend && npm test

# Run specific test file
cd frontend && npm test src/components/widgets/WidgetRenderer.test.tsx
```

Frontend tests use Vitest with React Testing Library. All tests should use `data-testid` attributes from `frontend/src/test-ids.ts` for element selection (never rely on text content due to i18n).

### Backend Tests

```bash
# Run all backend tests (unit + integration)
make test-backend

# Run with coverage report
make test-coverage

# Run specific test suites
make test-reports     # Report/analytics tests
make test-tags        # Tag system tests
make test-import      # CSV import tests
make test-budgets     # Budget tests
```

### E2E Tests (Playwright)

E2E tests require the development servers to be running.

```bash
# Install Playwright browsers (first time only)
make test-e2e-install

# Run E2E tests (headless)
make test-e2e

# Run E2E tests with visible browser
make test-e2e-headed

# Run E2E tests in debug mode
make test-e2e-debug

# Run specific E2E test suites
make test-e2e-import  # Import workflow tests
make test-e2e-full    # Full workflow tests
```

### All Tests

```bash
# Run both unit and E2E tests
make test-all
```

### i18n Translation Tests

Translation completeness is verified automatically:

```bash
# Run i18n unit tests (checks all locales have matching keys)
cd frontend && npm test src/test/i18n.test.ts
```

The i18n test ensures:
- All keys in `en-US.json` exist in every other locale
- No extra/orphaned keys in non-English locales
- All translated strings are actually different from English (catches copy-paste errors)

### Frontend Linting

```bash
make lint-frontend
```

## Test Data

### Quick Samples

The `/samples/` directory contains sample CSV files for database seeding:

- `bofa.csv` - Bank of America checking format
- `amex.csv` - American Express format

These are imported when running `make db-seed`.

### Anonymizing Real Data

To test with realistic data without exposing sensitive information, use the anonymization tool.

#### Setup

```bash
# 1. Put your real bank CSVs in data/raw/ (gitignored)
cp ~/Downloads/amex_statement.csv data/raw/
cp ~/Downloads/bofa_checking.csv data/raw/

# 2. Check what needs processing
make anonymize-status

# 3. Anonymize all new/changed files
make anonymize

# 4. Find scrubbed files in data/anonymized/
ls data/anonymized/
```

#### How Anonymization Works

- **Merchants** are consistently tokenized: "AMAZON" → "Acme Store" (same fake name everywhere)
- **Account numbers**, card member names, and reference IDs are replaced
- **Amounts and dates** are preserved for realistic testing
- A **manifest** tracks file hashes so unchanged files are skipped on re-runs

#### Commands

```bash
make anonymize         # Process new/changed files
make anonymize-status  # Show pending/processed files
make anonymize-force   # Reprocess all files
```

The anonymized files in `data/anonymized/` are safe to commit and share.

## Coverage

Test coverage is tracked via [Codecov](https://codecov.io/gh/poindexter12/maxwells-wallet).

To generate a local coverage report:

```bash
make test-coverage
# Report saved to backend/htmlcov/
open backend/htmlcov/index.html
```

## CI/CD

Tests run automatically on every push and pull request via GitHub Actions:

- **CI Workflow** (`.github/workflows/ci.yaml`): Runs backend tests with coverage
- Coverage results are uploaded to Codecov
- PRs show coverage diff in comments
