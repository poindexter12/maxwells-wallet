import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopMerchantsList } from './TopMerchantsList'

describe('TopMerchantsList', () => {
  it('renders with default title', () => {
    render(<TopMerchantsList data={null} />)
    expect(screen.getByText('Top Merchants')).toBeInTheDocument()
  })

  it('renders custom title from widget', () => {
    const widget = {
      id: 1,
      widget_type: 'top_merchants',
      title: 'Custom Title',
      position: 0,
      width: 'half',
      is_visible: true,
      config: null
    }
    render(<TopMerchantsList widget={widget} data={null} />)
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<TopMerchantsList data={null} />)
    expect(screen.getByText('No merchant data available')).toBeInTheDocument()
  })

  it('shows empty state when merchants array is empty', () => {
    render(<TopMerchantsList data={{ merchants: [] }} />)
    expect(screen.getByText('No merchant data available')).toBeInTheDocument()
  })

  it('renders merchant list', () => {
    const data = {
      merchants: [
        { merchant: 'Amazon', amount: 500 },
        { merchant: 'Whole Foods', amount: 300 },
        { merchant: 'Starbucks', amount: 150 }
      ]
    }

    render(<TopMerchantsList data={data} />)

    expect(screen.getByText('Amazon')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(screen.getByText('Whole Foods')).toBeInTheDocument()
    expect(screen.getByText('$300.00')).toBeInTheDocument()
    expect(screen.getByText('Starbucks')).toBeInTheDocument()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
  })

  it('limits to 10 merchants', () => {
    const data = {
      merchants: Array.from({ length: 15 }, (_, i) => ({
        merchant: `Merchant ${i + 1}`,
        amount: 100 * (15 - i)
      }))
    }

    render(<TopMerchantsList data={data} />)

    expect(screen.getByText('Merchant 1')).toBeInTheDocument()
    expect(screen.getByText('Merchant 10')).toBeInTheDocument()
    expect(screen.queryByText('Merchant 11')).not.toBeInTheDocument()
  })

  it('handles negative amounts', () => {
    const data = {
      merchants: [
        { merchant: 'Refund Store', amount: -50 }
      ]
    }

    render(<TopMerchantsList data={data} />)

    expect(screen.getByText('Refund Store')).toBeInTheDocument()
    expect(screen.getByText('-$50.00')).toBeInTheDocument()
  })
})
