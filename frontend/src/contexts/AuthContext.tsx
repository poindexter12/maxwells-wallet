'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

export interface User {
  id: number
  username: string
  created_at: string
}

interface AuthStatus {
  initialized: boolean
  authenticated: boolean
}

interface LoginCredentials {
  username: string
  password: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isInitialized: boolean
  loading: boolean
  error: string | null
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => void
  setup: (credentials: LoginCredentials) => Promise<boolean>
  checkAuth: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'auth_token'

// Cookie helpers for middleware access
function setCookie(name: string, value: string, days: number = 7) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  }, [])

  const setToken = useCallback((token: string | null) => {
    if (typeof window === 'undefined') return
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      setCookie(TOKEN_KEY, token) // Also set cookie for middleware
    } else {
      localStorage.removeItem(TOKEN_KEY)
      deleteCookie(TOKEN_KEY) // Also clear cookie
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true)
      const token = getToken()
      console.log('[AuthContext] Checking auth status, hasToken:', !!token)

      // Check status endpoint
      const statusRes = await fetch('/api/v1/auth/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!statusRes.ok) {
        console.error('[AuthContext] Auth status failed:', statusRes.status)
        throw new Error('Failed to check auth status')
      }

      const status: AuthStatus = await statusRes.json()
      console.log('[AuthContext] Auth status:', status)
      setIsInitialized(status.initialized)
      setIsAuthenticated(status.authenticated)

      // If authenticated, fetch user info
      if (status.authenticated && token) {
        const meRes = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (meRes.ok) {
          const userData = await meRes.json()
          setUser(userData)
        } else {
          // Token invalid, clear it
          setToken(null)
          setIsAuthenticated(false)
          setUser(null)
        }
      } else {
        setUser(null)
      }

      setError(null)
    } catch (err) {
      console.error('[AuthContext] Auth check error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      console.log('[AuthContext] Auth check complete')
      setLoading(false)
    }
  }, [getToken, setToken])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  async function login(credentials: LoginCredentials): Promise<boolean> {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })

      if (!res.ok) {
        const data = await res.json()
        const errorCode = data.detail?.error_code || 'LOGIN_FAILED'
        setError(errorCode)
        return false
      }

      const data = await res.json()
      setToken(data.token)
      setUser(data.user)
      setIsAuthenticated(true)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }

  async function setup(credentials: LoginCredentials): Promise<boolean> {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })

      if (!res.ok) {
        const data = await res.json()
        const errorCode = data.detail?.error_code || 'SETUP_FAILED'
        setError(errorCode)
        return false
      }

      const data = await res.json()
      setToken(data.token)
      setUser(data.user)
      setIsAuthenticated(true)
      setIsInitialized(true)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setLoading(false)
    }
  }

  function clearError() {
    setError(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isInitialized,
        loading,
        error,
        login,
        logout,
        setup,
        checkAuth,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Export a function to get auth headers for API calls
export function getAuthHeadersFromStorage(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}
