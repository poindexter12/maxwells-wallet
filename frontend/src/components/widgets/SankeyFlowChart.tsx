'use client'

import { useTranslations } from 'next-intl'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { Widget, SankeyData, CHART_VARS } from './types'

interface SankeyFlowChartProps {
  widget?: Widget
  data: SankeyData | null
}

interface SankeyNodeProps {
  x: number
  y: number
  width: number
  height: number
  index: number
  payload: { name: string }
}

// Custom node component defined at module level to avoid React Compiler issues
function SankeyNode({ x, y, width, height, index, payload }: SankeyNodeProps) {
  // Guard against invalid dimensions from Recharts edge cases
  const safeWidth = Math.max(0, width || 0)
  const safeHeight = Math.max(0, height || 0)
  if (safeWidth === 0 || safeHeight === 0) return <g />

  const name = payload?.name || ''
  const isLeftSide = x < 200
  const colorVar = CHART_VARS[index % CHART_VARS.length]
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={safeWidth}
        height={safeHeight}
        style={{ fill: colorVar, stroke: colorVar }}
      />
      <text
        x={isLeftSide ? x - 6 : x + safeWidth + 6}
        y={y + safeHeight / 2}
        textAnchor={isLeftSide ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={12}
        style={{ fill: 'var(--chart-text)' }}
      >
        {name}
      </text>
    </g>
  )
}

export function SankeyFlowChart({ widget: _widget, data }: SankeyFlowChartProps) {
  const t = useTranslations('dashboard.widgets')
  const title = t('sankey')

  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
        <p className="text-theme-muted text-center py-12">{t('noFlowData')}</p>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
      <p className="text-sm text-theme-muted mb-4">{t('sankeyDescription')}</p>
      <ResponsiveContainer width="100%" height={450}>
        <Sankey
          data={data}
          nodePadding={40}
          nodeWidth={12}
          linkCurvature={0.5}
          margin={{ top: 20, right: 150, bottom: 20, left: 150 }}
          node={<SankeyNode x={0} y={0} width={0} height={0} index={0} payload={{ name: '' }} />}
          link={{
            stroke: 'var(--chart-link)'
          }}
        >
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg)',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--tooltip-text)'
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
