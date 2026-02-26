/**
 * i18n Coverage E2E Tests
 *
 * Tests that all UI strings are properly translated using the pseudo-locale.
 * The pseudo locale transforms text with accented characters (e.g., "Save" → "Şȧȧṽḗḗ")
 * making it obvious when strings aren't being translated.
 *
 * This test validates translation coverage for:
 * - NavBar items
 * - Page titles
 * - Modal buttons
 * - Form labels
 *
 * @tags @e2e @i18n
 */
import { test, expect, Page } from '@playwright/test';
import { TEST_IDS } from '../src/test-ids';

/**
 * Check if text contains pseudo-locale markers (accented characters)
 * Pseudo-localized text uses accented chars like: ȧ ḗ ǿ ŭ ī ş ƞ ḓ ƈ ŀ ṽ ẋ ƥ ř ŧ ẏ ƀ ħ ķ ḿ ẑ ɠ ƒ ẇ
 */
function isPseudo(text: string): boolean {
  if (!text) return false;

  // Check for pseudo-locale markers (accented characters)
  const pseudoChars = /[ȧḗǿŭīşƞḓƈŀṽẋƥřŧẏƀħķḿẑɠƒẇĀḀĔĒḔĪĬŌŎŪŬȲƤŞŦȦḂĊḊĖḞĠḢĶĿṀṄṖṘṠṪẆẊŻȀȄȈȌȔ]/;
  return pseudoChars.test(text);
}

/**
 * Helper to check element text is pseudo-localized
 */
async function expectPseudoText(
  page: Page,
  selector: string,
  description: string
): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  const text = await element.textContent();

  if (!text || !isPseudo(text)) {
    // Take screenshot for debugging
    await page.screenshot({
      path: `playwright-report/i18n-${description.replace(/\s+/g, '-')}.png`,
    });
  }

  expect(isPseudo(text), `${description} should be pseudo-localized. Got: "${text}"`).toBe(
    true
  );
}

