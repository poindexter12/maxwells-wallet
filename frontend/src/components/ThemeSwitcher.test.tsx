import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeSwitcher } from './ThemeSwitcher'

// Create a functional localStorage mock
function createLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
    _reset: () => { store = {} },
  }
}

describe('ThemeSwitcher', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>

  beforeEach(() => {
    localStorageMock = createLocalStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a theme select dropdown', async () => {
    render(<ThemeSwitcher />)

    await waitFor(() => {
      // aria-label is translated "Theme"
      expect(screen.getByRole('combobox', { name: /theme/i })).toBeInTheDocument()
    })
  })

  it('shows all available themes', async () => {
    render(<ThemeSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Ledger' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Dark' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Cyberpunk' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Soft' })).toBeInTheDocument()
    })
  })

  it('defaults to ledger theme', async () => {
    render(<ThemeSwitcher />)

    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /theme/i })
      expect(select).toHaveValue('ledger')
    })
  })

  it('loads saved theme from localStorage', async () => {
    localStorageMock.setItem('maxwell-wallet-theme', 'dark')

    render(<ThemeSwitcher />)

    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /theme/i })
      expect(select).toHaveValue('dark')
    })
  })

  it('saves theme to localStorage when changed', async () => {
    const user = userEvent.setup()
    render(<ThemeSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeEnabled()
    })

    const select = screen.getByRole('combobox', { name: /theme/i })
    await user.selectOptions(select, 'cyberpunk')

    expect(localStorageMock.getItem('maxwell-wallet-theme')).toBe('cyberpunk')
  })

  it('sets data-theme attribute on document', async () => {
    const user = userEvent.setup()
    render(<ThemeSwitcher />)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeEnabled()
    })

    const select = screen.getByRole('combobox', { name: /theme/i })
    await user.selectOptions(select, 'soft')

    expect(document.documentElement.getAttribute('data-theme')).toBe('soft')
  })

  it('migrates old neon theme to cyberpunk', async () => {
    localStorageMock.setItem('maxwell-wallet-theme', 'neon')

    render(<ThemeSwitcher />)

    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /theme/i })
      expect(select).toHaveValue('cyberpunk')
    })

    expect(localStorageMock.getItem('maxwell-wallet-theme')).toBe('cyberpunk')
  })
})
