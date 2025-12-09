import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useFormatDetection } from './useFormatDetection'

describe('useFormatDetection', () => {
  const mockFile = new File(['date,amount,description\n2024-01-01,100,Test'], 'test.csv', { type: 'text/csv' })

  const mockAutoDetectResponse = {
    analysis: {
      headers: ['date', 'amount', 'description'],
      sample_rows: [['2024-01-01', '100', 'Test']],
      column_hints: {
        date: { detected_type: 'date', confidence: 0.95 },
        amount: { detected_type: 'amount', confidence: 0.9 },
        description: { detected_type: 'description', confidence: 0.85 }
      }
    },
    config: {
      date_column: 'date',
      amount_column: 'amount',
      description_column: 'description',
      date_format: '%Y-%m-%d',
      amount_sign_convention: 'negative_prefix',
      _completeness: 1.0
    },
    skip_rows: 0
  }

  const mockAccountTags = [
    { id: 1, namespace: 'account', value: 'chase-checking', description: 'Chase Checking' }
  ]

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/v1/import/custom/auto-detect')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAutoDetectResponse)
        })
      }
      if (url.includes('/api/v1/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAccountTags)
        })
      }
      return Promise.resolve({ ok: false })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes with loading state', () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))
    expect(result.current.loading).toBe(true)
  })

  it('fetches auto-detection on mount', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/import/custom/auto-detect',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('fetches account tags on mount', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.accountTags).toEqual(mockAccountTags)
    })
  })

  it('applies auto-detected config', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.dateColumn).toBe('date')
    expect(result.current.amountColumn).toBe('amount')
    expect(result.current.descriptionColumn).toBe('description')
    expect(result.current.dateFormat).toBe('%Y-%m-%d')
  })

  it('sets detectionComplete when completeness is 1.0', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.detectionComplete).toBe(true)
    })
  })

  it('handles auto-detect error and falls back to analyze', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/v1/import/custom/auto-detect')) {
        return Promise.resolve({ ok: false })
      }
      if (url.includes('/api/v1/import/analyze')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            headers: ['date', 'amount', 'description'],
            sample_rows: [],
            suggested_config: {
              date_column: 'date',
              amount_column: 'amount',
              description_column: 'description',
              _completeness: 0.8
            }
          })
        })
      }
      if (url.includes('/api/v1/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      }
      return Promise.resolve({ ok: false })
    }))

    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/import/analyze',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('sets error when both endpoints fail', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/v1/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      }
      return Promise.resolve({ ok: false })
    }))

    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to analyze file')
    })
  })

  it('allows setting column values', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setDateColumn('new_date')
      result.current.setAmountColumn('new_amount')
      result.current.setDescriptionColumn('new_desc')
    })

    expect(result.current.dateColumn).toBe('new_date')
    expect(result.current.amountColumn).toBe('new_amount')
    expect(result.current.descriptionColumn).toBe('new_desc')
  })

  it('allows setting optional columns', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setReferenceColumn('ref_col')
      result.current.setCategoryColumn('cat_col')
    })

    expect(result.current.referenceColumn).toBe('ref_col')
    expect(result.current.categoryColumn).toBe('cat_col')
  })

  it('allows setting format options', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setDateFormat('%d/%m/%Y')
      result.current.setAmountConvention('positive_debit')
      result.current.setAmountPrefix('$')
      result.current.setInvertSign(true)
    })

    expect(result.current.dateFormat).toBe('%d/%m/%Y')
    expect(result.current.amountConvention).toBe('positive_debit')
    expect(result.current.amountPrefix).toBe('$')
    expect(result.current.invertSign).toBe(true)
  })

  it('allows setting skip rows', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSkipRows(2)
      result.current.setSkipFooterRows(1)
    })

    expect(result.current.skipRows).toBe(2)
    expect(result.current.skipFooterRows).toBe(1)
  })

  it('toggles showPreview', async () => {
    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.showPreview).toBe(false)

    act(() => {
      result.current.setShowPreview(true)
    })

    expect(result.current.showPreview).toBe(true)
  })

  it('runs preview with config', async () => {
    const mockPreviewResponse = {
      transactions: [
        { date: '2024-01-01', amount: -100, merchant: 'Test', bucket: null }
      ],
      errors: []
    }

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/v1/import/custom/auto-detect')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAutoDetectResponse)
        })
      }
      if (url.includes('/api/v1/import/custom/preview')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPreviewResponse)
        })
      }
      if (url.includes('/api/v1/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      }
      return Promise.resolve({ ok: false })
    }))

    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.runPreview({
        name: 'Test',
        account_source: 'test-account',
        date_column: 'date',
        amount_column: 'amount',
        description_column: 'description',
        date_format: '%Y-%m-%d',
        amount_sign_convention: 'negative_prefix',
        amount_currency_prefix: '',
        amount_invert_sign: false,
        amount_thousands_separator: ',',
        row_handling: { skip_header_rows: 0, skip_footer_rows: 0, skip_patterns: [], skip_empty_rows: true },
        merchant_split_chars: '',
        merchant_max_length: 50
      })
    })

    expect(result.current.previewTransactions).toEqual(mockPreviewResponse.transactions)
    expect(result.current.showPreview).toBe(true)
  })

  it('handles preview error', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/v1/import/custom/auto-detect')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAutoDetectResponse)
        })
      }
      if (url.includes('/api/v1/import/custom/preview')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ detail: 'Preview failed' })
        })
      }
      if (url.includes('/api/v1/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      }
      return Promise.resolve({ ok: false })
    }))

    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.runPreview({
        name: 'Test',
        account_source: 'test-account',
        date_column: 'date',
        amount_column: 'amount',
        description_column: 'description',
        date_format: '%Y-%m-%d',
        amount_sign_convention: 'negative_prefix',
        amount_currency_prefix: '',
        amount_invert_sign: false,
        amount_thousands_separator: ',',
        row_handling: { skip_header_rows: 0, skip_footer_rows: 0, skip_patterns: [], skip_empty_rows: true },
        merchant_split_chars: '',
        merchant_max_length: 50
      })
    })

    expect(result.current.error).toBe('Preview failed')
  })

  it('creates account tag', async () => {
    const newTag = { id: 2, namespace: 'account', value: 'new-account', description: 'New Account' }

    vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/import/custom/auto-detect')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAutoDetectResponse)
        })
      }
      if (url === '/api/v1/tags' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(newTag)
        })
      }
      if (url.includes('/api/v1/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAccountTags)
        })
      }
      return Promise.resolve({ ok: false })
    }))

    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let tagValue: string | null = null
    await act(async () => {
      tagValue = await result.current.createAccountTag('New Account')
    })

    expect(tagValue).toBe('new-account')
    expect(result.current.accountTags).toContainEqual(newTag)
  })

  it('handles create account tag failure', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/import/custom/auto-detect')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAutoDetectResponse)
        })
      }
      if (url === '/api/v1/tags' && options?.method === 'POST') {
        return Promise.resolve({ ok: false })
      }
      if (url.includes('/api/v1/tags')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      }
      return Promise.resolve({ ok: false })
    }))

    const { result } = renderHook(() => useFormatDetection({ file: mockFile }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let tagValue: string | null = null
    await act(async () => {
      tagValue = await result.current.createAccountTag('New Account')
    })

    expect(tagValue).toBeNull()
  })
})
