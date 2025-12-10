/**
 * i18n E2E Tests
 *
 * Tests that all UI strings are properly translated using the pseudo-locale.
 * The pseudo locale transforms text with accented characters (e.g., "Save" → "Şȧȧṽḗḗ")
 * making it obvious when strings aren't being translated.
 *
 * @tags @e2e
 */
import { test, expect, Page } from '@playwright/test'

// Regex patterns to detect untranslated text
// Pseudo-localized text uses accented chars like: ȧ ḗ ǿ ŭ ī ş ƞ ḓ ƈ ŀ ṽ ẋ ƥ ř ŧ ẏ ƀ ħ ķ ḿ ẑ ɠ ƒ ẇ
// English text won't have these characters

// Common English words that should NEVER appear when pseudo locale is active
// These words should all be transformed to use accented characters
const FORBIDDEN_ENGLISH_WORDS = [
  'loading',
  'save',
  'cancel',
  'delete',
  'edit',
  'create',
  'search',
  'filter',
  'transactions',
  'dashboard',
  'settings',
  'import',
  'budget',
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

// TODO: Re-enable once all pages have complete translations
// Currently only widget components are translated. NavBar, pages, and
// many other components still have hardcoded English strings.
test.describe.skip('i18n Translation Completeness @e2e', () => {
  test.beforeEach(async ({ page }) => {
    // Set language to pseudo locale via localStorage
    // We need to set this before the first navigation
    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'pseudo')
    })
  })

  for (const path of TEST_PAGES) {
    test(`Page ${path} should have all strings translated in pseudo mode`, async ({ page }) => {
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
        `These words should be pseudo-localized when the pseudo language is active.`
      ).toHaveLength(0)
    })
  }

  test('NavBar should be fully translated in pseudo mode', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check nav links specifically
    const navText = await page.locator('nav').textContent()

    // In pseudo locale, "Dashboard" becomes "Ḓȧȧşħƀǿǿȧȧřḓ" - no plain English chars
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
