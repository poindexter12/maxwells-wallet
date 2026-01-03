import { Page, Locator } from '@playwright/test';
import { getChaosExcludeSelectors } from '../../src/test-ids';

// Simple attribute for chaos-targetable elements: data-chaos-target
// Add to components: <button data-chaos-target="description">
const CHAOS_TARGET_SELECTOR = '[data-chaos-target]';

/**
 * Seeded pseudo-random number generator (LCG algorithm)
 * Same seed always produces same sequence
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  getSeed(): number {
    return this.seed;
  }

  next(): number {
    // Linear Congruential Generator
    this.seed = (this.seed * 1664525 + 1013904223) % 2 ** 32;
    return this.seed / 2 ** 32;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }

  string(length: number = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[this.int(0, chars.length - 1)]).join('');
  }
}

export type ActionType =
  | 'click-target'  // Fast: uses data-testid selectors
  | 'click-button'  // Slow: scans all buttons
  | 'click-link'    // Slow: scans all links
  | 'fill-input'
  | 'select-option'
  | 'scroll'
  | 'hover'
  | 'press-key';

export interface ChaosOptions {
  actions: number;
  seed?: number;
  actionTypes?: ActionType[];
  excludeSelectors?: string[];
  minDelay?: number;
  maxDelay?: number;
  timeout?: number;
  onAction?: (action: string, index: number) => void;
  /** If true, log errors and continue testing instead of failing immediately */
  continueOnError?: boolean;
  /** Max recovery attempts before giving up (default: 3) */
  maxRecoveryAttempts?: number;
}

export interface TimedChaosOptions {
  durationMs: number;
  seed?: number;
  actionTypes?: ActionType[];
  excludeSelectors?: string[];
  minDelay?: number;
  maxDelay?: number;
  timeout?: number;
  onAction?: (action: string, index: number) => void;
  /** If true, log errors and continue testing instead of failing immediately */
  continueOnError?: boolean;
  /** Max recovery attempts before giving up (default: 3) */
  maxRecoveryAttempts?: number;
}

export interface ChaosResult {
  seed: number;
  actionsPerformed: number;
  errors: string[];
  actions: string[];
  /** Number of times page was recovered after errors */
  recoveries: number;
}

const DEFAULT_ACTION_TYPES: ActionType[] = [
  'click-target', // Fast: uses data-testid selectors (preferred)
  'scroll',
  'press-key',
  // Slow actions (scan all elements) - disabled by default:
  // 'click-button',
  // 'click-link',
  // 'fill-input',
  // 'hover',
];

// Build default exclusions from the centralized CHAOS_EXCLUDED_IDS registry
// plus some general patterns
const DEFAULT_EXCLUDE_SELECTORS = [
  // All chaos-excluded test IDs (destructive actions)
  ...getChaosExcludeSelectors(),

  // General patterns
  'a[href^="http"]', // External links
  'a[href^="mailto:"]',
  '[data-chaos-exclude]', // Manual opt-out attribute

  // Legacy text-based exclusions (for elements not yet using test IDs)
  'button:has-text("Delete")',
  'button:has-text("Purge")',
  'button:has-text("Remove")',
];

/**
 * Attempt to recover the page after an error by reloading
 * Returns true if recovery was successful
 */
