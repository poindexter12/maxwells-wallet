import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MerchantsPanel from './MerchantsPanel'

describe('MerchantsPanel', () => {
  it('renders loading state initially', () => {
    render(<MerchantsPanel />)
    expect(screen.getByTestId('merchants-loading')).toBeInTheDocument()
  })

  it('renders panel after loading', async () => {
    render(<MerchantsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('merchants-panel')).toBeInTheDocument()
    })
  })

  it('displays aliases list', async () => {
    render(<MerchantsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('aliases-list')).toBeInTheDocument()
    })
    expect(screen.getByText('Aliases (2)')).toBeInTheDocument()
  })

  it('displays existing aliases', async () => {
    render(<MerchantsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('alias-row-1')).toBeInTheDocument()
    })
    expect(screen.getByText('AMZN')).toBeInTheDocument()
    expect(screen.getByText('Amazon')).toBeInTheDocument()
    expect(screen.getByText('Used 15x')).toBeInTheDocument()
  })

  it('displays merchants list', async () => {
    render(<MerchantsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('merchants-list')).toBeInTheDocument()
    })
    expect(screen.getByText('All Merchants (3)')).toBeInTheDocument()
  })

  it('displays merchant rows', async () => {
    render(<MerchantsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('merchant-row-0')).toBeInTheDocument()
    })
    expect(screen.getByText('AMZN MKTP US*123ABC')).toBeInTheDocument()
    expect(screen.getByText('15 txns')).toBeInTheDocument()
  })

  it('has new alias button', async () => {
    render(<MerchantsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('new-alias-btn')).toBeInTheDocument()
    })
    expect(screen.getByText('+ New Alias')).toBeInTheDocument()
  })

  it('has preview changes button', async () => {
    render(<MerchantsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('preview-btn')).toBeInTheDocument()
    })
    expect(screen.getByText('Preview Changes')).toBeInTheDocument()
  })

  it('opens alias form when new alias clicked', async () => {
    const user = userEvent.setup()
    render(<MerchantsPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('new-alias-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('new-alias-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('alias-form')).toBeInTheDocument()
    })
  })

  it('form has pattern and canonical name inputs', async () => {
    const user = userEvent.setup()
    render(<MerchantsPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('new-alias-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('new-alias-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('alias-pattern-input')).toBeInTheDocument()
    })
    expect(screen.getByTestId('alias-canonical-input')).toBeInTheDocument()
    expect(screen.getByTestId('alias-match-type-select')).toBeInTheDocument()
    expect(screen.getByTestId('alias-priority-input')).toBeInTheDocument()
  })

  it('can filter merchants by search', async () => {
    const user = userEvent.setup()
    render(<MerchantsPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('merchant-search-input')).toBeInTheDocument()
    })

    await user.type(screen.getByTestId('merchant-search-input'), 'UBER')

    await waitFor(() => {
      expect(screen.getByText('UBER *TRIP')).toBeInTheDocument()
    })
    expect(screen.queryByText('AMZN MKTP US*123ABC')).not.toBeInTheDocument()
  })

  it('clicking merchant starts alias creation', async () => {
    const user = userEvent.setup()
    render(<MerchantsPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('merchant-row-0')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('merchant-row-0'))

    await waitFor(() => {
      expect(screen.getByTestId('alias-form')).toBeInTheDocument()
    })
    // The pattern should be pre-filled
    expect(screen.getByTestId('alias-pattern-input')).toHaveValue('AMZN MKTP US*123ABC')
  })

  it('can edit existing alias', async () => {
    const user = userEvent.setup()
    render(<MerchantsPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('edit-alias-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('edit-alias-1'))

    await waitFor(() => {
      expect(screen.getByTestId('alias-form')).toBeInTheDocument()
    })
    expect(screen.getByTestId('alias-pattern-input')).toHaveValue('AMZN')
    expect(screen.getByTestId('alias-canonical-input')).toHaveValue('Amazon')
  })

  it('shows match type badges', async () => {
    render(<MerchantsPanel />)
    await waitFor(() => {
      expect(screen.getAllByText('contains').length).toBeGreaterThan(0)
    })
  })
})
