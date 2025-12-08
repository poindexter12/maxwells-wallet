import { Page, Locator } from '@playwright/test';
import { getChaosExcludeSelectors } from '../../src/test-ids';

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
  | 'click-button'
  | 'click-link'
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
}

export interface ChaosResult {
  seed: number;
  actionsPerformed: number;
  errors: string[];
  actions: string[];
}

const DEFAULT_ACTION_TYPES: ActionType[] = [
  'click-button',
  'click-link',
  'fill-input',
  'scroll',
  'hover',
  'press-key',
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
  const timeout = options.timeout ?? 2000;

  const errors: string[] = [];
  const actionsLog: string[] = [];

  // Capture page errors
  const errorHandler = (error: Error) => {
    errors.push(error.message);
  };
  page.on('pageerror', errorHandler);

  console.log(`🐒 Chaos monkey starting with seed: ${seed}`);

  for (let i = 0; i < options.actions; i++) {
    const actionType = rng.pick(actionTypes);

    try {
      const actionDesc = await executeAction(
        page,
        actionType,
        rng,
        excludeSelectors,
        timeout
      );
      actionsLog.push(`${i + 1}. ${actionDesc}`);
      options.onAction?.(actionDesc, i);
    } catch (e) {
      // Individual action failures are expected in chaos testing
      const msg = e instanceof Error ? e.message : String(e);
      actionsLog.push(`${i + 1}. [FAILED] ${actionType}: ${msg}`);
    }

    // Random delay between actions
    await page.waitForTimeout(rng.int(minDelay, maxDelay));

    // Early exit if we hit a crash
    if (errors.length > 0) {
      console.log(`🔥 Crash detected after action ${i + 1}`);
      break;
    }
  }

  page.off('pageerror', errorHandler);

  console.log(`🐒 Chaos monkey completed. Actions: ${actionsLog.length}, Errors: ${errors.length}`);

  return {
    seed,
    actionsPerformed: actionsLog.length,
    errors,
    actions: actionsLog,
  };
}

async function executeAction(
  page: Page,
  actionType: ActionType,
  rng: SeededRandom,
  excludeSelectors: string[],
  timeout: number
): Promise<string> {
  switch (actionType) {
    case 'click-button': {
      const buttons = await getVisibleElements(
        page,
        'button:visible',
        excludeSelectors
      );
      if (buttons.length === 0) return 'click-button: no buttons found';

      const button = rng.pick(buttons);
      const text = await button.textContent();
      await button.click({ timeout });
      return `click-button: "${text?.trim().slice(0, 30) || 'unnamed'}"`;
    }

    case 'click-link': {
      const links = await getVisibleElements(
        page,
        'a:visible',
        excludeSelectors
      );
      if (links.length === 0) return 'click-link: no links found';

      const link = rng.pick(links);
      const text = await link.textContent();
      await link.click({ timeout });
      return `click-link: "${text?.trim().slice(0, 30) || 'unnamed'}"`;
    }

    case 'fill-input': {
      const inputs = await getVisibleElements(
        page,
        'input:visible:not([type=file]):not([type=hidden]):not([readonly])',
        excludeSelectors
      );
      if (inputs.length === 0) return 'fill-input: no inputs found';

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
      if (selects.length === 0) return 'select-option: no selects found';

      const select = rng.pick(selects);
      const options = await select.locator('option').all();
      if (options.length === 0) return 'select-option: no options';

      const option = rng.pick(options);
      const value = await option.getAttribute('value');
      if (value) {
        await select.selectOption(value);
        return `select-option: "${value}"`;
      }
      return 'select-option: no value';
    }

    case 'scroll': {
      const direction = rng.pick(['up', 'down', 'left', 'right']);
      const amount = rng.int(100, 500);
      const deltaX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
      const deltaY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
      await page.mouse.wheel(deltaX, deltaY);
      return `scroll: ${direction} ${amount}px`;
    }

    case 'hover': {
      const elements = await getVisibleElements(
        page,
        'button:visible, a:visible, [role="button"]:visible',
        excludeSelectors
      );
      if (elements.length === 0) return 'hover: no elements found';

      const element = rng.pick(elements);
      await element.hover({ timeout });
      const text = await element.textContent();
      return `hover: "${text?.trim().slice(0, 30) || 'unnamed'}"`;
    }

    case 'press-key': {
      const keys = ['Tab', 'Escape', 'Enter', 'ArrowDown', 'ArrowUp'];
      const key = rng.pick(keys);
      await page.keyboard.press(key);
      return `press-key: ${key}`;
    }

    default:
      return `unknown action: ${actionType}`;
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