async function attemptPageRecovery(
  page: Page,
  errorMsg: string,
  recoveryAttempt: number,
  maxAttempts: number
): Promise<boolean> {
  // Quickly check if page is closed - no point attempting recovery
  if (page.isClosed()) {
    console.log(`  💀 Page/browser is closed, cannot recover`);
    return false;
  }

  if (recoveryAttempt >= maxAttempts) {
    console.log(`  💀 Max recovery attempts (${maxAttempts}) reached, giving up`);
    return false;
  }

  console.log(`  🔄 Recovery attempt ${recoveryAttempt + 1}/${maxAttempts} after error: ${errorMsg.slice(0, 50)}...`);
  try {
    // Get current URL before reload
    const currentUrl = page.url();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    console.log(`  ✅ Page recovered, continuing from ${currentUrl}`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ❌ Recovery failed: ${msg}`);
    return false;
  }
}

/**
 * Perform random actions on the page
 */
export async function performRandomActions(
  page: Page,
  options: ChaosOptions
): Promise<ChaosResult> {
  const seed = options.seed ?? Date.now();
  const rng = new SeededRandom(seed);
  const actionTypes = options.actionTypes ?? DEFAULT_ACTION_TYPES;
  const excludeSelectors = [
    ...DEFAULT_EXCLUDE_SELECTORS,
    ...(options.excludeSelectors ?? []),
  ];
  const minDelay = options.minDelay ?? 50;
  const maxDelay = options.maxDelay ?? 300;
  const timeout = options.timeout ?? 5000; // 5s for slow CI environments
  const continueOnError = options.continueOnError ?? false;
  const maxRecoveryAttempts = options.maxRecoveryAttempts ?? 3;

  const errors: string[] = [];
  const actionsLog: string[] = [];
  let recoveries = 0;
  let consecutiveRecoveryAttempts = 0;

  // Capture page errors (filter out browser-specific non-critical warnings)
  const errorHandler = (error: Error) => {
    const msg = error.message;
    // Skip WebKit-specific CORS warnings that aren't actual app errors
    // These occur in WebKit due to stricter access control checks
    if (msg.includes('due to access control checks') ||
        msg.includes('__nextjs_original-stack-frames')) {
      return;
    }
    errors.push(msg);
  };
  page.on('pageerror', errorHandler);

  const startTime = Date.now();
  console.log(`🐒 Chaos monkey starting with seed: ${seed} at ${new Date().toISOString()}`);
  console.log(`  Config: ${options.actions} actions, delay ${minDelay}-${maxDelay}ms, timeout ${timeout}ms, continueOnError: ${continueOnError}`);

  for (let i = 0; i < options.actions; i++) {
    const actionStart = Date.now();
    let actionDesc: string | null = null;
    let attempts = 0;
    const maxAttempts = actionTypes.length; // Try each action type at most once

    // Try different action types until we find one with available targets
    while (actionDesc === null && attempts < maxAttempts) {
      const actionType = rng.pick(actionTypes);
      attempts++;

      try {
        actionDesc = await executeAction(
          page,
          actionType,
          rng,
          excludeSelectors,
          timeout
        );
        consecutiveRecoveryAttempts = 0; // Reset on success
      } catch (e) {
        // Action failures (timeouts, etc.) indicate UI issues
        const msg = e instanceof Error ? e.message : String(e);
        const actionDuration = Date.now() - actionStart;
        const errorMsg = `[${actionType}] ${msg}`;
        actionsLog.push(`${i + 1}. [FAILED] ${actionType}: ${msg}`);
        errors.push(errorMsg);
        console.log(`  [${i + 1}/${options.actions}] FAILED ${actionType}: ${msg} (${actionDuration}ms)`);

        if (continueOnError) {
          // Try to recover and continue
          const recovered = await attemptPageRecovery(page, msg, consecutiveRecoveryAttempts, maxRecoveryAttempts);
          if (recovered) {
            recoveries++;
            consecutiveRecoveryAttempts = 0;
            break; // Continue to next action
          } else {
            consecutiveRecoveryAttempts++;
            if (consecutiveRecoveryAttempts >= maxRecoveryAttempts) {
              console.log(`  💀 Too many consecutive failures, stopping`);
              i = options.actions; // Force exit loop
            }
            break;
          }
        } else {
          break; // Stop on action failure (original behavior)
        }
      }
    }

    if (actionDesc !== null) {
      const actionDuration = Date.now() - actionStart;
      actionsLog.push(`${i + 1}. ${actionDesc}`);
      console.log(`  [${i + 1}/${options.actions}] ${actionDesc} (${actionDuration}ms)`);
      options.onAction?.(actionDesc, i);
    }

    // Random delay between actions
    await page.waitForTimeout(rng.int(minDelay, maxDelay));

    // Early exit if we hit a crash (only if not in continueOnError mode)
    if (!continueOnError && errors.length > 0) {
      console.log(`🔥 Crash detected after action ${i + 1}`);
      break;
    }
  }

  page.off('pageerror', errorHandler);

  const totalDuration = Date.now() - startTime;
  console.log(`🐒 Chaos monkey completed at ${new Date().toISOString()}`);
  console.log(`  Total: ${actionsLog.length} actions in ${totalDuration}ms (${Math.round(totalDuration / Math.max(1, actionsLog.length))}ms/action), Errors: ${errors.length}, Recoveries: ${recoveries}`);

  return {
    seed,
    actionsPerformed: actionsLog.length,
    errors,
    actions: actionsLog,
    recoveries,
  };
}

/**
 * Perform random actions for a specified duration (time-based endurance testing)
 * Use this for long-running stability tests where you want to simulate real user sessions
 */
export async function performTimedRandomActions(
  page: Page,
  options: TimedChaosOptions
): Promise<ChaosResult> {
  const seed = options.seed ?? Date.now();
  const rng = new SeededRandom(seed);
  const actionTypes = options.actionTypes ?? DEFAULT_ACTION_TYPES;
  const excludeSelectors = [
    ...DEFAULT_EXCLUDE_SELECTORS,
    ...(options.excludeSelectors ?? []),
  ];
  const minDelay = options.minDelay ?? 50;
  const maxDelay = options.maxDelay ?? 300;
  const timeout = options.timeout ?? 5000;
  const durationMs = options.durationMs;
  const continueOnError = options.continueOnError ?? false;
  const maxRecoveryAttempts = options.maxRecoveryAttempts ?? 3;

  const errors: string[] = [];
  const actionsLog: string[] = [];
  let recoveries = 0;
  let consecutiveRecoveryAttempts = 0;

  // Capture page errors (filter out browser-specific non-critical warnings)
  const errorHandler = (error: Error) => {
    const msg = error.message;
    // Skip WebKit-specific CORS warnings that aren't actual app errors
    if (msg.includes('due to access control checks') ||
        msg.includes('__nextjs_original-stack-frames')) {
      return;
    }
    errors.push(msg);
  };
  page.on('pageerror', errorHandler);

  const startTime = Date.now();
  const endTime = startTime + durationMs;
  console.log(`🐒 Timed chaos starting with seed: ${seed} at ${new Date().toISOString()}`);
  console.log(`  Config: ${Math.round(durationMs / 1000)}s duration, delay ${minDelay}-${maxDelay}ms, timeout ${timeout}ms, continueOnError: ${continueOnError}`);

  let actionIndex = 0;
  while (Date.now() < endTime) {
    // In continueOnError mode, keep going even with errors
    if (!continueOnError && errors.length > 0) break;

    const actionStart = Date.now();
    let actionDesc: string | null = null;
    let attempts = 0;
    const maxAttempts = actionTypes.length;

    while (actionDesc === null && attempts < maxAttempts) {
      const actionType = rng.pick(actionTypes);
      attempts++;

      try {
        actionDesc = await executeAction(
          page,
          actionType,
          rng,
          excludeSelectors,
          timeout
        );
        consecutiveRecoveryAttempts = 0; // Reset on success
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const actionDuration = Date.now() - actionStart;
        const errorMsg = `[${actionType}] ${msg}`;
        actionsLog.push(`${actionIndex + 1}. [FAILED] ${actionType}: ${msg}`);
        errors.push(errorMsg);
        console.log(`  [${actionIndex + 1}] FAILED ${actionType}: ${msg} (${actionDuration}ms)`);

        if (continueOnError) {
          // Try to recover and continue
          const recovered = await attemptPageRecovery(page, msg, consecutiveRecoveryAttempts, maxRecoveryAttempts);
          if (recovered) {
            recoveries++;
            consecutiveRecoveryAttempts = 0;
            break; // Continue to next action
          } else {
            consecutiveRecoveryAttempts++;
            if (consecutiveRecoveryAttempts >= maxRecoveryAttempts) {
              console.log(`  💀 Too many consecutive failures, stopping`);
              actionIndex = Number.MAX_SAFE_INTEGER; // Force exit main loop
            }
            break;
          }
        } else {
          break; // Original behavior
        }
      }
    }

    if (actionDesc !== null) {
      const actionDuration = Date.now() - actionStart;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      actionsLog.push(`${actionIndex + 1}. ${actionDesc}`);
      // Log progress every 10 actions
      if (actionIndex % 10 === 0) {
        console.log(`  [${elapsed}s/${Math.round(durationMs / 1000)}s] Action ${actionIndex + 1}: ${actionDesc} (${actionDuration}ms)`);
      }
      options.onAction?.(actionDesc, actionIndex);
    }

    actionIndex++;
    await page.waitForTimeout(rng.int(minDelay, maxDelay));
  }

  page.off('pageerror', errorHandler);

  const totalDuration = Date.now() - startTime;
  console.log(`🐒 Timed chaos completed at ${new Date().toISOString()}`);
  console.log(`  Total: ${actionsLog.length} actions in ${Math.round(totalDuration / 1000)}s (${Math.round(totalDuration / Math.max(1, actionsLog.length))}ms/action), Errors: ${errors.length}, Recoveries: ${recoveries}`);

  return {
    seed,
    actionsPerformed: actionsLog.length,
    errors,
    actions: actionsLog,
    recoveries,
  };
}

async function executeAction(
  page: Page,
  actionType: ActionType,
  rng: SeededRandom,
  excludeSelectors: string[],
  timeout: number
): Promise<string | null> {
  switch (actionType) {
    case 'click-target': {
      // Fast path: find elements with data-chaos-target attribute
      const targets = await page.locator(CHAOS_TARGET_SELECTOR).all();

      // Filter to visible and enabled elements only
      const eligibleTargets: Locator[] = [];
      for (const target of targets) {
        try {
          const isVisible = await target.isVisible();
          if (!isVisible) continue;

          // Check if disabled
          const isDisabled = await target.evaluate((el) => {
            return (
              (el as HTMLButtonElement).disabled ||
              el.getAttribute('aria-disabled') === 'true' ||
              el.classList.contains('disabled')
            );
          });
          if (isDisabled) continue;

          eligibleTargets.push(target);
        } catch {
          // Element may have become stale, skip it
        }
      }

      if (eligibleTargets.length === 0) return null;

      const target = rng.pick(eligibleTargets);
      const name = await target.getAttribute('data-chaos-target');
      const tagName = await target.evaluate(el => el.tagName.toLowerCase());

      // Determine action based on element type
      if (tagName === 'input' || tagName === 'textarea') {
        const type = await target.getAttribute('type') || 'text';

        // File inputs cannot be interacted with programmatically - skip
        if (type === 'file') {
          return null; // Try different action
        }

        // Checkboxes and radios should be clicked, not filled
        if (type === 'checkbox' || type === 'radio') {
          await target.click({ timeout });
          return `click-target: [${name}] (${type})`;
        }

        const value = generateInputValue(type, rng);
        await target.fill(value);
        return `fill-target: [${name}] = "${value}"`;
      } else if (tagName === 'select') {
        const options = await target.locator('option').all();
        if (options.length > 0) {
          const option = rng.pick(options);
          const value = await option.getAttribute('value');
          if (value) {
            await target.selectOption(value);
            return `select-target: [${name}] = "${value}"`;
          }
        }
        return null;
      } else {
        // Default: click (buttons, links, etc.)
        // Try clicking - if blocked by overlay, dismiss it and retry
        try {
          await target.click({ timeout });
          return `click-target: [${name}]`;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // If blocked by overlay/modal, try to dismiss it
          if (msg.includes('intercepts pointer events')) {
            // Try pressing Escape to close any modal
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            // Return as a modal dismiss action instead of failing
            return `modal-dismiss: (was blocked clicking [${name}])`;
          }
          throw e; // Re-throw other errors
        }
      }
    }

    case 'click-button': {
      const buttons = await getVisibleElements(
        page,
        'button:visible',
        excludeSelectors
      );
      if (buttons.length === 0) return null; // No targets, try different action

      const button = rng.pick(buttons);
      const text = await button.textContent();
      try {
        await button.click({ timeout });
        return `click-button: "${text?.trim().slice(0, 30) || 'unnamed'}"`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('intercepts pointer events')) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(100);
          return `modal-dismiss: (was blocked clicking button)`;
        }
        throw e;
      }
    }

    case 'click-link': {
      const links = await getVisibleElements(
        page,
        'a:visible',
        excludeSelectors
      );
      if (links.length === 0) return null;

      const link = rng.pick(links);
      const text = await link.textContent();
      try {
        await link.click({ timeout });
        return `click-link: "${text?.trim().slice(0, 30) || 'unnamed'}"`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('intercepts pointer events')) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(100);
          return `modal-dismiss: (was blocked clicking link)`;
        }
        throw e;
      }
    }

    case 'fill-input': {
      const inputs = await getVisibleElements(
        page,
        'input:visible:not([type=file]):not([type=hidden]):not([readonly])',
        excludeSelectors
      );
      if (inputs.length === 0) return null;

      const input = rng.pick(inputs);
      const type = (await input.getAttribute('type')) || 'text';
      const name = await input.getAttribute('name');
      const value = generateInputValue(type, rng);
      await input.fill(value);
      return `fill-input[${name || type}]: "${value}"`;
    }

    case 'select-option': {
      const selects = await getVisibleElements(
        page,
        'select:visible',
        excludeSelectors
      );
      if (selects.length === 0) return null;

      const select = rng.pick(selects);
      const options = await select.locator('option').all();
      if (options.length === 0) return null;

      const option = rng.pick(options);
      const value = await option.getAttribute('value');
      if (value) {
        await select.selectOption(value);
        return `select-option: "${value}"`;
      }
      return null;
    }

    case 'scroll': {
      // Scroll always works - no elements needed
      const direction = rng.pick(['up', 'down', 'left', 'right']);
      const amount = rng.int(100, 500);
      const deltaX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
      const deltaY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
      try {
        await page.mouse.wheel(deltaX, deltaY);
        return `scroll: ${direction} ${amount}px`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Navigation during scroll is expected in chaos testing - a prior click may have
        // triggered a route change. This is not a bug, just bad timing.
        if (msg.includes('Execution context was destroyed') || msg.includes('navigation')) {
          // Wait for the new page to stabilize and return success
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          return `scroll: ${direction} (navigation occurred, recovered)`;
        }
        throw e; // Re-throw other errors
      }
    }

    case 'hover': {
      const elements = await getVisibleElements(
        page,
        'button:visible, a:visible, [role="button"]:visible',
        excludeSelectors
      );
      if (elements.length === 0) return null;

      const element = rng.pick(elements);
      try {
        await element.hover({ timeout });
        const text = await element.textContent();
        return `hover: "${text?.trim().slice(0, 30) || 'unnamed'}"`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('intercepts pointer events')) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(100);
          return `modal-dismiss: (was blocked hovering)`;
        }
        throw e;
      }
    }

    case 'press-key': {
      // Press-key always works - no elements needed
      const keys = ['Tab', 'Escape', 'Enter', 'ArrowDown', 'ArrowUp'];
      const key = rng.pick(keys);
      await page.keyboard.press(key);
      return `press-key: ${key}`;
    }

    default:
      return null;
  }
}

async function getVisibleElements(
  page: Page,
  selector: string,
  excludeSelectors: string[]
): Promise<Locator[]> {
  const elements = await page.locator(selector).all();
  const filtered: Locator[] = [];

  for (const element of elements) {
    try {
      const isVisible = await element.isVisible();
      if (!isVisible) continue;

      // Check if disabled
      const isDisabled = await element.evaluate((el) => {
        return (
          (el as HTMLButtonElement).disabled ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.classList.contains('disabled')
        );
      });
      if (isDisabled) continue;

      // Check exclusions
      let excluded = false;
      for (const excludeSel of excludeSelectors) {
        try {
          const matches = await element.evaluate(
            (el, sel) => el.matches(sel),
            excludeSel
          );
          if (matches) {
            excluded = true;
            break;
          }
        } catch {
          // Selector might not be valid for this element
        }
      }

      if (!excluded) {
        filtered.push(element);
      }
    } catch {
      // Element may have become stale
    }
  }

  return filtered;
}

function generateInputValue(type: string, rng: SeededRandom): string {
  switch (type) {
    case 'number':
      return String(rng.int(-1000, 10000));
    case 'email':
      return `chaos${rng.int(1, 9999)}@test.com`;
    case 'date':
      const year = rng.int(2020, 2025);
      const month = String(rng.int(1, 12)).padStart(2, '0');
      const day = String(rng.int(1, 28)).padStart(2, '0');
      return `${year}-${month}-${day}`;
    case 'tel':
      return `555-${rng.int(100, 999)}-${rng.int(1000, 9999)}`;
    case 'url':
      return `https://example.com/${rng.string(8)}`;
    default:
      return `chaos-${rng.string(6)}`;
  }
}

// =============================================================================
// DEMON CHAOS MODE - Adversarial/Fuzz Testing
// =============================================================================

/**
 * Adversarial input payloads for security and robustness testing
 */
export const ADVERSARIAL_PAYLOADS = {
  // XSS attack vectors
  xss: [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><script>alert(1)</script>',
    "javascript:alert('XSS')",
    '<svg/onload=alert(1)>',
    '{{constructor.constructor("alert(1)")()}}',
  ],

  // SQL injection patterns
  sql: [
    "'; DROP TABLE transactions; --",
    "1' OR '1'='1",
    "1; SELECT * FROM users--",
    "' UNION SELECT * FROM --",
    "admin'--",
    "1' AND SLEEP(5)--",
  ],

  // Unicode edge cases
  unicode: [
    '🔥'.repeat(100), // Emoji spam
    '\u202E\u202Dtest', // RTL override
    '\u0000', // Null character
    '﷽'.repeat(20), // Longest unicode char
    '\uFEFF'.repeat(10), // Zero-width no-break space
    'Ṫ̈́ḣ̈́ï̈́s̈́ ï̈́s̈́ z̈́ä̈́l̈́g̈́ö̈́', // Zalgo text
    '表ポあA鷗ŒéＢ逍Ü', // Mixed scripts
  ],

  // Buffer overflow attempts (keep sizes reasonable to avoid browser hangs)
  overflow: [
    'A'.repeat(1000),
    'x'.repeat(2000),
    '9'.repeat(2000), // For number fields
    '<'.repeat(500) + '>'.repeat(500),
  ],

  // Control characters
  control: [
    '\t\t\t\n\n\n',
    '\r\n\r\n\r\n',
    '\x00\x01\x02\x03',
    '\b\b\b', // Backspace
    '\x1B[2J', // ANSI clear screen
  ],

  // Special characters that might break parsing
  special: [
    '\\\\\\',
    '///',
    '"""',
    "'''",
    '<<<>>>',
    '&&&|||',
    ';;;',
    '```',
    '${process.env}',
    '{{7*7}}',
  ],

  // Path traversal
  path: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '%2e%2e%2f',
    '....//....//....//etc/passwd',
  ],

  // Format string attacks
  format: [
    '%s%s%s%s%s',
    '%n%n%n%n',
    '%x%x%x%x',
    '{0}{1}{2}',
  ],

  // JSON/XML breaking
  markup: [
    '{"__proto__":{"admin":true}}',
    '</script><script>alert(1)</script>',
    ']]><!--',
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
  ],
};

