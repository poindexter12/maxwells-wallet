import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardConfig } from './DashboardConfig'

const mockWidgets = [
  {
    id: 1,
    widget_type: 'summary',
    title: 'Monthly Summary',
    position: 0,
    width: 'full',
    is_visible: true,
    config: null,
  },
  {
    id: 2,
    widget_type: 'bucket_pie',
    title: 'Spending by Category',
    position: 1,
    width: 'half',
    is_visible: true,
    config: null,
  },
  {
    id: 3,
    widget_type: 'trends',
    title: null, // Tests fallback to widget_type
    position: 2,
    width: 'half',
    is_visible: false,
    config: JSON.stringify({ buckets: ['groceries', 'dining'] }),
  },
]

describe('DashboardConfig', () => {
  const mockToggleVisibility = vi.fn()
  const mockMoveUp = vi.fn()
  const mockMoveDown = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = (widgets = mockWidgets) => {
    return render(
      <DashboardConfig
        widgets={widgets}
        onToggleVisibility={mockToggleVisibility}
        onMoveUp={mockMoveUp}
        onMoveDown={mockMoveDown}
      />
    )
  }

  describe('initial state', () => {
    it('renders customize button', () => {
      renderComponent()

      expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument()
    })

    it('panel is closed by default', () => {
      renderComponent()

      expect(screen.queryByText('Quick Widget Toggle')).not.toBeInTheDocument()
    })
  })

  describe('opening and closing panel', () => {
    it('opens panel when customize button is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      expect(screen.getByText('Quick Widget Toggle')).toBeInTheDocument()
    })

    it('closes panel when backdrop is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))
      expect(screen.getByText('Quick Widget Toggle')).toBeInTheDocument()

      // Click the backdrop (fixed inset-0 div)
      const backdrop = document.querySelector('.fixed.inset-0')
      await user.click(backdrop!)

      expect(screen.queryByText('Quick Widget Toggle')).not.toBeInTheDocument()
    })

    it('closes panel when toggle button is clicked again', async () => {
      const user = userEvent.setup()
      renderComponent()

      const customizeButton = screen.getByRole('button', { name: /customize/i })
      await user.click(customizeButton)
      expect(screen.getByText('Quick Widget Toggle')).toBeInTheDocument()

      await user.click(customizeButton)
      expect(screen.queryByText('Quick Widget Toggle')).not.toBeInTheDocument()
    })
  })

  describe('widget list', () => {
    it('displays all widgets sorted by position', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      expect(screen.getByText('Monthly Summary')).toBeInTheDocument()
      expect(screen.getByText('Spending by Category')).toBeInTheDocument()
      expect(screen.getByText('trends')).toBeInTheDocument() // Falls back to widget_type when title is null
    })

    it('shows widget type icons', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      // Check for emoji icons
      expect(screen.getByText('📊')).toBeInTheDocument() // summary
      expect(screen.getByText('🥧')).toBeInTheDocument() // bucket_pie
      expect(screen.getByText('📈')).toBeInTheDocument() // trends
    })

    it('shows "Filtered" label for widgets with bucket filters', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      expect(screen.getByText('Filtered')).toBeInTheDocument()
    })

    it('shows checkmark for visible widgets', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      const visibilityButtons = screen.getAllByTitle(/hide widget|show widget/i)
      // First two widgets are visible
      expect(visibilityButtons[0]).toHaveTextContent('✓')
      expect(visibilityButtons[1]).toHaveTextContent('✓')
      // Third widget is not visible
      expect(visibilityButtons[2]).not.toHaveTextContent('✓')
    })
  })

  describe('visibility toggle', () => {
    it('calls onToggleVisibility when visibility button is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      const hideButtons = screen.getAllByTitle('Hide widget')
      await user.click(hideButtons[0])

      expect(mockToggleVisibility).toHaveBeenCalledWith(1)
    })

    it('calls onToggleVisibility for hidden widgets', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      const showButton = screen.getByTitle('Show widget')
      await user.click(showButton)

      expect(mockToggleVisibility).toHaveBeenCalledWith(3)
    })
  })

  describe('reordering', () => {
    it('calls onMoveUp when up arrow is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      const moveUpButtons = screen.getAllByTitle('Move up')
      // Click move up on second widget
      await user.click(moveUpButtons[1])

      expect(mockMoveUp).toHaveBeenCalledWith(2)
    })

    it('calls onMoveDown when down arrow is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      const moveDownButtons = screen.getAllByTitle('Move down')
      // Click move down on first widget
      await user.click(moveDownButtons[0])

      expect(mockMoveDown).toHaveBeenCalledWith(1)
    })

    it('disables move up for first widget', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      const moveUpButtons = screen.getAllByTitle('Move up')
      expect(moveUpButtons[0]).toBeDisabled()
    })

    it('disables move down for last widget', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      const moveDownButtons = screen.getAllByTitle('Move down')
      expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled()
    })
  })

  describe('full configuration link', () => {
    it('shows link to full configuration page', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('button', { name: /customize/i }))

      const link = screen.getByRole('link', { name: /full configuration/i })
      expect(link).toHaveAttribute('href', '/dashboard/configure')
    })
  })

  describe('empty state', () => {
    it('handles empty widget list', async () => {
      const user = userEvent.setup()
      renderComponent([])

      await user.click(screen.getByRole('button', { name: /customize/i }))

      expect(screen.getByText('Quick Widget Toggle')).toBeInTheDocument()
      // No visibility buttons since no widgets
      expect(screen.queryByTitle('Hide widget')).not.toBeInTheDocument()
    })
  })
})
