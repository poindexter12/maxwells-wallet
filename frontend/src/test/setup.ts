import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from './mocks/server'

// Mock next-intl for tests
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    // Return the key with interpolated values for testing
    if (values) {
      let result = key
      for (const [k, v] of Object.entries(values)) {
        result = result.replace(`{${k}}`, String(v))
      }
      return result
    }
    return key
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