/**
 * Generate an adversarial input value for fuzz testing
 */
export function generateAdversarialInput(rng: SeededRandom, category?: keyof typeof ADVERSARIAL_PAYLOADS): string {
  const categories = Object.keys(ADVERSARIAL_PAYLOADS) as (keyof typeof ADVERSARIAL_PAYLOADS)[];
  const selectedCategory = category ?? rng.pick(categories);
  const payloads = ADVERSARIAL_PAYLOADS[selectedCategory];
  return rng.pick(payloads);
}

/**
 * Demon chaos action types - aggressive/adversarial actions
 */
export type DemonActionType =
  | 'rapid-click'      // Multiple fast clicks on same element
  | 'double-click'     // Actual dblclick event
  | 'fuzz-input'       // Fill with adversarial payload
  | 'paste-bomb'       // Paste huge string via clipboard
  | 'blur-focus-spam'; // Rapidly tab through fields

export interface DemonChaosOptions {
  actions: number;
  seed?: number;
  actionTypes?: DemonActionType[];
  excludeSelectors?: string[];
  onAction?: (action: string, index: number) => void;
  /** If true, log errors and continue testing instead of failing immediately */
  continueOnError?: boolean;
  /** Max recovery attempts before giving up (default: 3) */
  maxRecoveryAttempts?: number;
}

