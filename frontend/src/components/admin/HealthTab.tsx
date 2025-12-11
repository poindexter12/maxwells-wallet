'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { HealthStats } from '@/types/admin'

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`
  } else if (hours > 0) {
    return `${hours}h ${mins}m`
  } else {
    return `${mins}m`
  }
}

function formatLatency(ms: number): string {
  if (ms < 1) {
    return '<1ms'
  } else if (ms < 1000) {
    return `${Math.round(ms)}ms`
  } else {
    return `${(ms / 1000).toFixed(2)}s`
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
    case 'up':
      return 'text-positive'
    case 'degraded':
      return 'text-[var(--color-warning)]'
    case 'unhealthy':
    case 'down':
      return 'text-negative'
    default:
      return 'text-theme-muted'
  }
}

function getStatusBgColor(status: string): string {
  switch (status) {
    case 'healthy':
    case 'up':
      return 'bg-positive'
    case 'degraded':
      return 'bg-[var(--color-warning)]'
    case 'unhealthy':
    case 'down':
      return 'bg-negative'
    default:
      return 'bg-theme-muted'
  }
}

export function HealthTab() {
  const t = useTranslations('admin.health')
  const tCommon = useTranslations('common')

  const [stats, setStats] = useState<HealthStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/observability/stats')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      setStats(data)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading && !stats) {
    return <div className="text-center py-12 text-theme-muted">{tCommon('loading')}</div>
  }

  if (error && !stats) {
    return (
      <div className="card p-6 text-center">
        <p className="text-negative mb-4">{error}</p>
        <p className="text-sm text-theme-muted">
          {t.rich('observabilityDisabled', {
            code: (chunks) => <code className="bg-theme-elevated px-1 rounded">{chunks}</code>
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Status Banner */}
      {stats && (
        <div className={`rounded-lg p-4 ${getStatusBgColor(stats.status)} bg-opacity-10 border ${
          stats.status === 'healthy' ? 'border-[var(--color-positive)]' :
          stats.status === 'degraded' ? 'border-[var(--color-warning)]' :
          'border-[var(--color-negative)]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusBgColor(stats.status)} animate-pulse`}></div>
              <span className={`text-lg font-semibold capitalize ${getStatusColor(stats.status)}`}>
                {t('systemStatus', { status: stats.status })}
              </span>
            </div>
            {lastUpdated && (
              <span className="text-xs text-theme-muted">
                {t('updated', { time: lastUpdated.toLocaleTimeString() })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-theme-muted">{t('uptime')}</p>
            <p className="text-2xl font-bold text-theme">{formatUptime(stats.uptime_seconds)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-theme-muted">{t('totalRequests')}</p>
            <p className="text-2xl font-bold text-theme">{stats.total_requests.toLocaleString()}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-theme-muted">{t('activeRequests')}</p>
            <p className="text-2xl font-bold text-theme">{stats.active_requests}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-theme-muted">{t('slowQueries')}</p>
            <p className={`text-2xl font-bold ${stats.slow_query_count > 0 ? 'text-negative' : 'text-positive'}`}>
              {stats.slow_query_count}
            </p>
          </div>
        </div>
      )}

      {/* Latency Percentiles */}
      {stats && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">{t('requestLatency')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-theme-muted">{t('p50Median')}</span>
                <span className="text-sm font-medium text-theme">{formatLatency(stats.request_latency.p50)}</span>
              </div>
              <div className="w-full bg-theme-elevated rounded-full h-2">
                <div
                  className="bg-positive h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (stats.request_latency.p50 / 1000) * 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-theme-muted">{t('p95')}</span>
                <span className="text-sm font-medium text-theme">{formatLatency(stats.request_latency.p95)}</span>
              </div>
              <div className="w-full bg-theme-elevated rounded-full h-2">
                <div
                  className="bg-[var(--color-accent)] h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (stats.request_latency.p95 / 1000) * 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-theme-muted">{t('p99')}</span>
                <span className="text-sm font-medium text-theme">{formatLatency(stats.request_latency.p99)}</span>
              </div>
              <div className="w-full bg-theme-elevated rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    stats.request_latency.p99 > 5000 ? 'bg-negative' : 'bg-[var(--color-warning)]'
                  }`}
                  style={{ width: `${Math.min(100, (stats.request_latency.p99 / 1000) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Rate */}
      {stats && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">{t('errorRate')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-theme-muted">{t('lastHour')}</span>
                <span className={`text-xl font-bold ${
                  stats.error_rate.last_hour > 5 ? 'text-negative' :
                  stats.error_rate.last_hour > 1 ? 'text-[var(--color-warning)]' :
                  'text-positive'
                }`}>
                  {stats.error_rate.last_hour.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-theme-elevated rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    stats.error_rate.last_hour > 5 ? 'bg-negative' :
                    stats.error_rate.last_hour > 1 ? 'bg-[var(--color-warning)]' :
                    'bg-positive'
                  }`}
                  style={{ width: `${Math.min(100, stats.error_rate.last_hour * 10)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-theme-muted">{t('last24Hours')}</span>
                <span className={`text-xl font-bold ${
                  stats.error_rate.last_24h > 5 ? 'text-negative' :
                  stats.error_rate.last_24h > 1 ? 'text-[var(--color-warning)]' :
                  'text-positive'
                }`}>
                  {stats.error_rate.last_24h.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-theme-elevated rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    stats.error_rate.last_24h > 5 ? 'bg-negative' :
                    stats.error_rate.last_24h > 1 ? 'bg-[var(--color-warning)]' :
                    'bg-positive'
                  }`}
                  style={{ width: `${Math.min(100, stats.error_rate.last_24h * 10)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="card p-6 bg-theme-elevated">
        <h2 className="text-lg font-semibold text-theme mb-4">{t('observabilityInfo')}</h2>
        <div className="text-sm text-theme-muted space-y-2">
          <p>
            <strong>{t('metricsEndpoint')}:</strong>{' '}
            <code className="bg-theme px-1 rounded">/metrics</code> {t('metricsFormat')}
          </p>
          <p>
            <strong>{t('slowQueryThreshold')}:</strong> {t('slowQueryDescription')}
          </p>
          <p>
            <strong>{t('autoRefresh')}:</strong> {t('autoRefreshDescription')}
          </p>
        </div>
      </div>
    </div>
  )
}
