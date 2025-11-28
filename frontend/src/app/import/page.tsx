'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'

const FORMAT_NAMES: Record<string, string> = {
  'bofa_bank': 'Bank of America (Checking/Savings)',
  'bofa_cc': 'Bank of America (Credit Card)',
  'amex_cc': 'American Express',
  'unknown': 'Unknown'
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [accountSource, setAccountSource] = useState('')
  const [formatHint, setFormatHint] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function handlePreview() {
    if (!file) return

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

    const formData = new FormData()
    formData.append('file', file)
    formData.append('format_type', preview.detected_format)
    if (accountSource) formData.append('account_source', accountSource)
    formData.append('save_format', 'true')

    try {
      const res = await fetch('/api/v1/import/confirm', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      setResult(data)
      setPreview(null)
      setFile(null)
      setAccountSource('')
    } catch (error) {
      console.error('Error importing:', error)
      alert('Error importing transactions')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Import Transactions</h1>

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Source (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., BOFA-Checking, AMEX-53004"
              value={accountSource}
              onChange={(e) => setAccountSource(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">
              Required for Bank of America files
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format Hint (Optional)
            </label>
            <select
              value={formatHint}
              onChange={(e) => setFormatHint(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="">Auto-detect</option>
              <option value="bofa_bank">Bank of America (Checking/Savings)</option>
              <option value="bofa_cc">Bank of America (Credit Card)</option>
              <option value="amex_cc">American Express</option>
            </select>
          </div>
        </div>

        <button
          onClick={handlePreview}
          disabled={!file}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Preview Import
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Preview</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {FORMAT_NAMES[preview.detected_format] || preview.detected_format} format detected
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
            <div>
              <p className="text-sm text-gray-600">Transactions</p>
              <p className="text-2xl font-bold">{preview.transaction_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className={`text-2xl font-bold ${preview.total_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(preview.total_amount)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.transactions.slice(0, 10).map((txn: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm">{format(new Date(txn.date), 'MM/dd/yyyy')}</td>
                    <td className="px-4 py-2 text-sm">{txn.merchant}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{txn.category || 'Uncategorized'}</span>
                    </td>
                    <td className={`px-4 py-2 text-sm text-right ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(txn.amount, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.transactions.length > 10 && (
              <p className="text-center text-sm text-gray-500 mt-4">
                Showing first 10 of {preview.transaction_count} transactions
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleConfirm}
              disabled={importing}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Confirm Import'}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-green-900 mb-4">Import Complete!</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-green-700">Imported</p>
              <p className="text-2xl font-bold text-green-900">{result.imported}</p>
            </div>
            <div>
              <p className="text-sm text-green-700">Duplicates Skipped</p>
              <p className="text-2xl font-bold text-green-900">{result.duplicates}</p>
            </div>
            <div>
              <p className="text-sm text-green-700">Format Saved</p>
              <p className="text-2xl font-bold text-green-900">{result.format_saved ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