export interface TimedDemonChaosOptions {
  durationMs: number;
  seed?: number;
  actionTypes?: DemonActionType[];
  excludeSelectors?: string[];
  onAction?: (action: string, index: number) => void;
  /** If true, log errors and continue testing instead of failing immediately */
  continueOnError?: boolean;
  /** Max recovery attempts before giving up (default: 3) */
  maxRecoveryAttempts?: number;
}

export interface DemonChaosResult {
  seed: number;
  actionsPerformed: number;
  errors: string[];
  actions: string[];
  /** Number of times page was recovered after errors */
  recoveries: number;
}

const DEFAULT_DEMON_ACTION_TYPES: DemonActionType[] = [
  'rapid-click',
  'double-click',
  'fuzz-input',
  'blur-focus-spam',
];

/**
 * Perform adversarial/fuzz actions on the page
 * This is more aggressive than regular chaos - intentionally tries to break things
 */
export async function performDemonActions(
  page: Page,
  options: DemonChaosOptions
): Promise<DemonChaosResult> {
  const seed = options.seed ?? Date.now();
  const rng = new SeededRandom(seed);
  const actionTypes = options.actionTypes ?? DEFAULT_DEMON_ACTION_TYPES;
  const excludeSelectors = [
    ...DEFAULT_EXCLUDE_SELECTORS,
    ...(options.excludeSelectors ?? []),
  ];
  const continueOnError = options.continueOnError ?? false;
  const maxRecoveryAttempts = options.maxRecoveryAttempts ?? 3;

  const errors: string[] = [];
  const actionsLog: string[] = [];
  let recoveries = 0;
  let consecutiveRecoveryAttempts = 0;

  // Capture page errors (filter out browser-specific non-critical warnings)
  const errorHandler = (error: Error) => {
    const msg = error.message;
    // Skip WebKit-specific CORS warnings that aren't actual app errors
    if (msg.includes('due to access control checks') ||
        msg.includes('__nextjs_original-stack-frames')) {
      return;
    }
    errors.push(msg);
  };
  page.on('pageerror', errorHandler);

  console.log(`😈 Demon chaos starting with seed: ${seed}, continueOnError: ${continueOnError}`);

  for (let i = 0; i < options.actions; i++) {
    // Check if page/browser is gone before attempting action
    if (page.isClosed()) {
      console.log(`  💀 Page/browser closed, stopping demon chaos`);
      break;
    }

    const actionType = rng.pick(actionTypes);
    let actionDesc: string | null = null;

    try {
      actionDesc = await executeDemonAction(
        page,
        actionType,
        rng,
        excludeSelectors
      );
      consecutiveRecoveryAttempts = 0; // Reset on success
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      actionsLog.push(`${i + 1}. [FAILED] ${actionType}: ${msg}`);
      errors.push(`[${actionType}] ${msg}`);
      console.log(`  [${i + 1}/${options.actions}] FAILED ${actionType}: ${msg}`);

      if (continueOnError) {
        // Try to recover and continue
        const recovered = await attemptPageRecovery(page, msg, consecutiveRecoveryAttempts, maxRecoveryAttempts);
        if (recovered) {
          recoveries++;
          consecutiveRecoveryAttempts = 0;
          continue; // Continue to next action
        } else {
          consecutiveRecoveryAttempts++;
          if (consecutiveRecoveryAttempts >= maxRecoveryAttempts) {
            console.log(`  💀 Too many consecutive failures, stopping`);
            break;
          }
          continue;
        }
      } else {
        break; // Original behavior
      }
    }

    if (actionDesc) {
      actionsLog.push(`${i + 1}. ${actionDesc}`);
      console.log(`  [${i + 1}/${options.actions}] ${actionDesc}`);
      options.onAction?.(actionDesc, i);
    }

    // Minimal delay to let page stabilize between aggressive actions
    // Without this, DOM queries pile up and cause test timeouts on complex pages
    try {
      await page.waitForTimeout(50);
    } catch {
      // Page might be closed due to browser crash - exit gracefully
      console.log('  ⚠️ Page closed during stabilization - browser may have crashed');
      break;
    }

    // Only exit early if not in continueOnError mode
    if (!continueOnError && errors.length > 0) break;
  }

  try {
    page.off('pageerror', errorHandler);
  } catch {
    // Page might be closed - handler cleanup not needed
  }

  console.log(`😈 Demon chaos completed: ${actionsLog.length} actions, ${errors.length} errors, ${recoveries} recoveries`);

  return {
    seed,
    actionsPerformed: actionsLog.length,
    errors,
    actions: actionsLog,
    recoveries,
  };
}

