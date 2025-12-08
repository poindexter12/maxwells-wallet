'use client'

import { useState, useEffect } from 'react'
import { TEST_IDS } from '@/test-ids'
import { PageHelp } from '@/components/PageHelp'
import { BatchImport } from '@/components/import/BatchImport'
import { SingleFileImport } from '@/components/import/SingleFileImport'
import { ImportResult } from '@/components/import/ImportResult'
import {
  AccountTag,
  SavedCustomFormat,
  FilePreview,
  ImportResult as ImportResultType
} from '@/types/import'

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([])
  const [batchMode, setBatchMode] = useState(false)
  const [batchPreviews, setBatchPreviews] = useState<FilePreview[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResultType | null>(null)

  // Account selection state
  const [accounts, setAccounts] = useState<AccountTag[]>([])
  const [accountMode, setAccountMode] = useState<'existing' | 'new'>('existing')

  // Single file mode states
  const [file, setFile] = useState<File | null>(null)
  const [accountSource, setAccountSource] = useState('')
  const [formatHint, setFormatHint] = useState('')
  const [preview, setPreview] = useState<any>(null)

  // Custom format state
  const [savedFormats, setSavedFormats] = useState<SavedCustomFormat[]>([])
  const [selectedCustomFormat, setSelectedCustomFormat] = useState<SavedCustomFormat | null>(null)

  // Fetch existing account tags and saved formats on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [accountsRes, formatsRes] = await Promise.all([
          fetch('/api/v1/tags?namespace=account'),
          fetch('/api/v1/import/custom/configs')
        ])
        const accountsData = await accountsRes.json()
        const formatsData = await formatsRes.json()
        setAccounts(accountsData)
        setSavedFormats(formatsData)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  async function handlePreview() {
    if (!file) return

    // Use custom format endpoint if a saved custom format is selected
    if (selectedCustomFormat) {
      try {
        const config = JSON.parse(selectedCustomFormat.config_json)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('config_json', JSON.stringify({
          ...config,
          account_source: accountSource || config.account_source
        }))

        const res = await fetch('/api/v1/import/custom/preview', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()

        setPreview({
          detected_format: 'custom',
          transaction_count: data.transaction_count,
          total_amount: data.total_amount,
          transactions: data.transactions,
          errors: data.errors,
          _customConfigId: selectedCustomFormat.id
        })
        setResult(null)
      } catch (error) {
        console.error('Error previewing custom import:', error)
        alert('Error previewing file with custom format')
      }
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    if (accountSource) formData.append('account_source', accountSource)
    if (formatHint) formData.append('format_hint', formatHint)

    try {
      const res = await fetch('/api/v1/import/preview', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      setPreview(data)
      setResult(null)
    } catch (error) {
      console.error('Error previewing import:', error)
      alert('Error previewing file')
    }
  }

  async function handleConfirm() {
    if (!file || !preview) return

    setImporting(true)

    try {
      // Use custom confirm endpoint if custom format was used
      if (preview._customConfigId && selectedCustomFormat) {
        const config = JSON.parse(selectedCustomFormat.config_json)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('config_json', JSON.stringify({
          ...config,
          account_source: accountSource || config.account_source
        }))
        formData.append('save_config', 'false')

        const res = await fetch('/api/v1/import/custom/confirm', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        setResult(data)
      } else {
        // Standard confirm
        const formData = new FormData()
        formData.append('file', file)
        formData.append('format_type', preview.detected_format)
        if (accountSource) formData.append('account_source', accountSource)
        formData.append('save_format', 'true')

        const res = await fetch('/api/v1/import/confirm', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        setResult(data)
      }

      setPreview(null)
      setFile(null)
      setAccountSource('')
      setSelectedCustomFormat(null)
      setFormatHint('')
    } catch (error) {
      console.error('Error importing:', error)
      alert('Error importing transactions')
    } finally {
      setImporting(false)
    }
  }

  async function handleBatchPreview() {
    if (files.length === 0) return

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const res = await fetch('/api/v1/import/batch/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      const previews = data.files.map((filePreview: any) => ({
        ...filePreview,
        selected: true
      }))

      setBatchPreviews(previews)
      setResult(null)
    } catch (error) {
      console.error('Error previewing batch import:', error)
      alert('Error previewing batch import')
    }
  }

  async function handleBatchConfirm() {
    const selectedFiles = batchPreviews.filter(p => p.selected)
    if (selectedFiles.length === 0) {
      alert('Please select at least one file to import')
      return
    }

    setImporting(true)

    try {
      const requestBody = {
        files: selectedFiles.map(preview => ({
          filename: preview.filename,
          account_source: preview.accountSourceOverride || preview.account_source,
          format_type: preview.detected_format
        })),
        save_format: true
      }

      const formData = new FormData()

      selectedFiles.forEach(preview => {
        const file = files.find(f => f.name === preview.filename)
        if (file) {
          formData.append('files', file)
        }
      })

      formData.append('request', JSON.stringify(requestBody))

      const res = await fetch('/api/v1/import/batch/confirm', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      setResult(data)
      setBatchPreviews([])
      setFiles([])
    } catch (error) {
      console.error('Error importing batch:', error)
      alert('Error importing batch')
    } finally {
      setImporting(false)
    }
  }

  function toggleFileSelection(filename: string) {
    setBatchPreviews(prevPreviews =>
      prevPreviews.map(p =>
        p.filename === filename ? { ...p, selected: !p.selected } : p
      )
    )
  }

  function updateAccountSource(filename: string, accountSource: string) {
    setBatchPreviews(prevPreviews =>
      prevPreviews.map(p =>
        p.filename === filename ? { ...p, accountSourceOverride: accountSource } : p
      )
    )
  }

  function handleFormatChange(value: string) {
    if (value.startsWith('custom:')) {
      const formatId = parseInt(value.split(':')[1])
      const format = savedFormats.find(f => f.id === formatId)
      setSelectedCustomFormat(format || null)
      setFormatHint('')
    } else {
      setSelectedCustomFormat(null)
      setFormatHint(value)
    }
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="import"
        title="Import Help"
        description="Import transactions from your bank's CSV, QIF, or QFX export files."
        steps={[
          "Download an export file from your bank's website",
          "Select the file using the file picker below",
          "Specify an account name to organize your data",
          "Click 'Preview Import' to see what will be imported",
          "Review the preview, then click 'Confirm Import' to save"
        ]}
        tips={[
          "The system auto-detects your bank's file format",
          "Duplicate transactions are automatically skipped",
          "Create custom CSV formats in Tools > CSV Formats"
        ]}
      />

      <h1 className="text-3xl font-bold text-theme">Import Transactions</h1>

      {/* Import Mode Toggle */}
      <div data-testid={TEST_IDS.IMPORT_MODE_TOGGLE} className="flex gap-4 bg-white rounded-lg shadow p-4">
        <button
          onClick={() => {
            setBatchMode(false)
            setBatchPreviews([])
            setFiles([])
          }}
          className={`flex-1 px-4 py-2 rounded-md ${!batchMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Single File Import
        </button>
        <button
          onClick={() => {
            setBatchMode(true)
            setPreview(null)
            setFile(null)
          }}
          className={`flex-1 px-4 py-2 rounded-md ${batchMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Batch Import (Multiple Files)
        </button>
      </div>

      {/* Batch Import UI */}
      {batchMode && (
        <BatchImport
          files={files}
          setFiles={setFiles}
          batchPreviews={batchPreviews}
          accounts={accounts}
          importing={importing}
          onPreview={handleBatchPreview}
          onConfirm={handleBatchConfirm}
          onCancel={() => setBatchPreviews([])}
          onToggleSelection={toggleFileSelection}
          onUpdateAccountSource={updateAccountSource}
        />
      )}

      {/* Single File Import UI */}
      {!batchMode && (
        <SingleFileImport
          file={file}
          setFile={setFile}
          accounts={accounts}
          accountSource={accountSource}
          setAccountSource={setAccountSource}
          accountMode={accountMode}
          setAccountMode={setAccountMode}
          formatHint={formatHint}
          savedFormats={savedFormats}
          selectedCustomFormat={selectedCustomFormat}
          preview={preview}
          importing={importing}
          onPreview={handlePreview}
          onConfirm={handleConfirm}
          onCancelPreview={() => setPreview(null)}
          onFormatChange={handleFormatChange}
        />
      )}

      {/* Result */}
      {result && <ImportResult result={result} />}
    </div>
  )
}
