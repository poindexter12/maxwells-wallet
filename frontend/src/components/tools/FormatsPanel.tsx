'use client'

import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'
import { CustomFormatMapper, CustomConfig } from '@/components/CustomFormatMapper'

type ConfigWithDescription = CustomConfig & { description?: string }

interface SavedFormatConfig {
  id: number
  name: string
  description?: string
  config_json: string
  use_count: number
  created_at: string
  updated_at: string
}

interface ParsedTransaction {
  date: string
  merchant: string
  description: string
  amount: number
}

type ViewMode = 'list' | 'create' | 'edit'

export default function FormatsPanel() {
  const [formats, setFormats] = useState<SavedFormatConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ViewMode>('list')
  const [editingFormat, setEditingFormat] = useState<SavedFormatConfig | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [testFile, setTestFile] = useState<File | null>(null)
  const [testingFormatId, setTestingFormatId] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<{ transactions: ParsedTransaction[], errors: string[] } | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFormats()
  }, [])

  async function fetchFormats() {
    try {
      const res = await fetch('/api/v1/import/custom/configs')
      if (res.ok) {
        const data = await res.json()
        setFormats(data)
      }
    } catch (error) {
      console.error('Error fetching formats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this format configuration?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/v1/import/custom/configs/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchFormats()
      }
    } catch (error) {
      console.error('Error deleting format:', error)
    } finally {
      setDeleting(null)
    }
  }

  function handleTestClick(formatToTest: SavedFormatConfig) {
    setTestingFormatId(formatToTest.id)
    setTestResults(null)
    fileInputRef.current?.click()
  }

  async function handleTestFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !testingFormatId) return

    setTestFile(file)
    const formatToTest = formats.find(f => f.id === testingFormatId)
    if (!formatToTest) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('config_json', formatToTest.config_json)

      const res = await fetch('/api/v1/import/custom/preview', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      setTestResults({
        transactions: data.transactions || [],
        errors: data.errors || []
      })
    } catch (error) {
      console.error('Error testing format:', error)
      setTestResults({ transactions: [], errors: ['Failed to test format'] })
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function parseConfigSummary(configJson: string): string {
    try {
      const config = JSON.parse(configJson)
      const parts = []
      if (config.account_source) parts.push(`Account: ${config.account_source}`)
      if (config.date_column) parts.push(`Date: ${config.date_column}`)
      if (config.amount_column) parts.push(`Amount: ${config.amount_column}`)
      return parts.join(' • ')
    } catch {
      return 'Invalid configuration'
    }
  }

  function handleEdit(formatToEdit: SavedFormatConfig) {
    setEditingFormat(formatToEdit)
    setSelectedFile(null)
    setMode('edit')
  }

  function handleCreate() {
    setEditingFormat(null)
    setSelectedFile(null)
    setSaveError(null)
    // Trigger file picker
    createFileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setMode(editingFormat ? 'edit' : 'create')
    }
    // Reset file input
    if (createFileInputRef.current) {
      createFileInputRef.current.value = ''
    }
  }

  function handleBackToList() {
    setMode('list')
    setSelectedFile(null)
    setEditingFormat(null)
    setSaveError(null)
    fetchFormats()
  }

  async function handleConfigured(config: ConfigWithDescription) {
    setSaving(true)
    setSaveError(null)

    try {
      const body = {
        name: config.name,
        description: config.description || '',
        config_json: JSON.stringify(config)
      }

      const url = editingFormat
        ? `/api/v1/import/custom/configs/${editingFormat.id}`
        : '/api/v1/import/custom/configs'
      const method = editingFormat ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to save format')
      }

      handleBackToList()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save format')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-theme-muted" data-testid="formats-loading">
        Loading...
      </div>
    )
  }

  // If creating/editing, show the format mapper inline
  if ((mode === 'create' || mode === 'edit') && selectedFile) {
    const initialConfig = editingFormat ? (() => {
      try {
        const parsed = JSON.parse(editingFormat.config_json)
        return { ...parsed, description: editingFormat.description }
      } catch {
        return undefined
      }
    })() : undefined

    return (
      <div className="space-y-6" data-testid="format-mapper-view">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="px-3 py-1.5 text-sm text-theme-muted hover:text-theme border border-theme rounded-md hover:bg-theme-elevated"
            data-testid="back-to-list-btn"
          >
            ← Back to Formats
          </button>
          <h2 className="text-xl font-semibold text-theme">
            {editingFormat ? 'Edit Format Configuration' : 'Create New Format'}
          </h2>
          <span className="text-sm text-theme-muted">({selectedFile.name})</span>
        </div>

        {saveError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {saveError}
          </div>
        )}

        {/* Format Mapper inline */}
        <CustomFormatMapper
          file={selectedFile}
          onConfigured={handleConfigured}
          onCancel={handleBackToList}
          initialConfig={initialConfig}
        />
      </div>
    )
  }

  // If edit mode but no file selected yet, show file picker
  if (mode === 'edit' && editingFormat && !selectedFile) {
    return (
      <div className="space-y-6" data-testid="edit-file-picker">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="px-3 py-1.5 text-sm text-theme-muted hover:text-theme border border-theme rounded-md hover:bg-theme-elevated"
            data-testid="back-to-list-btn"
          >
            ← Back to Formats
          </button>
          <h2 className="text-xl font-semibold text-theme">
            Edit Format: {editingFormat.name}
          </h2>
        </div>

        <div className="card p-8 text-center">
          <p className="text-theme-muted mb-6">
            Upload a sample CSV file to edit the format configuration.
            This helps verify your column mappings are correct.
          </p>
          <input
            ref={createFileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelected}
            className="hidden"
            data-testid="edit-file-input"
          />
          <button
            onClick={() => createFileInputRef.current?.click()}
            className="btn-primary"
            data-testid="select-csv-btn"
          >
            Select CSV File
          </button>
        </div>
      </div>
    )
  }

  // List view (default)
  return (
    <div className="space-y-6" data-testid="formats-panel">
      <div className="flex justify-between items-center">
        <p className="text-sm text-theme-muted">
          Create reusable import configurations for different bank CSV formats
        </p>
        <button
          onClick={handleCreate}
          className="btn-primary text-sm"
          data-testid="new-format-btn"
        >
          + New Format
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleTestFile}
        className="hidden"
        data-testid="test-file-input"
      />
      <input
        ref={createFileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelected}
        className="hidden"
        data-testid="create-file-input"
      />

      {/* Test Results */}
      {testResults && (
        <div className="card p-4 border-2 border-blue-500" data-testid="test-results">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-theme">
              Test Results: {testResults.transactions.length} transactions parsed
              {testFile && <span className="text-sm font-normal text-theme-muted ml-2">from {testFile.name}</span>}
            </h3>
            <button
              onClick={() => { setTestResults(null); setTestFile(null); setTestingFormatId(null) }}
              className="text-theme-muted hover:text-theme"
              data-testid="close-test-results-btn"
            >
              ✕
            </button>
          </div>
          {testResults.errors.length > 0 && (
            <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-300">
              {testResults.errors.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}
          {testResults.transactions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-theme-elevated">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Merchant</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.transactions.slice(0, 5).map((txn, i) => (
                    <tr key={i} className="border-t border-theme">
                      <td className="px-3 py-2">{txn.date}</td>
                      <td className="px-3 py-2">{txn.merchant}</td>
                      <td className="px-3 py-2 truncate max-w-[200px]">{txn.description}</td>
                      <td className={`px-3 py-2 text-right ${txn.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {formatCurrency(txn.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {testResults.transactions.length > 5 && (
                <div className="px-3 py-2 text-sm text-theme-muted">
                  Showing 5 of {testResults.transactions.length} transactions
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formats List */}
      <div className="card" data-testid="formats-list">
        {formats.length === 0 ? (
          <div className="p-8 text-center" data-testid="no-formats">
            <p className="text-theme-muted mb-4">No custom CSV formats created yet.</p>
            <p className="text-sm text-theme-muted">
              Create a format configuration to reuse when importing CSV files from your banks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-theme">
            {formats.map((fmt) => (
              <div
                key={fmt.id}
                className="p-4 hover:bg-theme-elevated"
                data-testid={`format-row-${fmt.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-theme">{fmt.name}</h3>
                      {fmt.use_count > 0 && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded dark:bg-green-900/30 dark:text-green-300">
                          Used {fmt.use_count}x
                        </span>
                      )}
                    </div>
                    {fmt.description && (
                      <p className="text-sm text-theme-muted mb-2">{fmt.description}</p>
                    )}
                    <p className="text-xs text-theme-muted">{parseConfigSummary(fmt.config_json)}</p>
                    <p className="text-xs text-theme-muted mt-1">
                      Created {format(new Date(fmt.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleTestClick(fmt)}
                      className="px-3 py-1.5 text-sm text-theme-muted hover:text-theme border border-theme rounded-md hover:bg-theme-elevated"
                      data-testid={`test-format-${fmt.id}`}
                    >
                      Test
                    </button>
                    <button
                      onClick={() => handleEdit(fmt)}
                      className="px-3 py-1.5 text-sm text-theme-muted hover:text-theme border border-theme rounded-md hover:bg-theme-elevated"
                      data-testid={`edit-format-${fmt.id}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(fmt.id)}
                      disabled={deleting === fmt.id}
                      className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      data-testid={`delete-format-${fmt.id}`}
                    >
                      {deleting === fmt.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
