# E2E Testing Guide

End-to-end tests using Playwright for Maxwell's Wallet.

## Running Tests

```bash
# From repo root
make test-e2e

# From frontend directory
npx playwright test

# Run specific test file
npx playwright test dashboard-tabs.spec.ts

# Run with UI mode (debugging)
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed
```

## Test Structure

```
frontend/e2e/
├── chaos/                    # Chaos/monkey testing
│   ├── chaos-helpers.ts      # Seeded PRNG, action executor
│   ├── chaos-dashboard.spec.ts
│   ├── chaos-transactions.spec.ts
│   └── chaos-import.spec.ts
├── dashboard-tabs.spec.ts    # Dashboard tab switching tests
└── README.md                 # This file
```

## Element Selection: Use `data-testid`

**ALWAYS use `data-testid` attributes for selecting elements in tests.**

### Why?

Tests that rely on text content, CSS classes, or DOM structure are fragile:

```typescript
// BAD - breaks when text changes or translations added
await page.locator('button:has-text("Got it")').click();

// BAD - breaks when CSS refactored
await page.locator('.btn-primary').click();

// BAD - breaks when DOM structure changes
await page.locator('div > div > button').click();

// GOOD - stable across refactors
await page.locator('[data-testid="help-dismiss"]').click();
```

### Naming Convention

Format: `data-testid="<component>-<element>"`

| Category | Pattern | Examples |
|----------|---------|----------|
| Page containers | `<page>-page` | `transactions-page`, `import-page` |
| Lists/tables | `<name>-list` | `transactions-list`, `budgets-list` |
| Form inputs | `<form>-<field>` | `filter-search`, `filter-bucket`, `filter-date-start` |
| Buttons | `<action>-button` | `help-dismiss`, `import-confirm`, `filter-clear` |
| Dropdowns | `<name>-select` | `bucket-select`, `account-select` |
| Modals | `<name>-modal` | `edit-transaction-modal`, `confirm-delete-modal` |
| Tabs | `<name>-tab` | `dashboard-tab`, `overview-tab` |

### Existing Test IDs

These are already in the codebase:

- `data-testid="dashboard-selector"` - Dashboard tab bar
- `data-testid="purge-button"` - Dangerous purge button in admin

### Test ID Registry

All test IDs are defined in `frontend/src/test-ids.ts`. This provides:

- **Single source of truth** - All IDs in one place
- **Autocomplete** - In both components and tests
- **Compile-time checks** - TypeScript errors for typos

```typescript
// In src/test-ids.ts - add new IDs here
export const TEST_IDS = {
  HELP_DISMISS: 'help-dismiss',
  FILTER_SEARCH: 'filter-search',
  // ... add new IDs here
} as const;
```

### Using Test IDs in Components

```tsx
import { TEST_IDS } from '@/test-ids';

// Option 1: Direct attribute
<button data-testid={TEST_IDS.HELP_DISMISS}>Got it</button>

// Option 2: Using helper (for spreading)
import { testId } from '@/test-ids';
<button {...testId(TEST_IDS.HELP_DISMISS)}>Got it</button>
```

### Using Test IDs in Tests

```typescript
import { TEST_IDS } from '../src/test-ids';

// In your test
await page.locator(`[data-testid="${TEST_IDS.HELP_DISMISS}"]`).click();
```

### Adding New Test IDs

1. Add the constant to `src/test-ids.ts`
2. Add `data-testid={TEST_IDS.YOUR_ID}` to the component
3. Use `TEST_IDS.YOUR_ID` in tests

## Chaos Testing

The `chaos/` directory contains monkey testing that performs random actions to find crashes.

### How It Works

1. **Seeded randomness** - Same seed = same action sequence (mostly reproducible)
2. **Action types** - Click buttons, fill inputs, scroll, hover, press keys
3. **Error capture** - Catches `pageerror` events and crash overlays
4. **Exclusions** - Skips dangerous buttons (Delete, Purge) and disabled elements

### Running Chaos Tests

```bash
# All chaos tests
npx playwright test chaos/

# Specific chaos test
npx playwright test chaos/chaos-transactions.spec.ts

# With specific seed (if test supports it)
# Edit the seed constant in the test file
```

### When Chaos Tests Fail

1. Note the **seed** from the output
2. The same seed should reproduce the failure (mostly)
3. Check the screenshot in `test-results/`
4. Create a targeted test for the specific bug

### Adding Chaos Tests for New Pages

```typescript
import { test, expect } from '@playwright/test';
import { performRandomActions } from './chaos-helpers';

test('my page survives chaos', async ({ page }) => {
  await page.goto('/my-page');
  await page.waitForLoadState('networkidle');

  const result = await performRandomActions(page, {
    actions: 50,
    seed: 12345,
    excludeSelectors: [
      'button:has-text("Delete")',
      '[data-testid="dangerous-button"]',
    ],
  });

  expect(result.errors).toEqual([]);
});
```

## Best Practices

### DO

- Use `data-testid` for all element selection
- Wait for network idle before interacting: `await page.waitForLoadState('networkidle')`
- Use explicit waits: `await expect(locator).toBeVisible({ timeout: 10000 })`
- Dismiss help panels/modals in `beforeEach`
- Add `data-testid` to components when writing tests

### DON'T

- Select by text content (breaks with i18n)
- Select by CSS class (breaks with styling changes)
- Select by DOM position (breaks with layout changes)
- Use short timeouts in CI (network can be slow)
- Click disabled buttons (Playwright waits forever)

## CI Integration

Tests run in GitHub Actions on every PR. See `.github/workflows/ci.yml`.

Browsers are installed with: `npx playwright install --with-deps chromium`
