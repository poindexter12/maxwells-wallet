import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopMerchantsList } from './TopMerchantsList'
import { TEST_IDS } from '@/test-ids'

describe('TopMerchantsList', () => {
  it('renders with title', () => {
    render(<TopMerchantsList data={null} />)
    expect(screen.getByTestId(TEST_IDS.WIDGET_TOP_MERCHANTS_TITLE)).toBeInTheDocument()
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
    expect(screen.getByTestId(TEST_IDS.WIDGET_TOP_MERCHANTS_TITLE)).toHaveTextContent('Custom Title')
  })

  it('shows empty state when no data', () => {
    render(<TopMerchantsList data={null} />)
    expect(screen.getByTestId(TEST_IDS.WIDGET_TOP_MERCHANTS_EMPTY)).toBeInTheDocument()
  })

  it('shows empty state when merchants array is empty', () => {
    render(<TopMerchantsList data={{ merchants: [] }} />)
    expect(screen.getByTestId(TEST_IDS.WIDGET_TOP_MERCHANTS_EMPTY)).toBeInTheDocument()
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

    const list = screen.getByTestId(TEST_IDS.WIDGET_TOP_MERCHANTS_LIST)
    expect(list).toBeInTheDocument()
    expect(list).toHaveTextContent('Amazon')
    expect(list).toHaveTextContent('$500.00')
    expect(list).toHaveTextContent('Whole Foods')
    expect(list).toHaveTextContent('$300.00')
    expect(list).toHaveTextContent('Starbucks')
    expect(list).toHaveTextContent('$150.00')
  })

  it('limits to 10 merchants', () => {
    const data = {
      merchants: Array.from({ length: 15 }, (_, i) => ({
        merchant: `Merchant ${i + 1}`,
        amount: 100 * (15 - i)
      }))
    }

    render(<TopMerchantsList data={data} />)

    const list = screen.getByTestId(TEST_IDS.WIDGET_TOP_MERCHANTS_LIST)
    expect(list).toHaveTextContent('Merchant 1')
    expect(list).toHaveTextContent('Merchant 10')
    expect(list).not.toHaveTextContent('Merchant 11')
  })

  it('handles negative amounts', () => {
    const data = {
      merchants: [
        { merchant: 'Refund Store', amount: -50 }
      ]
    }

    render(<TopMerchantsList data={data} />)

    const list = screen.getByTestId(TEST_IDS.WIDGET_TOP_MERCHANTS_LIST)
    expect(list).toHaveTextContent('Refund Store')
    expect(list).toHaveTextContent('-$50.00')
  })
})
