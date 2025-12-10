'use client'

import { Widget, SummaryData, MonthOverMonthData, SpendingVelocityData, AnomaliesData, TrendsData, TopMerchantsData, SankeyData, TreemapData, HeatmapData } from './types'
import { SummaryCards } from './SummaryCards'
import { SpendingVelocity } from './SpendingVelocity'
import { AnomaliesPanel } from './AnomaliesPanel'
import { BucketPieChart } from './BucketPieChart'
import { TopMerchantsList } from './TopMerchantsList'
import { TrendsChart } from './TrendsChart'
import { SankeyFlowChart } from './SankeyFlowChart'
import { SpendingTreemap } from './SpendingTreemap'
import { SpendingHeatmap } from './SpendingHeatmap'

interface WidgetRendererProps {
  widget: Widget
  // Dashboard data
  summary: SummaryData
  monthOverMonth: MonthOverMonthData | null
  spendingVelocity: SpendingVelocityData | null
  anomalies: AnomaliesData | null
  trends: TrendsData | null
  topMerchants: TopMerchantsData | null
  sankeyData: SankeyData | null
  treemapData: TreemapData | null
  heatmapData: HeatmapData | null
  // Context
  isMonthlyScale: boolean
  selectedYear: number
  selectedMonth: number
  bucketData: Array<{ name: string; value: number; count: number }>
  // Custom widget data (for filtered widgets)
  customData?: TrendsData | TopMerchantsData | SankeyData | TreemapData | HeatmapData | null
}

export function WidgetRenderer({
  widget,
  summary,
  monthOverMonth,
  spendingVelocity,
  anomalies,
  trends,
  topMerchants,
  sankeyData,
  treemapData,
  heatmapData,
  isMonthlyScale,
  selectedYear,
  selectedMonth,
  bucketData,
  customData
}: WidgetRendererProps) {
  switch (widget.widget_type) {
    case 'summary':
      return <SummaryCards summary={summary} monthOverMonth={monthOverMonth} />

    case 'velocity':
      return (
        <SpendingVelocity
          isMonthlyScale={isMonthlyScale}
          summary={summary}
          spendingVelocity={spendingVelocity}
          selectedYear={selectedYear}
        />
      )

    case 'anomalies':
      return (
        <AnomaliesPanel
          anomalies={anomalies}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      )

    case 'bucket_pie':
      return <BucketPieChart widget={widget} bucketData={bucketData} />

    case 'top_merchants':
      return <TopMerchantsList widget={widget} data={(customData as TopMerchantsData | null) || topMerchants} />

    case 'trends':
      return <TrendsChart widget={widget} data={(customData as TrendsData | null) || trends} isMonthlyScale={isMonthlyScale} />

    case 'sankey':
      return <SankeyFlowChart widget={widget} data={(customData as SankeyData | null) || sankeyData} />

    case 'treemap':
      return <SpendingTreemap widget={widget} data={(customData as TreemapData | null) || treemapData} />

    case 'heatmap':
      return (
        <SpendingHeatmap
          widget={widget}
          data={(customData as HeatmapData | null) || heatmapData}
          isMonthlyScale={isMonthlyScale}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      )

    default:
      return null
  }
}
