'use client'

import { ImportResult as ImportResultType } from '@/types/import'

interface ImportResultProps {
  result: ImportResultType
}

export function ImportResult({ result }: ImportResultProps) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-semibold text-green-900">Import Complete!</h2>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-green-700">Imported</p>
          <p className="text-2xl font-bold text-green-900">
            {result.total_imported || result.imported}
          </p>
        </div>
        <div>
          <p className="text-sm text-green-700">Duplicates Skipped</p>
          <p className="text-2xl font-bold text-green-900">
            {result.total_duplicates || result.duplicates}
          </p>
        </div>
        <div>
          <p className="text-sm text-green-700">
            {result.files ? 'Files Imported' : 'Format Saved'}
          </p>
          <p className="text-2xl font-bold text-green-900">
            {result.files ? result.files.length : (result.format_saved || result.config_saved ? 'Yes' : 'No')}
          </p>
        </div>
      </div>

      {/* Per-file results for batch imports */}
      {result.files && result.files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-green-900">File Details:</h3>
          <div className="space-y-2">
            {result.files.map((file) => (
              <div key={file.filename} className="bg-white rounded p-3 flex justify-between items-center">
                <span className="font-medium">{file.filename}</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700">{file.imported} imported</span>
                  <span className="text-yellow-700">{file.duplicates} duplicates</span>
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
            Cross-Account Matches ({result.cross_account_warning_count})
          </h3>
          <p className="text-sm text-yellow-700">
            These transactions appear to match existing transactions in other accounts.
            This could indicate transfers between accounts.
          </p>
        </div>
      )}
    </div>
  )
}
