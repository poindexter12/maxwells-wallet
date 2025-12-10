'use client'

interface WidgetSkeletonProps {
  type?: 'card' | 'chart' | 'list' | 'heatmap'
  height?: string
}

export function WidgetSkeleton({ type = 'chart', height = 'h-64' }: WidgetSkeletonProps) {
  const baseClasses = 'animate-pulse bg-theme-subtle rounded'

  if (type === 'card') {
    return (
      <div className="card p-6 space-y-4">
        <div className={`${baseClasses} h-4 w-1/3`}></div>
        <div className={`${baseClasses} h-8 w-1/2`}></div>
        <div className={`${baseClasses} h-3 w-2/3`}></div>
      </div>
    )
  }

  if (type === 'list') {
    return (
      <div className="card p-6 space-y-3">
        <div className={`${baseClasses} h-5 w-1/3 mb-4`}></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <div className={`${baseClasses} h-4 w-1/2`}></div>
            <div className={`${baseClasses} h-4 w-16`}></div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'heatmap') {
    return (
      <div className="card p-6">
        <div className={`${baseClasses} h-5 w-1/4 mb-4`}></div>
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div key={i} className={`${baseClasses} aspect-square`}></div>
          ))}
        </div>
      </div>
    )
  }

  // Default chart skeleton
  return (
    <div className="card p-6">
      <div className={`${baseClasses} h-5 w-1/4 mb-4`}></div>
      <div className={`${baseClasses} ${height}`}></div>
    </div>
  )
}

// Summary cards specific skeleton (3 cards)
export function SummaryCardsSkeleton() {
  const baseClasses = 'animate-pulse bg-theme-subtle rounded'

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card p-6">
          <div className={`${baseClasses} h-4 w-1/3 mb-2`}></div>
          <div className={`${baseClasses} h-8 w-1/2`}></div>
        </div>
      ))}
    </div>
  )
}

// Velocity/Anomalies panel skeleton (half width card with stats)
export function StatsPanelSkeleton() {
  const baseClasses = 'animate-pulse bg-theme-subtle rounded'

  return (
    <div className="card p-6 space-y-4">
      <div className={`${baseClasses} h-5 w-1/3`}></div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <div className={`${baseClasses} h-3 w-2/3 mb-2`}></div>
            <div className={`${baseClasses} h-6 w-1/2`}></div>
          </div>
        ))}
      </div>
    </div>
  )
}
