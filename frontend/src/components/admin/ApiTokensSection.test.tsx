import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiTokensSection } from './ApiTokensSection'
import { CHAOS_EXCLUDED_IDS, TEST_IDS } from '@/test-ids'

const { translate } = vi.hoisted(() => ({
  translate: (key: string) => key,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => translate,
}))

vi.mock('@/contexts/AuthContext', () => ({
  getAuthHeadersFromStorage: () => ({ Authorization: 'Bearer test-token' }),
}))

const activeToken = {
  id: 1,
  name: 'Claude Code',
  token_prefix: 'mw_pat_abc',
  scopes: ['read', 'write'] as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  expires_at: null,
  revoked_at: null,
  last_used_at: null,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mockInitialList(tokens = [activeToken]) {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(tokens))
}

describe('ApiTokensSection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders the token list', async () => {
    mockInitialList()
    render(<ApiTokensSection />)

    await waitFor(() => expect(screen.getByTestId(TEST_IDS.API_TOKENS_LIST)).toHaveTextContent(activeToken.name))
  })

  it('shows a newly created token once and removes it after dismissal', async () => {
    mockInitialList([])
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ...activeToken, token: 'mw_pat_raw_token' }, 201))
    render(<ApiTokensSection />)

    await waitFor(() => expect(screen.getByTestId(TEST_IDS.API_TOKENS_EMPTY)).toBeInTheDocument())
    fireEvent.change(screen.getByTestId(TEST_IDS.API_TOKEN_NAME_INPUT), { target: { value: 'MCP client' } })
    fireEvent.change(screen.getByTestId(TEST_IDS.API_TOKEN_SCOPE_SELECT), { target: { value: 'read-write' } })
    fireEvent.change(screen.getByTestId(TEST_IDS.API_TOKEN_EXPIRY_SELECT), { target: { value: '30' } })
    fireEvent.click(screen.getByTestId(TEST_IDS.API_TOKEN_CREATE_BUTTON))

    await waitFor(() => expect(screen.getByTestId(TEST_IDS.API_TOKEN_VALUE)).toHaveValue('mw_pat_raw_token'))
    expect(screen.getByTestId(TEST_IDS.API_TOKEN_CONNECTION_SNIPPET)).toHaveValue('URL: http://localhost:3000/mcp\nAuthorization: Bearer mw_pat_raw_token')
    expect(vi.mocked(fetch)).toHaveBeenLastCalledWith('/api/v1/auth/tokens', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'MCP client', scopes: ['read', 'write'], expires_in_days: 30 }),
    }))

    fireEvent.click(screen.getByTestId(TEST_IDS.API_TOKEN_DISMISS_BUTTON))
    expect(screen.queryByTestId(TEST_IDS.API_TOKEN_CREATED_NOTICE)).not.toBeInTheDocument()
  })

  it('calls DELETE only after in-page revoke confirmation', async () => {
    mockInitialList()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([{ ...activeToken, revoked_at: '2026-02-01T00:00:00Z' }]))
    render(<ApiTokensSection />)

    await waitFor(() => expect(screen.getByTestId(CHAOS_EXCLUDED_IDS.API_TOKEN_REVOKE)).toBeInTheDocument())
    fireEvent.click(screen.getByTestId(CHAOS_EXCLUDED_IDS.API_TOKEN_REVOKE))
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId(TEST_IDS.API_TOKEN_REVOKE_CONFIRM_BUTTON))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/v1/auth/tokens/1', expect.objectContaining({ method: 'DELETE' })))
  })

  it('surfaces API errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'Token service unavailable' }, 500))
    render(<ApiTokensSection />)

    await waitFor(() => expect(screen.getByTestId(TEST_IDS.API_TOKEN_ERROR)).toHaveTextContent('Token service unavailable'))
  })
})
