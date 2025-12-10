/**
 * i18n E2E Tests
 *
 * Tests that all UI strings are properly translated by using l33t speak mode.
 * When l33t is set as the language, ALL English characters should be transformed:
 * - a → 4
 * - e → 3
 * - i → 1
 * - o → 0
 * - s → 5
 * - t → 7
 * - g → 9
 *
 * If any text contains untransformed characters, it means the string wasn't translated.
 *
 * @tags @e2e
 */
import { test, expect, Page } from '@playwright/test'

// Common English words that should NEVER appear when l33t is active
// These words all contain characters that should be transformed
const FORBIDDEN_ENGLISH_WORDS = [
  'loading', // l04d1ng
  'save', // 54v3
  'cancel', // c4nc3l
  'delete', // d3l373
  'edit', // 3d17
  'create', // cr3473
  'search', // 534rch
  'filter', // f1l73r
  'the', // 7h3
  'and', // 4nd
  'transactions', // 7r4n54c710n5
  'dashboard', // d45hb04rd
  'settings', // 5377in95
  'import', // 1mp0r7
  'budget', // bud937
]

// Pages to test
const TEST_PAGES = [
  '/',
  '/transactions',
  '/budgets',
  '/organize',
  '/tools',
  '/admin',
  '/import',
]

/**
 * Check if any forbidden English words appear in the page text
 */
async function findUntranslatedStrings(page: Page): Promise<string[]> {
  // Get all visible text from the page body
  const bodyText = await page.evaluate(() => {
    // Get text content but exclude script/style tags
    const body = document.body
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        const tag = parent.tagName.toLowerCase()
        if (tag === 'script' || tag === 'style' || tag === 'noscript') {
          return NodeFilter.FILTER_REJECT
        }
        // Skip hidden elements
        const style = window.getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })

    const texts: string[] = []
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim()
      if (text) texts.push(text)
    }
    return texts.join(' ')
  })

  const lowerText = bodyText.toLowerCase()
  const found: string[] = []

  for (const word of FORBIDDEN_ENGLISH_WORDS) {
    // Use word boundaries to avoid false positives
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    if (regex.test(lowerText)) {
      found.push(word)
    }
  }

  return found
}

// TODO: Re-enable once l33t translations are complete (see issue #105)
test.describe.skip('i18n Translation Completeness @e2e', () => {
  test.beforeEach(async ({ page }) => {
    // Set language to l33t speak via localStorage
    // We need to set this before the first navigation
    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'l33t')
    })
  })

  for (const path of TEST_PAGES) {
    test(`Page ${path} should have all strings translated in l33t mode`, async ({ page }) => {
      await page.goto(path)

      // Wait for page to fully load
      await page.waitForLoadState('networkidle')

      // Give React a moment to render translations
      await page.waitForTimeout(500)

      // Find any untranslated strings
      const untranslated = await findUntranslatedStrings(page)

      // Report findings
      if (untranslated.length > 0) {
        // Take a screenshot for debugging
        await page.screenshot({ path: `playwright-report/i18n-${path.replace(/\//g, '_') || 'home'}.png` })
      }

      expect(
        untranslated,
        `Found ${untranslated.length} untranslated English words on ${path}: ${untranslated.join(', ')}. ` +
        `These words should be in l33t speak when the l33t language is active.`
      ).toHaveLength(0)
    })
  }

  test('NavBar should be fully translated in l33t mode', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check nav links specifically
    const navText = await page.locator('nav').textContent()

    // In l33t, "Dashboard" becomes "d45hb04rd" - no 'a', 'e', 'o' should remain
    const hasUntranslatedNav =
      navText?.toLowerCase().includes('dashboard') ||
      navText?.toLowerCase().includes('transactions') ||
      navText?.toLowerCase().includes('budgets') ||
      navText?.toLowerCase().includes('admin')

    expect(
      hasUntranslatedNav,
      `NavBar contains untranslated English text: "${navText}"`
    ).toBe(false)
  })
})