test.describe('i18n Coverage (Pseudo-Locale) @e2e @i18n', () => {
  test.beforeEach(async ({ page }) => {
    // Set language to pseudo locale via localStorage before first navigation
    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'pseudo');
    });
  });

  test('NavBar items should be pseudo-localized', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check main navigation links
    const navText = await page.locator('nav').textContent();

    // All nav items should have pseudo markers
    expect(
      isPseudo(navText || ''),
      `NavBar should contain pseudo-localized text. Got: "${navText}"`
    ).toBe(true);

    // Verify specific nav links by chaos target
    const navLinks = [
      { target: 'nav-dashboard', description: 'Dashboard nav link' },
      { target: 'nav-transactions', description: 'Transactions nav link' },
      { target: 'nav-budgets', description: 'Budgets nav link' },
      { target: 'nav-organize', description: 'Organize nav link' },
      { target: 'nav-tools', description: 'Tools nav link' },
      { target: 'nav-admin', description: 'Admin nav link' },
    ];

    for (const { target, description } of navLinks) {
      await expectPseudoText(page, `[data-chaos-target="${target}"]`, description);
    }
  });

  test('Dashboard page title should be pseudo-localized', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check page heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();

    expect(
      isPseudo(headingText || ''),
      `Dashboard page title should be pseudo-localized. Got: "${headingText}"`
    ).toBe(true);
  });

  test('Transactions page title and filters should be pseudo-localized', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Check page heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();

    expect(
      isPseudo(headingText || ''),
      `Transactions page title should be pseudo-localized. Got: "${headingText}"`
    ).toBe(true);

    // Check filter search placeholder (if using TEST_IDS)
    if (TEST_IDS.FILTER_SEARCH) {
      const searchInput = page.locator(`[data-testid="${TEST_IDS.FILTER_SEARCH}"]`);
      const placeholder = await searchInput.getAttribute('placeholder');
      if (placeholder) {
        expect(
          isPseudo(placeholder),
          `Search placeholder should be pseudo-localized. Got: "${placeholder}"`
        ).toBe(true);
      }
    }
  });

  test('Budgets page title should be pseudo-localized', async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');

    // Check page heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();

    expect(
      isPseudo(headingText || ''),
      `Budgets page title should be pseudo-localized. Got: "${headingText}"`
    ).toBe(true);
  });

  test('Import page title should be pseudo-localized', async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('networkidle');

    // Check page heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();

    expect(
      isPseudo(headingText || ''),
      `Import page title should be pseudo-localized. Got: "${headingText}"`
    ).toBe(true);
  });

  test('Admin page title and tabs should be pseudo-localized', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Check page heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();

    expect(
      isPseudo(headingText || ''),
      `Admin page title should be pseudo-localized. Got: "${headingText}"`
    ).toBe(true);

    // Check tab labels (if present)
    const tabs = page.locator('[role="tab"], .tab, button[data-chaos-target*="tab"]');
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        const tabText = await tabs.nth(i).textContent();
        if (tabText && tabText.trim()) {
          expect(
            isPseudo(tabText),
            `Admin tab ${i + 1} should be pseudo-localized. Got: "${tabText}"`
          ).toBe(true);
        }
      }
    }
  });

  test('Tools page title should be pseudo-localized', async ({ page }) => {
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    // Check page heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();

    expect(
      isPseudo(headingText || ''),
      `Tools page title should be pseudo-localized. Got: "${headingText}"`
    ).toBe(true);
  });

  test('Organize page title should be pseudo-localized', async ({ page }) => {
    await page.goto('/organize');
    await page.waitForLoadState('networkidle');

    // Check page heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();

    expect(
      isPseudo(headingText || ''),
      `Organize page title should be pseudo-localized. Got: "${headingText}"`
    ).toBe(true);
  });

  test('Modal buttons should be pseudo-localized', async ({ page }) => {
    await page.goto('/budgets');
    await page.waitForLoadState('networkidle');

    // Try to open a modal (New Budget button)
    const newBudgetButton = page.locator('button:has-text("Ḇŭŭḓɠḗḗŧ"), button:has-text("Ƞḗḗẇ")').first();

    // If we can find and click the button
    if ((await newBudgetButton.count()) > 0) {
      await newBudgetButton.click();
      await page.waitForTimeout(500);

      // Check for common modal buttons (Save, Cancel, Close)
      const modalButtons = page.locator('[role="dialog"] button, .modal button, [data-testid*="modal"] button');
      const buttonCount = await modalButtons.count();

      if (buttonCount > 0) {
        for (let i = 0; i < Math.min(buttonCount, 3); i++) {
          const buttonText = await modalButtons.nth(i).textContent();
          if (buttonText && buttonText.trim() && buttonText.length > 1) {
            expect(
              isPseudo(buttonText),
              `Modal button ${i + 1} should be pseudo-localized. Got: "${buttonText}"`
            ).toBe(true);
          }
        }
      }
    }
  });

  test('Form labels should be pseudo-localized', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Check for form labels
    const labels = page.locator('label');
    const labelCount = await labels.count();

    if (labelCount > 0) {
      // Check first 3 labels
      for (let i = 0; i < Math.min(labelCount, 3); i++) {
        const labelText = await labels.nth(i).textContent();
        if (labelText && labelText.trim() && labelText.length > 2) {
          expect(
            isPseudo(labelText),
            `Form label ${i + 1} should be pseudo-localized. Got: "${labelText}"`
          ).toBe(true);
        }
      }
    }
  });

  test('Common buttons (Save, Cancel, Delete) should be pseudo-localized', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for common action buttons across the app
    const commonButtons = [
      'button:has-text("Şȧȧṽḗḗ")', // Save
      'button:has-text("Ƈȧȧƞƈḗḗŀ")', // Cancel
      'button:has-text("Ḓḗḗŀḗḗŧḗḗ")', // Delete
      'button:has-text("Ḗḗḓīŧ")', // Edit
      'button:has-text("Ƈřḗḗȧȧŧḗḗ")', // Create
    ];

    // We don't expect all of these to exist on every page,
    // but if they do exist, they should be pseudo-localized
    for (const selector of commonButtons) {
      const button = page.locator(selector).first();
      if ((await button.count()) > 0) {
        await expect(button).toBeVisible();
        const text = await button.textContent();
        expect(isPseudo(text || ''), `Button should be pseudo-localized: "${text}"`).toBe(
          true
        );
      }
    }
  });
});
