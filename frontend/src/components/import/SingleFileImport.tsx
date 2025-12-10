'use client'

import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format'
import { TEST_IDS } from '@/test-ids'
import { AccountTag, SavedCustomFormat, FORMAT_NAMES, SingleFilePreviewResponse, PreviewTransaction } from '@/types/import'

interface SingleFileImportProps {
  file: File | null
  setFile: (file: File | null) => void
  accounts: AccountTag[]
  accountSource: string
  setAccountSource: (source: string) => void
  accountMode: 'existing' | 'new'
  setAccountMode: (mode: 'existing' | 'new') => void
  formatHint: string
  savedFormats: SavedCustomFormat[]
  selectedCustomFormat: SavedCustomFormat | null
  preview: SingleFilePreviewResponse | null
  importing: boolean
  onPreview: () => void
  onConfirm: () => void
  onCancelPreview: () => void
  onFormatChange: (value: string) => void
}

export function SingleFileImport({
  file,
  setFile,
  accounts,
  accountSource,
  setAccountSource,
  accountMode,
  setAccountMode,
  formatHint,
  savedFormats,
  selectedCustomFormat,
  preview,
  importing,
  onPreview,
  onConfirm,
  onCancelPreview,
  onFormatChange
}: SingleFileImportProps) {
  const t = useTranslations('import')
  const tCommon = useTranslations('common')
  const tFields = useTranslations('fields')

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('importFile')}
          </label>
          <input
            data-testid={TEST_IDS.IMPORT_FILE_INPUT}
            data-chaos-target="import-file-input"
            type="file"
            accept=".csv,.qif,.qfx,.ofx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                {t('accountSource')} <span className="text-red-500">*</span>
              </label>
              {accounts.length > 0 && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMode('existing')
                      setAccountSource('')
                    }}
                    className={`px-2 py-0.5 text-xs rounded ${accountMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    data-chaos-target="import-account-mode-existing"
                  >
                    {t('existing')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMode('new')
                      setAccountSource('')
                    }}
                    className={`px-2 py-0.5 text-xs rounded ${accountMode === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    data-chaos-target="import-account-mode-new"
                  >
                    {t('new')}
                  </button>
                </div>
              )}
            </div>
            {accountMode === 'existing' && accounts.length > 0 ? (
              <select
                data-testid={TEST_IDS.IMPORT_ACCOUNT_SELECT}
                data-chaos-target="import-account-select"
                value={accountSource}
                onChange={(e) => setAccountSource(e.target.value)}
                className={`w-full px-4 py-2 border rounded-md ${!accountSource ? 'border-yellow-400' : ''}`}
              >
                <option value="">{t('selectAccount')}</option>
                {accounts.map((acct) => (
                  <option key={acct.id} value={acct.value}>
                    {acct.value}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder={t('accountPlaceholder')}
                value={accountSource}
                onChange={(e) => setAccountSource(e.target.value)}
                className={`w-full px-4 py-2 border rounded-md ${!accountSource ? 'border-yellow-400' : ''}`}
                data-chaos-target="import-account-input"
              />
            )}
            {!accountSource && (
              <p className="text-xs text-yellow-600 mt-1">
                {t('accountRequired')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('formatOptional')}
            </label>
            <select
              data-testid={TEST_IDS.IMPORT_FORMAT_SELECT}
              data-chaos-target="import-format-select"
              value={selectedCustomFormat ? `custom:${selectedCustomFormat.id}` : formatHint}
              onChange={(e) => onFormatChange(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="">{t('autoDetect')}</option>
              <optgroup label={t('standardFormats')}>
                <option value="qif">Quicken (QIF)</option>
                <option value="qfx">Quicken/OFX (QFX)</option>
              </optgroup>
              {savedFormats.length > 0 && (
                <optgroup label={t('savedCustomFormats')}>
                  {savedFormats.map(fmt => (
                    <option key={fmt.id} value={`custom:${fmt.id}`}>
                      {fmt.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {selectedCustomFormat && (
              <p className="mt-1 text-xs text-purple-600">
                {t('usingFormat', { name: selectedCustomFormat.name })}
              </p>
            )}
          </div>
        </div>

        <button
          data-testid={TEST_IDS.IMPORT_PREVIEW_BUTTON}
          data-chaos-target="import-preview-button"
          onClick={onPreview}
          disabled={!file || !accountSource}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {!accountSource ? t('selectAccountToPreview') : t('previewImport')}
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{t('preview')}</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {selectedCustomFormat
                ? selectedCustomFormat.name
                : FORMAT_NAMES[preview.detected_format] || preview.detected_format}
            </span>
          </div>

          {preview.errors && preview.errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm font-medium text-red-800">{t('parsingErrors')}</p>
              <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
                {preview.errors.slice(0, 3).map((err: string, idx: number) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
            <div>
              <p className="text-sm text-gray-600">{t('transactions')}</p>
              <p className="text-2xl font-bold">{preview.transaction_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('totalAmount')}</p>
              <p className={`text-2xl font-bold ${preview.total_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(preview.total_amount)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{tFields('date')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{tFields('merchant')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{tFields('bucket')}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{tFields('amount')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.transactions.slice(0, 10).map((txn: PreviewTransaction, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm">{format(new Date(txn.date), 'MM/dd/yyyy')}</td>
                    <td className="px-4 py-2 text-sm">{txn.merchant}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{txn.bucket || t('noBucket')}</span>
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
                {t('showingFirstOfTotal', { shown: 10, total: preview.transaction_count })}
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              data-testid={TEST_IDS.IMPORT_CONFIRM_BUTTON}
              data-chaos-target="import-confirm-button"
              onClick={onConfirm}
              disabled={importing}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {importing ? t('importing') : t('confirm')}
            </button>
            <button
              onClick={onCancelPreview}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              data-chaos-target="import-cancel-button"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