/**
 * Perform adversarial actions for a specified duration (time-based endurance testing)
 * Use this for extended fuzzing sessions in weekly CI runs
 */
export async function performTimedDemonActions(
  page: Page,
  options: TimedDemonChaosOptions
): Promise<DemonChaosResult> {
  const seed = options.seed ?? Date.now();
  const rng = new SeededRandom(seed);
  const actionTypes = options.actionTypes ?? DEFAULT_DEMON_ACTION_TYPES;
  const excludeSelectors = [
    ...DEFAULT_EXCLUDE_SELECTORS,
    ...(options.excludeSelectors ?? []),
  ];
  const durationMs = options.durationMs;
  const continueOnError = options.continueOnError ?? false;
  const maxRecoveryAttempts = options.maxRecoveryAttempts ?? 3;

  const errors: string[] = [];
  const actionsLog: string[] = [];
  let recoveries = 0;
  let consecutiveRecoveryAttempts = 0;

  // Capture page errors (filter out browser-specific non-critical warnings)
  const errorHandler = (error: Error) => {
    const msg = error.message;
    // Skip WebKit-specific CORS warnings that aren't actual app errors
    if (msg.includes('due to access control checks') ||
        msg.includes('__nextjs_original-stack-frames')) {
      return;
    }
    errors.push(msg);
  };
  page.on('pageerror', errorHandler);

  const startTime = Date.now();
  const endTime = startTime + durationMs;
  console.log(`😈 Timed demon chaos starting with seed: ${seed} at ${new Date().toISOString()}`);
  console.log(`  Config: ${Math.round(durationMs / 1000)}s duration, continueOnError: ${continueOnError}`);

  let actionIndex = 0;
  while (Date.now() < endTime) {
    // Check if page/browser is gone before attempting action
    if (page.isClosed()) {
      console.log(`  💀 Page/browser closed, stopping demon chaos`);
      break;
    }

    // In continueOnError mode, keep going even with errors
    if (!continueOnError && errors.length > 0) break;

    const actionType = rng.pick(actionTypes);
    let actionDesc: string | null = null;

    try {
      actionDesc = await executeDemonAction(
        page,
        actionType,
        rng,
        excludeSelectors
      );
      consecutiveRecoveryAttempts = 0; // Reset on success
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      actionsLog.push(`${actionIndex + 1}. [FAILED] ${actionType}: ${msg}`);
      errors.push(`[${actionType}] ${msg}`);
      console.log(`  [${actionIndex + 1}] FAILED ${actionType}: ${msg}`);

      if (continueOnError) {
        // Try to recover and continue
        const recovered = await attemptPageRecovery(page, msg, consecutiveRecoveryAttempts, maxRecoveryAttempts);
        if (recovered) {
          recoveries++;
          consecutiveRecoveryAttempts = 0;
          actionIndex++;
          continue; // Continue to next action
        } else {
          consecutiveRecoveryAttempts++;
          if (consecutiveRecoveryAttempts >= maxRecoveryAttempts) {
            console.log(`  💀 Too many consecutive failures, stopping`);
            break;
          }
          actionIndex++;
          continue;
        }
      } else {
        break; // Original behavior
      }
    }

    if (actionDesc) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      actionsLog.push(`${actionIndex + 1}. ${actionDesc}`);
      // Log progress every 10 actions
      if (actionIndex % 10 === 0) {
        console.log(`  [${elapsed}s/${Math.round(durationMs / 1000)}s] Action ${actionIndex + 1}: ${actionDesc}`);
      }
      options.onAction?.(actionDesc, actionIndex);
    }

    actionIndex++;

    // Minimal delay to let page stabilize between aggressive actions
    try {
      await page.waitForTimeout(50);
    } catch {
      // Page might be closed due to browser crash - exit gracefully
      console.log('  ⚠️ Page closed during stabilization - browser may have crashed');
      break;
    }
  }

  try {
    page.off('pageerror', errorHandler);
  } catch {
    // Page might be closed - handler cleanup not needed
  }

  const totalDuration = Date.now() - startTime;
  console.log(`😈 Timed demon chaos completed at ${new Date().toISOString()}`);
  console.log(`  Total: ${actionsLog.length} actions in ${Math.round(totalDuration / 1000)}s, Errors: ${errors.length}, Recoveries: ${recoveries}`);

  return {
    seed,
    actionsPerformed: actionsLog.length,
    errors,
    actions: actionsLog,
    recoveries,
  };
}

