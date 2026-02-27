# Testing

## Running Tests

### Frontend Unit Tests (Vitest)

```bash
# Run with watch mode
cd frontend && npm test

# Run specific test file
cd frontend && npm test src/components/widgets/WidgetRenderer.test.tsx
```

Frontend tests use Vitest with React Testing Library. All tests should use `data-testid` attributes from `frontend/src/test-ids.ts` for element selection (never rely on text content due to i18n).

### Backend Tests

```bash
# Run all backend tests (unit + integration)
just test::backend

# Run with coverage report
just test::coverage
```

### E2E Tests (Playwright)

E2E tests require the development servers to be running.

```bash
# Install Playwright browsers (first time only)
just test::e2e-install

# Run E2E tests (headless)
just test::e2e

# Run chaos tests
just test::chaos
```

### All Tests

```bash
# Run both unit and E2E tests
just test::all
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

### Linting & Quality

```bash
just test::lint       # Lint all code (backend + frontend)
just test::quality    # Full quality checks (lint + typecheck + vulture)
```

## Test Data

### Quick Samples

The `/samples/` directory contains sample CSV files for database seeding:

- `bofa.csv` - Bank of America checking format
- `amex.csv` - American Express format

These are imported when running `just db::seed`.

### Anonymizing Real Data

To test with realistic data without exposing sensitive information, use the anonymization tool.

#### Setup

```bash
# 1. Put your real bank CSVs in data/raw/ (gitignored)
cp ~/Downloads/amex_statement.csv data/raw/
cp ~/Downloads/bofa_checking.csv data/raw/

# 2. Check what needs processing
just utils::data-status

# 3. Anonymize all new/changed files
just utils::data-anonymize

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
just utils::data-anonymize    # Process new/changed files
just utils::data-status       # Show pending/processed files
just utils::data-force        # Reprocess all files
```

The anonymized files in `data/anonymized/` are safe to commit and share.

## Coverage

Test coverage is tracked via [Codecov](https://codecov.io/gh/poindexter12/maxwells-wallet).

To generate a local coverage report:

```bash
just test::coverage
# Report saved to backend/htmlcov/
open backend/htmlcov/index.html
```

## CI/CD

Tests run automatically on every push and pull request via GitHub Actions:

- **CI Workflow** (`.github/workflows/ci.yaml`): Runs backend tests with coverage
- Coverage results are uploaded to Codecov
- PRs show coverage diff in comments
