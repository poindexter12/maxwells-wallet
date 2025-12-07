'use client'

import { Treemap, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { Widget, CHART_VARS } from './types'

interface SpendingTreemapProps {
  widget?: Widget
  data: any
}

// Truncate text to fit within available width
function truncateText(text: string, maxWidth: number, fontSize: number): string {
  const avgCharWidth = fontSize * 0.6
  const maxChars = Math.floor((maxWidth - 16) / avgCharWidth)
  if (text.length <= maxChars) return text
  return maxChars > 3 ? text.slice(0, maxChars - 1) + '…' : ''
}

export function SpendingTreemap({ widget, data }: SpendingTreemapProps) {
  const title = widget?.title || 'Spending Breakdown'

  if (!data || !data.data || data.data.children.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
        <p className="text-theme-muted text-center py-12">No spending data available for this period</p>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
      <p className="text-sm text-theme-muted mb-4">Spending by category and merchant</p>
      <ResponsiveContainer width="100%" height={400}>
        <Treemap
          data={data.data.children}
          dataKey="value"
          aspectRatio={4/3}
          stroke="#fff"
          fill="#8884d8"
          content={({ x, y, width, height, name, value, index }: any) => {
            // Guard against invalid dimensions from Recharts edge cases
            const safeWidth = Math.max(0, width || 0)
            const safeHeight = Math.max(0, height || 0)
            if (safeWidth === 0 || safeHeight === 0) return <g />

            const showLabels = safeWidth >= 60 && safeHeight >= 40
            const fontSize = Math.min(14, Math.max(10, safeWidth / 8))
            const truncatedName = truncateText(name || '', safeWidth, fontSize)
            const colorVar = CHART_VARS[index % CHART_VARS.length]

            return (
              <g>
                <rect
                  x={x}
                  y={y}
                  width={safeWidth}
                  height={safeHeight}
                  style={{
                    fill: colorVar,
                    stroke: 'rgba(255,255,255,0.3)',
                    strokeWidth: 1
                  }}
                  rx={3}
                  ry={3}
                />
                {showLabels && truncatedName && (
                  <>
                    <text
                      x={x + 8}
                      y={y + 20}
                      textAnchor="start"
                      fontSize={fontSize}
                      fontWeight="600"
                      style={{ fill: 'var(--chart-text-light)', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                    >
                      {truncatedName}
                    </text>
                    {safeHeight >= 55 && (
                      <text
                        x={x + 8}
                        y={y + 38}
                        textAnchor="start"
                        fontSize={fontSize - 2}
                        style={{ fill: 'var(--chart-text-light)', opacity: 0.8 }}
                      >
                        {formatCurrency(value)}
                      </text>
                    )}
                  </>
                )}
              </g>
            )
          }}
        >
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg)',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--tooltip-text)'
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
