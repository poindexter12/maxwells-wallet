import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavBar } from './NavBar'

// Mock next/navigation
const mockPathname = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}))

// Mock ThemeSwitcher to simplify NavBar tests
vi.mock('@/components/ThemeSwitcher', () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher">Theme Switcher</div>,
}))

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' },
    logout: vi.fn(),
  }),
}))

describe('NavBar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/')
  })

  it('renders the brand logo and name', () => {
    render(<NavBar />)

    expect(screen.getByText("Maxwell's Wallet")).toBeInTheDocument()
    // Logo has empty alt text (decorative), so check by selector instead of role
    const brandLink = screen.getByRole('link', { name: /maxwell's wallet/i })
    expect(brandLink.querySelector('img')).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    render(<NavBar />)

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /budgets/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /organize/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /tools/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  it('includes the theme switcher', () => {
    render(<NavBar />)

    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument()
  })

  describe('active link highlighting', () => {
    it('marks Dashboard as active on home page', () => {
      mockPathname.mockReturnValue('/')
      render(<NavBar />)

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      expect(dashboardLink.className).toContain('nav-link-active')
    })

    it('marks Dashboard as active on /dashboard routes', () => {
      mockPathname.mockReturnValue('/dashboard/manage')
      render(<NavBar />)

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      expect(dashboardLink.className).toContain('nav-link-active')
    })

    it('marks Transactions as active on /transactions', () => {
      mockPathname.mockReturnValue('/transactions')
      render(<NavBar />)

      const transactionsLink = screen.getByRole('link', { name: /transactions/i })
      expect(transactionsLink.className).toContain('nav-link-active')
    })

    it('marks Budgets as active on /budgets', () => {
      mockPathname.mockReturnValue('/budgets')
      render(<NavBar />)

      const budgetsLink = screen.getByRole('link', { name: /budgets/i })
      expect(budgetsLink.className).toContain('nav-link-active')
    })

    it('marks Tools as active on /tools', () => {
      mockPathname.mockReturnValue('/tools')
      render(<NavBar />)

      const toolsLink = screen.getByRole('link', { name: /tools/i })
      expect(toolsLink.className).toContain('nav-link-active')
    })

    it('does not mark other links as active', () => {
      mockPathname.mockReturnValue('/transactions')
      render(<NavBar />)

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      const budgetsLink = screen.getByRole('link', { name: /budgets/i })

      expect(dashboardLink.className).not.toContain('nav-link-active')
      expect(budgetsLink.className).not.toContain('nav-link-active')
    })
  })

  it('links point to correct URLs', () => {
    render(<NavBar />)

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /transactions/i })).toHaveAttribute('href', '/transactions')
    expect(screen.getByRole('link', { name: /budgets/i })).toHaveAttribute('href', '/budgets')
    expect(screen.getByRole('link', { name: /organize/i })).toHaveAttribute('href', '/organize')
    expect(screen.getByRole('link', { name: /tools/i })).toHaveAttribute('href', '/tools')
    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin')
  })
})
