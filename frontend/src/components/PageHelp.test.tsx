import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PageHelp, InlineHelp } from './PageHelp'

describe('PageHelp', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
  })

  it('shows expanded panel on first visit', async () => {
    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Test description"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Test Help')).toBeInTheDocument()
    })

    expect(screen.getByText('Test description')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Got it')).toBeInTheDocument()
  })

  it('renders steps when provided', async () => {
    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
        steps={['Step one', 'Step two', 'Step three']}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('How to use')).toBeInTheDocument()
    })

    expect(screen.getByText('Step one')).toBeInTheDocument()
    expect(screen.getByText('Step two')).toBeInTheDocument()
    expect(screen.getByText('Step three')).toBeInTheDocument()
  })

  it('renders tips when provided', async () => {
    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
        tips={['Tip one', 'Tip two']}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Tips')).toBeInTheDocument()
    })

    expect(screen.getByText('Tip one')).toBeInTheDocument()
    expect(screen.getByText('Tip two')).toBeInTheDocument()
  })

  it('dismisses panel and saves to localStorage on "Got it" click', async () => {
    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Got it')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Got it'))

    expect(localStorage.setItem).toHaveBeenCalledWith('pagehelp-test-page', 'dismissed')
  })

  it('shows minimal help button when previously dismissed', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    // Should NOT show the full panel
    expect(screen.queryByText('Description')).not.toBeInTheDocument()
    expect(screen.queryByText('Got it')).not.toBeInTheDocument()
  })

  it('expands panel when help button clicked after dismissal', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Help'))

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  it('shows close button when expanded after dismissal', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Help'))

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument()
    })

    // Should NOT show "Got it" button after first dismissal
    expect(screen.queryByText('Got it')).not.toBeInTheDocument()
  })

  it('collapses on close click', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Help'))

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Close'))

    await waitFor(() => {
      expect(screen.queryByText('Description')).not.toBeInTheDocument()
    })
  })

  it('renders custom children content', async () => {
    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
      >
        <div data-testid="custom-content">Custom help content</div>
      </PageHelp>
    )

    await waitFor(() => {
      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    })
  })

  it('does not show "New" badge after first dismissal', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('dismissed')

    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
      />
    )

    // Click help to expand
    await waitFor(() => {
      expect(screen.getByText('Help')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Help'))

    await waitFor(() => {
      expect(screen.getByText('Test Help')).toBeInTheDocument()
    })

    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('loads correct state from localStorage for minimized', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('minimized')

    render(
      <PageHelp
        pageId="test-page"
        title="Test Help"
        description="Description"
      />
    )

    // Wait for component to load from localStorage
    await waitFor(() => {
      // Should show collapsed state (the header button should be visible)
      expect(screen.getByText('Test Help')).toBeInTheDocument()
    })
  })

  it('uses correct localStorage key based on pageId', async () => {
    render(
      <PageHelp
        pageId="unique-page-id"
        title="Test Help"
        description="Description"
      />
    )

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
