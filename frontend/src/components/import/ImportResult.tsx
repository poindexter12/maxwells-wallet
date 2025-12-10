'use client'

import { useTranslations } from 'next-intl'
import { ImportResult as ImportResultType } from '@/types/import'

interface ImportResultProps {
  result: ImportResultType
}

export function ImportResult({ result }: ImportResultProps) {
  const t = useTranslations('import')
  const tCommon = useTranslations('common')

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-semibold text-green-900">{t('importComplete')}</h2>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-green-700">{t('imported')}</p>
          <p className="text-2xl font-bold text-green-900">
            {result.total_imported || result.imported}
          </p>
        </div>
        <div>
          <p className="text-sm text-green-700">{t('duplicatesSkippedShort')}</p>
          <p className="text-2xl font-bold text-green-900">
            {result.total_duplicates || result.duplicates}
          </p>
        </div>
        <div>
          <p className="text-sm text-green-700">
            {result.files ? t('filesImported') : t('formatSaved')}
          </p>
          <p className="text-2xl font-bold text-green-900">
            {result.files ? result.files.length : (result.format_saved || result.config_saved ? tCommon('yes') : tCommon('no'))}
          </p>
        </div>
      </div>

      {/* Per-file results for batch imports */}
      {result.files && result.files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-green-900">{t('fileDetails')}</h3>
          <div className="space-y-2">
            {result.files.map((file) => (
              <div key={file.filename} className="bg-white rounded p-3 flex justify-between items-center">
                <span className="font-medium">{file.filename}</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700">{t('importedCount', { count: file.imported })}</span>
                  <span className="text-yellow-700">{t('duplicatesCount', { count: file.duplicates })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-account warnings */}
      {result.cross_account_warning_count && result.cross_account_warning_count > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-yellow-800">
            {t('crossAccountMatches', { count: result.cross_account_warning_count })}
          </h3>
          <p className="text-sm text-yellow-700">
            {t('crossAccountWarning')}
          </p>
        </div>
      )}
    </div>
  )
}
