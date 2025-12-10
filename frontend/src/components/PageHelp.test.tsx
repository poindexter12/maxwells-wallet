import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PageHelp, InlineHelp } from './PageHelp'

// Use a real pageId that has translations in en-US.json
const TEST_PAGE_ID = 'dashboard'

describe('PageHelp', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
  })

  it('shows expanded panel on first visit', async () => {
    render(<PageHelp pageId={TEST_PAGE_ID} />)

    await waitFor(() => {
      // Should show the title from translations
      expect(screen.getByText('Dashboard Help')).toBeInTheDocument()
    })

    // Should show description
    expect(screen.getByText(/Get a quick overview/)).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Got it')).toBeInTheDocument()
  })

  it('renders steps when provided in translations', async () => {
    render(<PageHelp pageId={TEST_PAGE_ID} />)

    await waitFor(() => {
      expect(screen.getByText('How to use')).toBeInTheDocument()
    })

    // Dashboard has steps in translations
    expect(screen.getByText(/Use date range selector/)).toBeInTheDocument()
  })

  it('renders tips when provided in translations', async () => {
    render(<PageHelp pageId={TEST_PAGE_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Tips')).toBeInTheDocument()
    })

    // Dashboard has tips in translations
    expect(screen.getByText(/Click on chart elements/)).toBeInTheDocument()
  })

  it('dismisses panel and saves to localStorage on "Got it" click', async () => {
    render(<PageHelp pageId={TEST_PAGE_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Got it')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Got it'))

    expect(localStorage.setItem).toHaveBeenCalledWith(`pagehelp-${TEST_PAGE_ID}`, 'dismissed')
  })

  it('shows minimal help button when previously dismissed', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(<PageHelp pageId={TEST_PAGE_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    // Should NOT show the full panel content
    expect(screen.queryByText(/Get a quick overview/)).not.toBeInTheDocument()
    expect(screen.queryByText('Got it')).not.toBeInTheDocument()
  })

  it('expands panel when help button clicked after dismissal', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(<PageHelp pageId={TEST_PAGE_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Help'))

    await waitFor(() => {
      expect(screen.getByText(/Get a quick overview/)).toBeInTheDocument()
    })
  })

  it('shows close button when expanded after dismissal', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(<PageHelp pageId={TEST_PAGE_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Help'))

    await waitFor(() => {
      expect(screen.getByText('Hide help')).toBeInTheDocument()
    })

    // Should NOT show "Got it" button after first dismissal
    expect(screen.queryByText('Got it')).not.toBeInTheDocument()
  })

  it('collapses on close click', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(<PageHelp pageId={TEST_PAGE_ID} />)

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Help'))

    await waitFor(() => {
      expect(screen.getByText('Hide help')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Hide help'))

    await waitFor(() => {
      expect(screen.queryByText(/Get a quick overview/)).not.toBeInTheDocument()
    })
  })

  it('renders custom children content', async () => {
    render(
      <PageHelp pageId={TEST_PAGE_ID}>
        <div data-testid="custom-content">Custom help content</div>
      </PageHelp>
    )

    await waitFor(() => {
      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    })
  })

  it('does not show "New" badge after first dismissal', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(<PageHelp pageId={TEST_PAGE_ID} />)

    // Click help to expand
    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Help'))

    await waitFor(() => {
      expect(screen.getByText('Dashboard Help')).toBeInTheDocument()
    })

    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('loads correct state from localStorage for minimized', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('minimized')

    render(<PageHelp pageId={TEST_PAGE_ID} />)

    // Wait for component to load from localStorage
    await waitFor(() => {
      // Should show collapsed state (the header button should be visible)
      expect(screen.getByText('Dashboard Help')).toBeInTheDocument()
    })
  })

  it('uses correct localStorage key based on pageId', async () => {
    render(<PageHelp pageId="unique-page-id" />)

    await waitFor(() => {
      expect(localStorage.getItem).toHaveBeenCalledWith('pagehelp-unique-page-id')
    })
  })
})

describe('InlineHelp', () => {
  it('renders children content', () => {
    render(
      <InlineHelp>
        <span>Inline help text</span>
      </InlineHelp>
    )

    expect(screen.getByText('Inline help text')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <InlineHelp className="custom-class">
        <span>Content</span>
      </InlineHelp>
    )

    // InlineHelp wraps content in a div with the className
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('custom-class')
  })

  it('has correct base styling classes', () => {
    const { container } = render(
      <InlineHelp>
        <span>Content</span>
      </InlineHelp>
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('rounded-md')
    expect(wrapper).toHaveClass('bg-theme-subtle')
  })
})
