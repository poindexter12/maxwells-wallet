'use client'

import { useTranslations } from 'next-intl'
import { useFormat } from '@/hooks/useFormat'
import { FilePreview, AccountTag, FORMAT_NAMES } from '@/types/import'

interface BatchImportProps {
  files: File[]
  setFiles: (files: File[]) => void
  batchPreviews: FilePreview[]
  accounts: AccountTag[]
  importing: boolean
  onPreview: () => void
  onConfirm: () => void
  onCancel: () => void
  onToggleSelection: (filename: string) => void
  onUpdateAccountSource: (filename: string, accountSource: string) => void
}

export function BatchImport({
  files,
  setFiles,
  batchPreviews,
  accounts,
  importing,
  onPreview,
  onConfirm,
  onCancel,
  onToggleSelection,
  onUpdateAccountSource
}: BatchImportProps) {
  const t = useTranslations('import')
  const tCommon = useTranslations('common')
  const { formatCurrency, formatDateRange } = useFormat()

  const selectedFiles = batchPreviews.filter(p => p.selected)
  const filesWithoutAccount = selectedFiles.filter(p => !(p.accountSourceOverride || p.account_source))
  const allHaveAccounts = filesWithoutAccount.length === 0
  const isDisabled = importing || selectedFiles.length === 0 || !allHaveAccounts

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('importFiles')}
          </label>
          <input
            type="file"
            accept=".csv,.qif,.qfx,.ofx"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            data-chaos-target="batch-file-input"
          />
          {files.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {t('filesSelected', { count: files.length })}
            </p>
          )}
        </div>

        <button
          onClick={onPreview}
          disabled={files.length === 0}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          data-chaos-target="batch-preview-button"
        >
          {t('previewBatchImport')}
        </button>
      </div>

      {/* Batch Previews */}
      {batchPreviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{t('batchImportPreview')}</h2>
            <div className="text-sm text-gray-600">
              {t('filesSelectedOfTotal', { selected: selectedFiles.length, total: batchPreviews.length })}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
            <div>
              <p className="text-sm text-gray-600">{t('totalTransactions')}</p>
              <p className="text-2xl font-bold">
                {selectedFiles.reduce((sum, p) => sum + p.transaction_count, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('totalDuplicates')}</p>
              <p className="text-2xl font-bold text-yellow-600">
                {selectedFiles.reduce((sum, p) => sum + p.duplicate_count + p.cross_file_duplicate_count, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('netAmount')}</p>
              <p className={`text-2xl font-bold ${selectedFiles.reduce((sum, p) => sum + p.total_amount, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(selectedFiles.reduce((sum, p) => sum + p.total_amount, 0))}
              </p>
            </div>
          </div>

          {/* File List */}
          <div className="space-y-4">
            {batchPreviews.map((filePreview) => (
              <div key={filePreview.filename} className={`border rounded-lg p-4 ${filePreview.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={filePreview.selected}
                    onChange={() => onToggleSelection(filePreview.filename)}
                    className="mt-1"
                    data-chaos-target={`batch-file-checkbox-${filePreview.filename}`}
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{filePreview.filename}</h3>
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                          {FORMAT_NAMES[filePreview.detected_format] || filePreview.detected_format}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">{t('transactions')}</p>
                        <p className="font-semibold">{filePreview.transaction_count}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t('dbDuplicates')}</p>
                        <p className="font-semibold text-yellow-600">{filePreview.duplicate_count}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t('batchDuplicates')}</p>
                        <p className="font-semibold text-orange-600">{filePreview.cross_file_duplicate_count}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t('dateRange')}</p>
                        <p className="font-semibold">
                          {filePreview.date_range_start && filePreview.date_range_end
                            ? formatDateRange(filePreview.date_range_start, filePreview.date_range_end)
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t('totalAmount')}</p>
                        <p className={`font-semibold ${filePreview.total_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(filePreview.total_amount)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {t('accountSource')} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        {accounts.length > 0 && (
                          <select
                            value={filePreview.accountSourceOverride || filePreview.account_source || ''}
                            onChange={(e) => onUpdateAccountSource(filePreview.filename, e.target.value)}
                            className={`flex-1 px-3 py-1 text-sm border rounded-md ${!(filePreview.accountSourceOverride || filePreview.account_source) ? 'border-yellow-400' : ''}`}
                            data-chaos-target={`batch-account-select-${filePreview.filename}`}
                          >
                            <option value="">{t('selectAccount')}</option>
                            {accounts.map((acct) => (
                              <option key={acct.id} value={acct.value}>
                                {acct.value}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          value={filePreview.accountSourceOverride || filePreview.account_source || ''}
                          onChange={(e) => onUpdateAccountSource(filePreview.filename, e.target.value)}
                          placeholder={accounts.length > 0 ? t('orTypeNew') : t('accountPlaceholder')}
                          className={`${accounts.length > 0 ? 'w-32' : 'flex-1'} px-3 py-1 text-sm border rounded-md ${!(filePreview.accountSourceOverride || filePreview.account_source) ? 'border-yellow-400' : ''}`}
                          data-chaos-target={`batch-account-input-${filePreview.filename}`}
                        />
                      </div>
                      {!(filePreview.accountSourceOverride || filePreview.account_source) && (
                        <p className="text-xs text-yellow-600 mt-1">{t('accountRequired')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={onConfirm}
              disabled={isDisabled}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              data-chaos-target="batch-confirm-button"
            >
              {importing ? t('importing') :
               !allHaveAccounts ? t('filesMissingAccount', { count: filesWithoutAccount.length }) :
               t('importSelectedFiles', { count: selectedFiles.length })}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              data-chaos-target="batch-cancel-button"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
