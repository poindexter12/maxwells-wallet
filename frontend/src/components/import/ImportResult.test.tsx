import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImportResult } from './ImportResult'
import { ImportResult as ImportResultType } from '@/types/import'

describe('ImportResult', () => {
  it('renders success header', () => {
    const result: ImportResultType = {
      imported: 10,
      duplicates: 2
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('Import Complete!')).toBeInTheDocument()
  })

  it('displays single file import stats', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('Imported')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('Duplicates Skipped')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('displays batch import totals', () => {
    const result: ImportResultType = {
      total_imported: 100,
      total_duplicates: 10,
      files: [
        { filename: 'file1.csv', imported: 50, duplicates: 5 },
        { filename: 'file2.csv', imported: 50, duplicates: 5 }
      ]
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows Files Imported count for batch imports', () => {
    const result: ImportResultType = {
      total_imported: 100,
      total_duplicates: 10,
      files: [
        { filename: 'file1.csv', imported: 50, duplicates: 5 },
        { filename: 'file2.csv', imported: 50, duplicates: 5 }
      ]
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('Files Imported')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows file details section for batch imports', () => {
    const result: ImportResultType = {
      total_imported: 100,
      total_duplicates: 10,
      files: [
        { filename: 'transactions_jan.csv', imported: 50, duplicates: 5 },
        { filename: 'transactions_feb.csv', imported: 50, duplicates: 5 }
      ]
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('File Details:')).toBeInTheDocument()
    expect(screen.getByText('transactions_jan.csv')).toBeInTheDocument()
    expect(screen.getByText('transactions_feb.csv')).toBeInTheDocument()
    expect(screen.getAllByText('50 imported')).toHaveLength(2)
    expect(screen.getAllByText('5 duplicates')).toHaveLength(2)
  })

  it('shows Format Saved Yes when format_saved is true', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5,
      format_saved: true
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('Format Saved')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('shows Format Saved Yes when config_saved is true', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5,
      config_saved: true
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('Format Saved')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('shows Format Saved No when neither format_saved nor config_saved', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('Format Saved')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('displays cross-account warnings when present', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5,
      cross_account_warning_count: 3
    }
    render(<ImportResult result={result} />)

    expect(screen.getByText('Cross-Account Matches (3)')).toBeInTheDocument()
    expect(screen.getByText(/transactions appear to match existing transactions/)).toBeInTheDocument()
  })

  it('hides cross-account warnings when count is 0', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5,
      cross_account_warning_count: 0
    }
    render(<ImportResult result={result} />)

    expect(screen.queryByText(/Cross-Account Matches/)).not.toBeInTheDocument()
  })

  it('hides cross-account warnings when not present', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5
    }
    render(<ImportResult result={result} />)

    expect(screen.queryByText(/Cross-Account Matches/)).not.toBeInTheDocument()
  })

  it('hides file details when files array is empty', () => {
    const result: ImportResultType = {
      total_imported: 0,
      total_duplicates: 0,
      files: []
    }
    render(<ImportResult result={result} />)

    expect(screen.queryByText('File Details:')).not.toBeInTheDocument()
  })
})
