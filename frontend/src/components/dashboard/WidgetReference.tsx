'use client'

import { WIDGET_INFO } from '@/types/dashboard'

export function WidgetReference() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">Widget Reference</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(WIDGET_INFO).map(([type, info]) => (
          <div key={type} className="p-3 rounded-lg bg-theme-subtle">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{info.icon}</span>
              <span className="font-medium text-theme">{info.name}</span>
            </div>
            <p className="text-xs text-theme-muted">{info.description}</p>
            <div className="flex gap-2 mt-2">
              {info.supportsFilter && (
                <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded">
                  Filterable
                </span>
              )}
              {info.canDuplicate && (
                <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded">
                  Duplicatable
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
