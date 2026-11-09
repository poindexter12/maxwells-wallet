'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getAuthHeadersFromStorage } from '@/contexts/AuthContext'
import { CHAOS_EXCLUDED_IDS, TEST_IDS } from '@/test-ids'
import type { ApiToken, CreatedApiToken, CreateApiTokenRequest } from '@/types/apiTokens'

type ExpiryOption = 'never' | '30' | '90' | '365'
type ScopeOption = 'read' | 'read-write'

interface NewlyCreatedToken {
  value: string
  connectionSnippet: string
}

function getErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('detail' in payload)) {
    return null
  }

  const detail = payload.detail
  if (typeof detail === 'string') {
    return detail
  }
  if (typeof detail === 'object' && detail !== null && 'message' in detail && typeof detail.message === 'string') {
    return detail.message
  }

  return null
}

function formatTokenDate(value: string | null, fallback: string): string {
  if (!value) return fallback
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ApiTokensSection() {
  const t = useTranslations('settings.apiTokens')
  const tCommon = useTranslations('common')
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [scope, setScope] = useState<ScopeOption>('read')
  const [expiry, setExpiry] = useState<ExpiryOption>('never')
  const [creating, setCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newToken, setNewToken] = useState<NewlyCreatedToken | null>(null)

  const loadTokens = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/auth/tokens', { headers: getAuthHeadersFromStorage() })
      if (!response.ok) {
        const data: unknown = await response.json()
        throw new Error(getErrorMessage(data) ?? t('loadError'))
      }
      const data: ApiToken[] = await response.json()
      setTokens(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadTokens()
  }, [loadTokens])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return

    setCreating(true)
    setError(null)
    try {
      const request: CreateApiTokenRequest = {
        name: name.trim(),
        scopes: scope === 'read' ? ['read'] : ['read', 'write'],
      }
      if (expiry !== 'never') {
        request.expires_in_days = Number(expiry)
      }

      const response = await fetch('/api/v1/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeadersFromStorage() },
        body: JSON.stringify(request),
      })
      const data: unknown = await response.json()
      if (!response.ok) {
        throw new Error(getErrorMessage(data) ?? t('createError'))
      }

      const created = data as CreatedApiToken
      const { token, ...tokenDetails } = created
      setTokens((current) => [tokenDetails, ...current])
      setNewToken({
        value: token,
        connectionSnippet: `URL: ${window.location.origin}/mcp\nAuthorization: Bearer ${token}`,
      })
      setName('')
      setScope('read')
      setExpiry('never')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('createError'))
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(tokenId: number) {
    setError(null)
    try {
      const response = await fetch(`/api/v1/auth/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: getAuthHeadersFromStorage(),
      })
      if (!response.ok) {
        const data: unknown = await response.json()
        throw new Error(getErrorMessage(data) ?? t('revokeError'))
      }
      await loadTokens()
      setRevokingId(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('revokeError'))
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
  }

  return (
    <section className="space-y-6" data-testid={TEST_IDS.API_TOKENS_SECTION}>
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-theme">{t('title')}</h2>
        <p className="mt-1 text-sm text-theme-muted">{t('description')}</p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400" data-testid={TEST_IDS.API_TOKEN_ERROR}>
            {error}
          </div>
        )}

        {newToken && (
          <div className="mt-4 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20" data-testid={TEST_IDS.API_TOKEN_CREATED_NOTICE}>
            <p className="text-sm font-medium text-theme">{t('createdWarning')}</p>
            <label className="block text-sm font-medium text-theme" htmlFor="api-token-value">{t('tokenValue')}</label>
            <div className="flex gap-2">
              <input id="api-token-value" readOnly value={newToken.value} className="input min-w-0 flex-1 font-mono text-xs" data-testid={TEST_IDS.API_TOKEN_VALUE} />
              <button type="button" className="btn-secondary" onClick={() => void copy(newToken.value)} data-testid={TEST_IDS.API_TOKEN_COPY_BUTTON} data-chaos-target="settings-api-token-copy">{tCommon('copy')}</button>
            </div>
            <label className="block text-sm font-medium text-theme" htmlFor="api-token-connection">{t('connectionSnippet')}</label>
            <textarea id="api-token-connection" readOnly value={newToken.connectionSnippet} className="input min-h-20 w-full font-mono text-xs" data-testid={TEST_IDS.API_TOKEN_CONNECTION_SNIPPET} />
            <button type="button" className="btn-secondary" onClick={() => setNewToken(null)} data-testid={TEST_IDS.API_TOKEN_DISMISS_BUTTON} data-chaos-target="settings-api-token-dismiss">{t('dismiss')}</button>
          </div>
        )}

        <form className="mt-6 grid gap-4 md:grid-cols-3" onSubmit={handleCreate}>
          <div>
            <label className="mb-1 block text-sm font-medium text-theme" htmlFor="api-token-name">{t('name')}</label>
            <input id="api-token-name" required value={name} onChange={(event) => setName(event.target.value)} className="input w-full" data-testid={TEST_IDS.API_TOKEN_NAME_INPUT} data-chaos-target="settings-api-token-name" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-theme" htmlFor="api-token-scope">{t('scope')}</label>
            <select id="api-token-scope" value={scope} onChange={(event) => setScope(event.target.value as ScopeOption)} className="input w-full" data-testid={TEST_IDS.API_TOKEN_SCOPE_SELECT} data-chaos-target="settings-api-token-scope">
              <option value="read">{t('scopes.read')}</option>
              <option value="read-write">{t('scopes.readWrite')}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-theme" htmlFor="api-token-expiry">{t('expiry')}</label>
            <select id="api-token-expiry" value={expiry} onChange={(event) => setExpiry(event.target.value as ExpiryOption)} className="input w-full" data-testid={TEST_IDS.API_TOKEN_EXPIRY_SELECT} data-chaos-target="settings-api-token-expiry">
              <option value="never">{t('expiries.never')}</option>
              <option value="30">{t('expiries.days', { count: 30 })}</option>
              <option value="90">{t('expiries.days', { count: 90 })}</option>
              <option value="365">{t('expiries.days', { count: 365 })}</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <button type="submit" disabled={creating || !name.trim()} className="btn-primary" data-testid={TEST_IDS.API_TOKEN_CREATE_BUTTON} data-chaos-target="settings-api-token-create">
              {creating ? tCommon('loading') : t('create')}
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden" data-testid={TEST_IDS.API_TOKENS_LIST}>
        {loading ? (
          <div className="p-6 text-sm text-theme-muted">{tCommon('loading')}</div>
        ) : tokens.length === 0 ? (
          <div className="p-6 text-sm text-theme-muted" data-testid={TEST_IDS.API_TOKENS_EMPTY}>{t('empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border)]">
              <thead><tr className="text-left text-xs font-medium uppercase text-theme-muted"><th className="px-4 py-3">{t('columns.name')}</th><th className="px-4 py-3">{t('columns.prefix')}</th><th className="px-4 py-3">{t('columns.scopes')}</th><th className="px-4 py-3">{t('columns.created')}</th><th className="px-4 py-3">{t('columns.lastUsed')}</th><th className="px-4 py-3">{t('columns.expires')}</th><th className="px-4 py-3">{t('columns.status')}</th><th className="px-4 py-3">{t('columns.actions')}</th></tr></thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <td className="px-4 py-3 text-sm text-theme">{token.name}</td><td className="px-4 py-3 font-mono text-xs text-theme-muted">{token.token_prefix}</td><td className="px-4 py-3 text-sm text-theme-muted">{token.scopes.join(', ')}</td><td className="px-4 py-3 text-sm text-theme-muted">{formatTokenDate(token.created_at, t('never'))}</td><td className="px-4 py-3 text-sm text-theme-muted">{formatTokenDate(token.last_used_at, t('never'))}</td><td className="px-4 py-3 text-sm text-theme-muted">{formatTokenDate(token.expires_at, t('never'))}</td><td className="px-4 py-3 text-sm text-theme-muted">{token.revoked_at ? t('revoked') : t('active')}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">
                      {token.revoked_at ? null : revokingId === token.id ? <><button type="button" className="btn-primary text-xs" onClick={() => void handleRevoke(token.id)} data-testid={TEST_IDS.API_TOKEN_REVOKE_CONFIRM_BUTTON} data-chaos-target="settings-api-token-revoke-confirm">{tCommon('confirm')}</button><button type="button" className="btn-secondary text-xs" onClick={() => setRevokingId(null)} data-testid={TEST_IDS.API_TOKEN_REVOKE_CANCEL_BUTTON} data-chaos-target="settings-api-token-revoke-cancel">{tCommon('cancel')}</button></> : <button type="button" className="text-xs text-[var(--color-negative)] hover:underline" onClick={() => setRevokingId(token.id)} data-testid={CHAOS_EXCLUDED_IDS.API_TOKEN_REVOKE} data-chaos-exclude>{t('revoke')}</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
