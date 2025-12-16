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
├── chaos/                       # Chaos/monkey testing
│   ├── chaos-helpers.ts         # Seeded PRNG, action executors, adversarial payloads
│   ├── chaos-dashboard.spec.ts  # Dashboard chaos tests @chaos
│   ├── chaos-transactions.spec.ts  # Transactions page @chaos
│   ├── chaos-import.spec.ts     # Import/tools pages @chaos
│   ├── chaos-roaming.spec.ts    # Cross-page navigation @chaos
│   ├── chaos-demon.spec.ts      # Adversarial/fuzz testing @demon
│   └── chaos-endurance.spec.ts  # Time-based endurance @endurance
├── dashboard-tabs.spec.ts       # Dashboard tab switching tests
└── README.md                    # This file
```

## Test Tiers & Tags

Tests are organized into tiers for different CI schedules:

| Tier | Tag | When | What |
|------|-----|------|------|
| **PR** | - | Every PR | Regular E2E tests (dashboard-tabs, etc.) |
| **Nightly** | `@chaos` `@demon` | Weekly Sun 3am UTC | Action-based chaos (5 specs × 3 browsers) |
| **Weekly** | `@endurance` | Weekly Sun 4am UTC | Time-based endurance (1-15 min tests) |

### Running by Tag

```bash
# All chaos tests (action-based)
npx playwright test --grep "@chaos"

# All demon tests (adversarial/fuzz)
npx playwright test --grep "@demon"

# All endurance tests (time-based)
npx playwright test --grep "@endurance"

# Short endurance only (1 min)
npx playwright test --grep "@endurance-short"

# Medium endurance (5 min)
npx playwright test --grep "@endurance-medium"

# Long endurance (15 min)
npx playwright test --grep "@endurance-long"
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

### Chaos-Excluded IDs (Destructive Actions)

For buttons that perform destructive/irreversible actions (delete, purge, etc.), use `CHAOS_EXCLUDED_IDS` instead:

```typescript
// In src/test-ids.ts
export const CHAOS_EXCLUDED_IDS = {
  PURGE_ALL_DATA: 'purge-all-data',
  DELETE_ACCOUNT: 'delete-account',
  // ...
} as const;
```

```tsx
// In your component
import { CHAOS_EXCLUDED_IDS } from '@/test-ids';
<button data-testid={CHAOS_EXCLUDED_IDS.PURGE_ALL_DATA}>Purge All</button>
```

Chaos tests automatically exclude all `CHAOS_EXCLUDED_IDS` selectors. A validation test ensures no ID appears in both groups.

## Chaos Testing

The `chaos/` directory contains monkey testing that performs random actions to find crashes.

### How It Works

1. **Seeded randomness** - Same seed = same action sequence (mostly reproducible)
2. **Targeted element discovery** - Uses `data-chaos-target` attributes for fast element selection
3. **Auto-detection** - Element type determines action: buttons/links → click, inputs → fill, selects → choose option
4. **Error capture** - Catches `pageerror` events and crash overlays
5. **Exclusions** - Skips elements with `data-chaos-exclude` attribute and disabled elements

### Chaos Target Attributes

Use `data-chaos-target` to mark interactive elements that chaos tests should discover and interact with.

```tsx
// Button - will be clicked
<button data-chaos-target="budget-new">New Budget</button>

// Input - will be filled with random value
<input data-chaos-target="filter-search" type="text" />

// Select - will have random option chosen
<select data-chaos-target="import-format-select">
  <option value="">Auto-detect</option>
  <option value="qif">QIF</option>
</select>

// Destructive action - excluded from chaos testing
<button data-chaos-exclude>Delete</button>
```

#### Naming Convention

Format: `data-chaos-target="<page>-<element>"`

