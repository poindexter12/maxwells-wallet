import { useState, useEffect, useCallback } from 'react'
import {
  AnalysisResult,
  SuggestedConfig,
  CustomConfig,
  PreviewTransaction,
  AccountTag
} from '@/types/customFormat'

interface UseFormatDetectionProps {
  file: File
  initialConfig?: Partial<CustomConfig> & { description?: string }
}

interface UseFormatDetectionReturn {
  loading: boolean
  error: string | null
  analysis: AnalysisResult | null
  suggested: SuggestedConfig | null
  skipRows: number
  setSkipRows: (rows: number) => void
  previewTransactions: PreviewTransaction[]
  previewErrors: string[]
  showPreview: boolean
  setShowPreview: (show: boolean) => void
  accountTags: AccountTag[]
  runPreview: (config: CustomConfig) => Promise<void>
  createAccountTag: (name: string) => Promise<string | null>
  detectionComplete: boolean
  // Form state
  dateColumn: string
  setDateColumn: (col: string) => void
  amountColumn: string
  setAmountColumn: (col: string) => void
  descriptionColumn: string
  setDescriptionColumn: (col: string) => void
  referenceColumn: string
  setReferenceColumn: (col: string) => void
  categoryColumn: string
  setCategoryColumn: (col: string) => void
  dateFormat: string
  setDateFormat: (format: string) => void
  amountConvention: string
  setAmountConvention: (conv: string) => void
  amountPrefix: string
  setAmountPrefix: (prefix: string) => void
  invertSign: boolean
  setInvertSign: (invert: boolean) => void
  skipFooterRows: number
  setSkipFooterRows: (rows: number) => void
}

export function useFormatDetection({ file, initialConfig: _initialConfig }: UseFormatDetectionProps): UseFormatDetectionReturn {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Account tags for dropdown
  const [accountTags, setAccountTags] = useState<AccountTag[]>([])

  // Auto-detection results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [suggested, setSuggested] = useState<SuggestedConfig | null>(null)
  const [skipRows, setSkipRows] = useState(0)

  // Advanced settings
  const [dateColumn, setDateColumn] = useState<string>('')
  const [amountColumn, setAmountColumn] = useState<string>('')
  const [descriptionColumn, setDescriptionColumn] = useState<string>('')
  const [referenceColumn, setReferenceColumn] = useState<string>('')
  const [categoryColumn, setCategoryColumn] = useState<string>('')
  const [dateFormat, setDateFormat] = useState('%m/%d/%Y')
  const [amountConvention, setAmountConvention] = useState('negative_prefix')
  const [amountPrefix, setAmountPrefix] = useState('')
  const [invertSign, setInvertSign] = useState(false)
  const [skipFooterRows, setSkipFooterRows] = useState(0)

  // Preview
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([])
  const [previewErrors, setPreviewErrors] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const detectionComplete = suggested ? suggested._completeness >= 1.0 : false

  const fetchAccountTags = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/tags?namespace=account')
      if (res.ok) {
        const data = await res.json()
        setAccountTags(data)
      }
    } catch (err) {
      console.error('Error fetching account tags:', err)
    }
  }, [])

  const createAccountTag = useCallback(async (name: string): Promise<string | null> => {
    try {
      const tagValue = name.toLowerCase().replace(/\s+/g, '-')

      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: 'account',
          value: tagValue,
          description: name
        })
      })

      if (res.ok) {
        const newTag = await res.json()
        setAccountTags(prev => [...prev, newTag])
        return tagValue
      }
      return null
    } catch (err) {
      console.error('Error creating account tag:', err)
      return null
    }
  }, [])

  const applyAutoDetection = useCallback((config: SuggestedConfig, skipRowsCount: number) => {
    setDateColumn(config.date_column || '')
    setAmountColumn(config.amount_column || '')
    setDescriptionColumn(config.description_column || '')
    setReferenceColumn(config.reference_column || '')
    setCategoryColumn(config.category_column || '')
    setDateFormat(config.date_format || '%m/%d/%Y')
    setAmountConvention(config.amount_sign_convention || 'negative_prefix')
    setAmountPrefix(config.amount_currency_prefix || '')
    setInvertSign(config.amount_invert_sign || false)
    setSkipRows(skipRowsCount)
  }, [])

  const runPreview = useCallback(async (config: CustomConfig) => {
    setLoading(true)
    setPreviewErrors([])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('config_json', JSON.stringify(config))

      const res = await fetch('/api/v1/import/custom/preview', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Preview failed')
      }

      setPreviewTransactions(data.transactions || [])
      setPreviewErrors(data.errors || [])
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }, [file])

  const autoDetect = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/v1/import/custom/auto-detect', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        // Fall back to analyze endpoint
        const analyzeRes = await fetch('/api/v1/import/analyze', {
          method: 'POST',
          body: formData
        })

        if (!analyzeRes.ok) {
          throw new Error('Failed to analyze file')
        }

        const data = await analyzeRes.json()
        setAnalysis(data)

        if (data.suggested_config) {
          setSuggested(data.suggested_config)
          applyAutoDetection(data.suggested_config, 0)
        }
      } else {
        const data = await res.json()
        setAnalysis(data.analysis)
        setSuggested(data.config)
        setSkipRows(data.skip_rows || 0)
        applyAutoDetection(data.config, data.skip_rows || 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file')
    } finally {
      setLoading(false)
    }
  }, [file, applyAutoDetection])

  useEffect(() => {
    autoDetect()
    fetchAccountTags()
  }, [autoDetect, fetchAccountTags])

  return {
    loading,
    error,
    analysis,
    suggested,
    skipRows,
    setSkipRows,
    previewTransactions,
    previewErrors,
    showPreview,
    setShowPreview,
    accountTags,
    runPreview,
    createAccountTag,
    detectionComplete,
    dateColumn,
    setDateColumn,
    amountColumn,
    setAmountColumn,
    descriptionColumn,
    setDescriptionColumn,
    referenceColumn,
    setReferenceColumn,
    categoryColumn,
    setCategoryColumn,
    dateFormat,
    setDateFormat,
    amountConvention,
    setAmountConvention,
    amountPrefix,
    setAmountPrefix,
    invertSign,
    setInvertSign,
    skipFooterRows,
    setSkipFooterRows,
  }
}
