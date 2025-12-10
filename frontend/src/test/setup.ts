import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { server } from './mocks/server'
import messages from '../messages/en-US.json'

// Helper to get nested value from messages object
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

// Mock next-intl for tests - returns actual English translations
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key
      let result = getNestedValue(messages, fullKey)

      // If not found, return the key itself
      if (result === undefined) {
        return key
      }

      // Handle string interpolation
      if (typeof result === 'string' && values) {
        for (const [k, v] of Object.entries(values)) {
          result = (result as string).replace(`{${k}}`, String(v))
        }
      }

      return result
    }
    // Add raw method for arrays
    t.raw = (key: string) => {
      const fullKey = namespace ? `${namespace}.${key}` : key
      return getNestedValue(messages, fullKey)
    }
    return t
  },
  useLocale: () => 'en-US',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))

// Reset handlers after each test (important for test isolation)
afterEach(() => server.resetHandlers())

// Clean up after all tests
afterAll(() => server.close())

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Reset mocks between tests
beforeEach(() => {
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
})