| Page | Examples |
|------|----------|
| Navigation | `nav-dashboard`, `nav-transactions`, `nav-admin` |
| Dashboard | `tab-<name>`, `create-dashboard`, `customize-dashboard` |
| Budgets | `budget-new`, `budget-edit-<id>`, `budget-form-submit` |
| Import | `import-mode-single`, `import-mode-batch`, `import-preview-button` |
| Admin | `admin-tab-overview`, `admin-tab-imports`, `admin-tab-health` |
| Tools | `tools-tab-transfers`, `tools-tab-rules`, `tools-tab-merchants` |

#### Adding Chaos Targets to New Components

1. **Interactive buttons/links:** `data-chaos-target="<page>-<action>"`
2. **Form inputs:** `data-chaos-target="<form>-<field>"`
3. **Tabs:** `data-chaos-target="<page>-tab-<name>"`
4. **Destructive buttons:** Use `data-chaos-exclude` instead (never `data-chaos-target`)

#### Difference from `data-testid`

| Attribute | Purpose | Used By |
|-----------|---------|---------|
| `data-testid` | Select specific element in targeted tests | Regular E2E tests |
| `data-chaos-target` | Discoverable elements for random interaction | Chaos tests |
| `data-chaos-exclude` | Prevent chaos interaction on destructive elements | Chaos tests |

Elements can have both `data-testid` (for targeted tests) and `data-chaos-target` (for chaos tests) if needed.

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

test('my page survives chaos @chaos', async ({ page }) => {
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

## Demon Chaos (Adversarial/Fuzz Testing)

The `chaos-demon.spec.ts` file contains adversarial tests that intentionally try to break things:

- **XSS payloads**: `<script>alert(1)</script>`, event handlers, etc.
- **SQL injection patterns**: `'; DROP TABLE--`, `OR 1=1`, etc.
- **Unicode edge cases**: Emoji spam, RTL override, zalgo text, null chars
- **Buffer overflow attempts**: Very long strings (1K-10K chars)
- **Control characters**: Tabs, newlines, ANSI escapes
- **Rapid-fire clicking**: Multiple fast clicks on the same element
- **Paste bombs**: Pasting huge strings via clipboard

### Running Demon Tests

```bash
# All demon tests
npx playwright test --grep "@demon"

# Demon tests on specific page
npx playwright test chaos-demon.spec.ts --grep "transactions"
```

### Using Adversarial Payloads

```typescript
import { ADVERSARIAL_PAYLOADS, generateAdversarialInput, performDemonActions } from './chaos-helpers';

// Access specific payload categories
const xssPayloads = ADVERSARIAL_PAYLOADS.xss;
const unicodePayloads = ADVERSARIAL_PAYLOADS.unicode;

// Generate random adversarial input
const payload = generateAdversarialInput(rng, 'xss'); // or 'sql', 'unicode', etc.

// Run demon chaos
const result = await performDemonActions(page, {
  actions: 50,
  seed: 12345,
  excludeSelectors: ['nav a'],
});
```

## Endurance Testing (Time-Based)

The `chaos-endurance.spec.ts` file contains time-based tests for catching:

- Memory leaks
- Performance degradation over time
- Edge cases that only appear after extended use

### Test Durations

| Tag | Duration | Use Case |
|-----|----------|----------|
| `@endurance-short` | 1 minute | Quick validation, CI smoke test |
| `@endurance-medium` | 5 minutes | Standard weekly testing |
| `@endurance-long` | 15 minutes | Extended stability testing |

### Using Time-Based Functions

```typescript
import { performTimedRandomActions, performTimedDemonActions } from './chaos-helpers';

// Run chaos for a specific duration
const result = await performTimedRandomActions(page, {
  durationMs: 5 * 60 * 1000, // 5 minutes
  seed: 12345,
  minDelay: 50,
  maxDelay: 150,
});

// Run adversarial actions for a duration
const demonResult = await performTimedDemonActions(page, {
  durationMs: 60 * 1000, // 1 minute
  seed: 12345,
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

Tests run in GitHub Actions on every PR. See `.github/workflows/ci.yaml`.

Browsers are installed with: `npx playwright install --with-deps chromium`
