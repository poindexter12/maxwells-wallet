/**
 * Centralized test ID constants for E2E and unit testing.
 *
 * Test IDs are split by domain for better organization:
 * - common.ts     - Global/shared IDs (help, theme, modals)
 * - dashboard.ts  - Dashboard page and config
 * - transactions.ts - Transactions, filters, splits
 * - import.ts     - Import page and results
 * - tools.ts      - Tools page and formats
 * - budgets.ts    - Budgets page
 * - admin.ts      - Admin page, overview, tags
 * - widgets.ts    - Widget components
 * - chaos-excluded.ts - Destructive actions (excluded from chaos tests)
 *
 * Usage in components:
 *   import { TEST_IDS } from '@/test-ids';
 *   <button data-testid={TEST_IDS.HELP_DISMISS}>Got it</button>
 *
 * Usage in tests:
 *   import { TEST_IDS } from '@/test-ids';
 *   expect(screen.getByTestId(TEST_IDS.HELP_DISMISS)).toBeInTheDocument();
 *
 * Adding new IDs:
 *   1. Add to the appropriate domain file (e.g., admin.ts for admin-related IDs)
 *   2. The combined TEST_IDS export will automatically include it
 */

import { COMMON_IDS } from './common';
import { DASHBOARD_IDS } from './dashboard';
import { TRANSACTIONS_IDS } from './transactions';
import { IMPORT_IDS } from './import';
import { TOOLS_IDS } from './tools';
import { BUDGETS_IDS } from './budgets';
import { ADMIN_IDS } from './admin';
import { WIDGETS_IDS } from './widgets';
import { CHAOS_EXCLUDED_IDS, getChaosExcludeSelectors } from './chaos-excluded';

/**
 * Combined TEST_IDS object containing all domain IDs.
 * Use this for most imports - it includes everything except chaos-excluded IDs.
 */
export const TEST_IDS = {
  ...COMMON_IDS,
  ...DASHBOARD_IDS,
  ...TRANSACTIONS_IDS,
  ...IMPORT_IDS,
  ...TOOLS_IDS,
  ...BUDGETS_IDS,
  ...ADMIN_IDS,
  ...WIDGETS_IDS,
} as const;

// Re-export chaos-excluded for destructive actions
export { CHAOS_EXCLUDED_IDS, getChaosExcludeSelectors };

// Re-export individual domains for selective imports
export { COMMON_IDS } from './common';
export { DASHBOARD_IDS } from './dashboard';
export { TRANSACTIONS_IDS } from './transactions';
export { IMPORT_IDS } from './import';
export { TOOLS_IDS } from './tools';
export { BUDGETS_IDS } from './budgets';
export { ADMIN_IDS } from './admin';
export { WIDGETS_IDS } from './widgets';

// Type for regular test ID values
export type TestId = (typeof TEST_IDS)[keyof typeof TEST_IDS];

// Type for chaos-excluded test ID values
export type ChaosExcludedId =
  (typeof CHAOS_EXCLUDED_IDS)[keyof typeof CHAOS_EXCLUDED_IDS];

// Combined type for all test IDs
export type AnyTestId = TestId | ChaosExcludedId;

// Helper to create data-testid attribute object (for spreading)
export const testId = (id: AnyTestId) => ({ 'data-testid': id });

/**
 * Validate that no IDs appear in both TEST_IDS and CHAOS_EXCLUDED_IDS.
 * Call this in a test to catch accidental duplicates.
 * Throws an error if overlap is found.
 */
export function validateNoTestIdOverlap(): void {
  const regularIds = new Set(Object.values(TEST_IDS));
  const excludedIds = new Set(Object.values(CHAOS_EXCLUDED_IDS));

  const overlap: string[] = [];
  for (const id of regularIds) {
    if (excludedIds.has(id as ChaosExcludedId)) {
      overlap.push(id);
    }
  }

  if (overlap.length > 0) {
    throw new Error(
      `Test ID overlap detected! The following IDs appear in both TEST_IDS and CHAOS_EXCLUDED_IDS: ${overlap.join(', ')}. ` +
        `Move them to only ONE group.`
    );
  }
}