/**
 * Get random coordinates within the viewport, avoiding edges
 * This simulates where a real user might click on the screen
 */
async function getRandomViewportCoords(
  page: Page,
  rng: SeededRandom
): Promise<{ x: number; y: number }> {
  const viewport = page.viewportSize() || { width: 1280, height: 720 };
  // Avoid edges (nav bars, scrollbars) - use inner 80% of viewport
  const margin = 0.1;
  const x = Math.floor(viewport.width * margin + rng.next() * viewport.width * (1 - 2 * margin));
  const y = Math.floor(viewport.height * margin + rng.next() * viewport.height * (1 - 2 * margin));
  return { x, y };
}

/**
 * Execute a demon action using viewport-based interactions
 *
 * This simulates an aggressive/chaotic user who clicks randomly on the screen,
 * types garbage, and generally causes mayhem. Unlike DOM-based queries,
 * this approach is fast because it doesn't need to enumerate elements.
 */
async function executeDemonAction(
  page: Page,
  actionType: DemonActionType,
  rng: SeededRandom,
  _excludeSelectors: string[] // No longer used - viewport clicks don't need exclusions
): Promise<string | null> {
  switch (actionType) {
    case 'rapid-click': {
      // Click rapidly at a random spot on the screen
      const { x, y } = await getRandomViewportCoords(page, rng);
      const clicks = rng.int(3, 10);

      for (let i = 0; i < clicks; i++) {
        await page.mouse.click(x, y, { delay: 10 }).catch(() => {});
      }
      return `rapid-click: (${x},${y}) x${clicks}`;
    }

    case 'double-click': {
      // Double-click at a random spot
      const { x, y } = await getRandomViewportCoords(page, rng);
      await page.mouse.dblclick(x, y).catch(() => {});
      return `double-click: (${x},${y})`;
    }

    case 'fuzz-input': {
      // Click somewhere to potentially focus an input, then type garbage
      const { x, y } = await getRandomViewportCoords(page, rng);
      await page.mouse.click(x, y).catch(() => {});

      const payload = generateAdversarialInput(rng);
      // Type into whatever has focus
      await page.keyboard.type(payload, { delay: 5 }).catch(() => {});
      // Try pressing Enter
      await page.keyboard.press('Enter').catch(() => {});

      return `fuzz-input: (${x},${y}) "${payload.slice(0, 20)}${payload.length > 20 ? '...' : ''}"`;
    }

    case 'paste-bomb': {
      // Click somewhere, then paste a huge string
      const { x, y } = await getRandomViewportCoords(page, rng);
      await page.mouse.click(x, y).catch(() => {});

      const bomb = 'X'.repeat(rng.int(1000, 10000));
      await page.keyboard.insertText(bomb).catch(() => {});

      return `paste-bomb: (${x},${y}) ${bomb.length} chars`;
    }

    case 'blur-focus-spam': {
      // Just mash Tab key repeatedly - no need to find elements first
      const iterations = rng.int(5, 15);
      for (let i = 0; i < iterations; i++) {
        await page.keyboard.press('Tab').catch(() => {});
      }
      return `blur-focus-spam: ${iterations} tabs`;
    }

    default:
      return null;
  }
}

