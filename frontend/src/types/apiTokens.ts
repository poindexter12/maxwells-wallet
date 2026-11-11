export type ApiTokenScope = 'read' | 'write'

export interface ApiToken {
  id: number
  name: string
  token_prefix: string
  scopes: ApiTokenScope[]
  created_at: string
  updated_at: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
}

export interface CreatedApiToken extends ApiToken {
  token: string
}

export interface CreateApiTokenRequest {
  name: string
  scopes: ApiTokenScope[]
  expires_in_days?: number
}
