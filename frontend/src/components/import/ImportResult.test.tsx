import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImportResult } from './ImportResult'
import { ImportResult as ImportResultType } from '@/types/import'
import { TEST_IDS } from '@/test-ids'

describe('ImportResult', () => {
  it('renders success header', () => {
    const result: ImportResultType = {
      imported: 10,
      duplicates: 2
    }
    render(<ImportResult result={result} />)

    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_TITLE)).toBeInTheDocument()
  })

  it('displays single file import stats', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5
    }
    render(<ImportResult result={result} />)

    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_IMPORTED)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_IMPORTED_COUNT)).toHaveTextContent('50')
    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_DUPLICATES)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_DUPLICATES_COUNT)).toHaveTextContent('5')
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

    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_IMPORTED_COUNT)).toHaveTextContent('100')
    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_DUPLICATES_COUNT)).toHaveTextContent('10')
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

    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_FORMAT_VALUE)).toHaveTextContent('2')
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

    const fileDetails = screen.getByTestId(TEST_IDS.IMPORT_RESULT_FILE_DETAILS)
    expect(fileDetails).toBeInTheDocument()
    expect(fileDetails).toHaveTextContent('transactions_jan.csv')
    expect(fileDetails).toHaveTextContent('transactions_feb.csv')
  })

  it('shows Format Saved Yes when format_saved is true', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5,
      format_saved: true
    }
    render(<ImportResult result={result} />)

    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_FORMAT)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_FORMAT_VALUE)).toHaveTextContent('Yes')
  })

  it('shows Format Saved Yes when config_saved is true', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5,
      config_saved: true
    }
    render(<ImportResult result={result} />)

    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_FORMAT_VALUE)).toHaveTextContent('Yes')
  })

  it('shows Format Saved No when neither format_saved nor config_saved', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5
    }
    render(<ImportResult result={result} />)

    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_FORMAT_VALUE)).toHaveTextContent('No')
  })

  it('displays cross-account warnings when present', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5,
      cross_account_warning_count: 3
    }
    render(<ImportResult result={result} />)

    expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT_CROSS_ACCOUNT_WARNING)).toBeInTheDocument()
  })

  it('hides cross-account warnings when count is 0', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5,
      cross_account_warning_count: 0
    }
    render(<ImportResult result={result} />)

    expect(screen.queryByTestId(TEST_IDS.IMPORT_RESULT_CROSS_ACCOUNT_WARNING)).not.toBeInTheDocument()
  })

  it('hides cross-account warnings when not present', () => {
    const result: ImportResultType = {
      imported: 50,
      duplicates: 5
    }
    render(<ImportResult result={result} />)

    expect(screen.queryByTestId(TEST_IDS.IMPORT_RESULT_CROSS_ACCOUNT_WARNING)).not.toBeInTheDocument()
  })

  it('hides file details when files array is empty', () => {
    const result: ImportResultType = {
      total_imported: 0,
      total_duplicates: 0,
      files: []
    }
    render(<ImportResult result={result} />)

    expect(screen.queryByTestId(TEST_IDS.IMPORT_RESULT_FILE_DETAILS)).not.toBeInTheDocument()
  })
})
