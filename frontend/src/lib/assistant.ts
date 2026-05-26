/**
 * API client for the AI assistant.
 *
 * All endpoints require auth; the bearer token is read from storage. The API
 * key is write-only server-side, so it is never returned by these calls.
 */
import { getAuthHeadersFromStorage } from '@/contexts/AuthContext'

const BASE = '/api/v1/assistant'

export interface AssistantConfig {
  provider: string | null
  model: string | null
  configured: boolean
  // How it's configured. Always "env" — keys live only in the server
  // environment, never the database or the browser.
  source: string
  available_providers: string[]
  default_models: Record<string, string>
}

export interface ProposedAction {
  index: number
  tool: string
  summary: string
}

export interface Proposal {
  id: string
  actions: ProposedAction[]
}

export interface ChatResponse {
  conversation_id: string
  reply: string
  proposal: Proposal | null
}

export interface ExecutedAction {
  index: number
  tool: string
  summary: string
  result: Record<string, unknown>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersFromStorage(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let code = `HTTP_${res.status}`
    let message = res.statusText
    try {
      const body = await res.json()
      code = body?.detail?.error_code ?? code
      message = body?.detail?.message ?? message
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(message) as Error & { code?: string; status?: number }
    err.code = code
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export function getAssistantConfig(): Promise<AssistantConfig> {
  return request<AssistantConfig>('/config')
}

export function sendChat(message: string, conversationId: string | null): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId }),
  })
}

export function executeProposal(
  proposalId: string,
  approvedIndices?: number[],
): Promise<{ executed: ExecutedAction[] }> {
  return request<{ executed: ExecutedAction[] }>('/execute', {
    method: 'POST',
    body: JSON.stringify({ proposal_id: proposalId, approved_indices: approvedIndices }),
  })
}
