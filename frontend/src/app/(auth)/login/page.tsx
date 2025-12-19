'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useDemoMode } from '@/contexts/DemoModeContext'
import { TEST_IDS } from '@/test-ids'

export default function LoginPage() {
  const t = useTranslations('auth')
  const tDemo = useTranslations('demo')
  const router = useRouter()
  const { login, isAuthenticated, isInitialized, loading, error, clearError } = useAuth()
  const { isDemoMode } = useDemoMode()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect if not initialized (needs setup)
  useEffect(() => {
    if (!loading && !isInitialized) {
      router.replace('/setup')
    }
  }, [loading, isInitialized, router])

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/')
    }
  }, [loading, isAuthenticated, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setSubmitting(true)

    const success = await login({ username, password })
    if (success) {
      router.replace('/')
    }
    setSubmitting(false)
  }

  // Show loading while checking auth status
  if (loading || isAuthenticated || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">{t('login.title')}...</div>
      </div>
    )
  }

  const errorMessage = error ? t(`errors.${error}` as Parameters<typeof t>[0]) : null

  return (
    <div className="w-full max-w-md px-4">
      {isDemoMode && (
        <div
          data-testid={TEST_IDS.DEMO_BANNER}
          className="bg-amber-500 text-amber-950 px-4 py-3 text-center font-semibold rounded-t-lg shadow-md mb-0"
        >
          <span className="inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {tDemo('loginBanner')}
          </span>
        </div>
      )}
      <div className={`bg-white dark:bg-gray-800 shadow-lg p-8 ${isDemoMode ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('login.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('login.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('login.username')}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
              data-testid={TEST_IDS.LOGIN_USERNAME}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
              data-testid={TEST_IDS.LOGIN_PASSWORD}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md shadow-sm transition-colors"
            data-testid={TEST_IDS.LOGIN_SUBMIT}
          >
            {submitting ? '...' : t('login.submit')}
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {t('login.forgotPassword')}
          </p>
        </form>
      </div>
    </div>
  )
}