/**
 * Format chaos test results as a GitHub issue body
 * Use this to create automated bug reports from chaos test failures
 */
export function formatChaosResultAsIssueBody(
  result: ChaosResult | DemonChaosResult,
  testName: string,
  page?: string
): string {
  const lines: string[] = [];

  lines.push(`## Chaos Test Failure Report`);
  lines.push('');
  lines.push(`**Test:** ${testName}`);
  lines.push(`**Seed:** ${result.seed} (use this to reproduce)`);
  lines.push(`**Page:** ${page || 'Unknown'}`);
  lines.push(`**Actions Performed:** ${result.actionsPerformed}`);
  lines.push(`**Errors Found:** ${result.errors.length}`);
  lines.push(`**Recoveries:** ${result.recoveries}`);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push(`### Errors (${result.errors.length})`);
    lines.push('');
    lines.push('```');
    // Dedupe errors and show count
    const errorCounts = new Map<string, number>();
    for (const error of result.errors) {
      const key = error.slice(0, 100); // Truncate for grouping
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }
    for (const [error, count] of errorCounts.entries()) {
      lines.push(count > 1 ? `(x${count}) ${error}` : error);
    }
    lines.push('```');
    lines.push('');
  }

  lines.push('### Last 10 Actions Before Failure');
  lines.push('');
  lines.push('```');
  const lastActions = result.actions.slice(-10);
  for (const action of lastActions) {
    lines.push(action);
  }
  lines.push('```');
  lines.push('');

  lines.push('### Reproduction');
  lines.push('');
  lines.push('```bash');
  lines.push(`# Run with the same seed to reproduce`);
  lines.push(`CHAOS_SEED=${result.seed} npx playwright test chaos/ --grep "${testName}"`);
  lines.push('```');
  lines.push('');

  lines.push('---');
  lines.push('*This issue was auto-generated by chaos tests*');

  return lines.join('\n');
}

