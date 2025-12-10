import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SplitTransaction } from './SplitTransaction'
import { mockBucketTags } from '@/test/mocks/fixtures'
import { resetTransactionSplits } from '@/test/mocks/handlers'

// Transaction ID 1 exists in mock data with amount -45.50
const TRANSACTION_ID = 1
const TRANSACTION_AMOUNT = -45.50

describe('SplitTransaction', () => {
  const mockOnSplitsChanged = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    resetTransactionSplits()
  })

  const renderComponent = (props = {}) => {
    return render(
      <SplitTransaction
        transactionId={TRANSACTION_ID}
        transactionAmount={TRANSACTION_AMOUNT}
        bucketTags={mockBucketTags}
        onSplitsChanged={mockOnSplitsChanged}
        {...props}
      />
    )
  }

  describe('initial loading', () => {
    it('shows loading state initially', () => {
      renderComponent()

      expect(screen.getByTestId('split-loading')).toBeInTheDocument()
    })

    it('loads and displays split form after fetch', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      // Check for bucket select dropdown (form is rendered)
      expect(screen.getByTestId('split-bucket-select')).toBeInTheDocument()
    })
  })

  describe('progress bar', () => {
    it('shows 0% allocated when no splits', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      expect(screen.getByText('0%')).toBeInTheDocument()
      expect(screen.getByText(/\+\$0\.00 of \+\$45\.50 allocated/)).toBeInTheDocument()
    })

    it('shows unallocated amount', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      expect(screen.getByText('+$45.50 unallocated')).toBeInTheDocument()
    })
  })

  describe('adding splits', () => {
    it('shows bucket select dropdown', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      const select = screen.getByTestId('split-bucket-select')
      expect(select).toBeInTheDocument()

      // All bucket tags should be options (showing description as label)
      expect(screen.getByTestId('split-bucket-placeholder')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /food and groceries/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /restaurants and takeout/i })).toBeInTheDocument()
    })

    it('shows amount input', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument()
    })

    it('has disabled Add button when no bucket/amount selected', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /add/i })
      expect(addButton).toBeDisabled()
    })

    it('enables Add button when bucket and amount are filled', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      const select = screen.getByRole('combobox')
      const input = screen.getByPlaceholderText('0.00')
      const addButton = screen.getByRole('button', { name: /add/i })

      await user.selectOptions(select, 'groceries')
      await user.type(input, '20.00')

      expect(addButton).not.toBeDisabled()
    })

    it('adds a split when Add is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      const select = screen.getByRole('combobox')
      const input = screen.getByPlaceholderText('0.00')

      await user.selectOptions(select, 'groceries')
      await user.type(input, '20.00')
      await user.click(screen.getByRole('button', { name: /add/i }))

      // Wait for the amount to appear in a split item (not in the quick allocate section)
      await waitFor(() => {
        expect(screen.getByText('+$20.00')).toBeInTheDocument()
      })

      // Progress should update
      await waitFor(() => {
        expect(screen.getByText('44%')).toBeInTheDocument()
      })
    })

    it('updates progress bar after adding split', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      await user.selectOptions(screen.getByRole('combobox'), 'groceries')
      await user.type(screen.getByPlaceholderText('0.00'), '22.75')
      await user.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument()
      })
    })

    it('calls onSplitsChanged after adding', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      await user.selectOptions(screen.getByRole('combobox'), 'groceries')
      await user.type(screen.getByPlaceholderText('0.00'), '10')
      await user.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => {
        expect(mockOnSplitsChanged).toHaveBeenCalled()
      })
    })

    it('clears form after adding', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      const select = screen.getByRole('combobox')
      const input = screen.getByPlaceholderText('0.00')

      await user.selectOptions(select, 'groceries')
      await user.type(input, '20')
      await user.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => {
        expect(select).toHaveValue('')
        expect(input).toHaveValue(null)
      })
    })

    it('adds split when Enter is pressed in amount field', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      await user.selectOptions(screen.getByRole('combobox'), 'dining')
      const input = screen.getByPlaceholderText('0.00')
      await user.type(input, '15{enter}')

      // Wait for the split amount to appear
      await waitFor(() => {
        expect(screen.getByText('+$15.00')).toBeInTheDocument()
      })
    })
  })

  describe('removing splits', () => {
    it('shows remove button on each split', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      // Add a split first
      await user.selectOptions(screen.getByRole('combobox'), 'groceries')
      await user.type(screen.getByPlaceholderText('0.00'), '20')
      await user.click(screen.getByRole('button', { name: /add/i }))

      // Wait for split to appear (check by amount)
      await waitFor(() => {
        expect(screen.getByText('+$20.00')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByTestId('split-remove-button')
      expect(removeButtons.length).toBeGreaterThan(0)
    })

    it('removes split when remove button clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      // Add a split
      await user.selectOptions(screen.getByRole('combobox'), 'groceries')
      await user.type(screen.getByPlaceholderText('0.00'), '20')
      await user.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => {
        expect(screen.getByText('+$20.00')).toBeInTheDocument()
      })

      // Remove it (get the first remove button)
      const removeButtons = screen.getAllByTestId('split-remove-button')
      await user.click(removeButtons[0])

      await waitFor(() => {
        expect(screen.queryByText('+$20.00')).not.toBeInTheDocument()
      })

      // Progress should go back to 0%
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('clear all', () => {
    it('shows Clear all button when splits exist', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      // No clear all initially
      expect(screen.queryByText(/clear all/i)).not.toBeInTheDocument()

      // Add a split
      await user.selectOptions(screen.getByRole('combobox'), 'groceries')
      await user.type(screen.getByPlaceholderText('0.00'), '20')
      await user.click(screen.getByRole('button', { name: /add/i }))

      // Wait for split to be added
      await waitFor(() => {
        expect(screen.getByText('+$20.00')).toBeInTheDocument()
      })

      // Now Clear all should be visible
      expect(screen.getByText(/clear all/i)).toBeInTheDocument()
    })

    it('clears all splits when Clear all is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      // Add a split
      await user.selectOptions(screen.getByRole('combobox'), 'groceries')
      await user.type(screen.getByPlaceholderText('0.00'), '20')
      await user.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => {
        expect(screen.getByText('+$20.00')).toBeInTheDocument()
      })

      // Add another split
      await user.selectOptions(screen.getByRole('combobox'), 'dining')
      await user.type(screen.getByPlaceholderText('0.00'), '15')
      await user.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => {
        expect(screen.getByText('+$15.00')).toBeInTheDocument()
      })

      // Clear all
      await user.click(screen.getByText(/clear all/i))

      await waitFor(() => {
        expect(screen.queryByText('+$20.00')).not.toBeInTheDocument()
        expect(screen.queryByText('+$15.00')).not.toBeInTheDocument()
      })

      // Progress should be back to 0%
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('quick allocate', () => {
    it('shows quick allocate buttons when unallocated > 0', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      expect(screen.getByText(/quick: allocate remaining/i)).toBeInTheDocument()
    })

    it('allocates remaining to bucket when quick button clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      // Find groceries quick button
      const quickButtons = screen.getAllByRole('button').filter(
        b => b.textContent === 'Food and groceries'
      )
      await user.click(quickButtons[0])

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument()
      })
    })
  })

  describe('validation', () => {
    it('shows error for invalid amount', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.queryByTestId('split-loading')).not.toBeInTheDocument()
      })

      await user.selectOptions(screen.getByRole('combobox'), 'groceries')
      await user.type(screen.getByPlaceholderText('0.00'), '-5')
      await user.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid positive amount/i)).toBeInTheDocument()
      })
    })
  })
})
