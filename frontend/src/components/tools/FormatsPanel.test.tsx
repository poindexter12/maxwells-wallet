import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import FormatsPanel from './FormatsPanel'

describe('FormatsPanel', () => {
  it('renders loading state initially', () => {
    render(<FormatsPanel />)
    expect(screen.getByTestId('formats-loading')).toBeInTheDocument()
  })

  it('renders panel after loading', async () => {
    render(<FormatsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('formats-panel')).toBeInTheDocument()
    })
  })

  it('displays formats list', async () => {
    render(<FormatsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('formats-list')).toBeInTheDocument()
    })
  })

  it('displays existing format', async () => {
    render(<FormatsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('format-row-1')).toBeInTheDocument()
    })
    expect(screen.getByText('Chase Credit Card')).toBeInTheDocument()
    expect(screen.getByText('Chase Sapphire monthly statement')).toBeInTheDocument()
  })

  it('shows use count badge', async () => {
    render(<FormatsPanel />)
    await waitFor(() => {
      expect(screen.getByText('Used 5x')).toBeInTheDocument()
    })
  })

  it('shows config summary', async () => {
    render(<FormatsPanel />)
    await waitFor(() => {
      expect(screen.getByText(/Account: Chase/)).toBeInTheDocument()
    })
  })

  it('has new format button', async () => {
    render(<FormatsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('new-format-btn')).toBeInTheDocument()
    })
    expect(screen.getByText('+ New Format')).toBeInTheDocument()
  })

  it('has test, edit, delete buttons per format', async () => {
    render(<FormatsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('test-format-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('edit-format-1')).toBeInTheDocument()
    expect(screen.getByTestId('delete-format-1')).toBeInTheDocument()
  })

  it('shows created date', async () => {
    render(<FormatsPanel />)
    await waitFor(() => {
      // Check for either date due to timezone differences
      const hasDate = screen.getByText(/Created (Oct 31|Nov 1), 2024/)
      expect(hasDate).toBeInTheDocument()
    })
  })
})