/**
 * Print a summary of all errors found during chaos testing
 * Useful for CI output
 */
export function printChaosErrorSummary(
  results: Array<{ name: string; result: ChaosResult | DemonChaosResult }>
): void {
  const totalErrors = results.reduce((sum, r) => sum + r.result.errors.length, 0);
  const totalRecoveries = results.reduce((sum, r) => sum + r.result.recoveries, 0);

  console.log('\n' + '='.repeat(60));
  console.log('CHAOS TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Total Recoveries: ${totalRecoveries}`);
  console.log('');

  for (const { name, result } of results) {
    if (result.errors.length > 0) {
      console.log(`\n❌ ${name} (seed: ${result.seed})`);
      console.log(`   Actions: ${result.actionsPerformed}, Errors: ${result.errors.length}, Recoveries: ${result.recoveries}`);
      console.log('   Errors:');
      // Show first 3 unique errors
      const uniqueErrors = [...new Set(result.errors)].slice(0, 3);
      for (const error of uniqueErrors) {
        console.log(`     - ${error.slice(0, 80)}${error.length > 80 ? '...' : ''}`);
      }
      if (result.errors.length > 3) {
        console.log(`     ... and ${result.errors.length - 3} more`);
      }
    } else {
      console.log(`✅ ${name} (seed: ${result.seed}) - ${result.actionsPerformed} actions, 0 errors`);
    }
  }

  console.log('\n' + '='.repeat(60));
}
