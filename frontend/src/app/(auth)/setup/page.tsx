'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'

export default function SetupPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { setup, isAuthenticated, isInitialized, loading, error, clearError } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already initialized
  useEffect(() => {
    if (!loading && isInitialized) {
      router.replace('/login')
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
    setLocalError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setLocalError('passwordMismatch')
      return
    }

    // Validate password length
    if (password.length < 4) {
      setLocalError('passwordTooShort')
      return
    }

    setSubmitting(true)

    const success = await setup({ username, password })
    if (success) {
      router.replace('/')
    }
    setSubmitting(false)
  }

  // Show loading while checking auth status
  if (loading || isAuthenticated || isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">{t('setup.title')}...</div>
      </div>
    )
  }

  const displayError = localError
    ? t(`setup.${localError}` as Parameters<typeof t>[0])
    : error
      ? t(`errors.${error}` as Parameters<typeof t>[0])
      : null

  return (
    <div className="w-full max-w-md px-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('setup.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('setup.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {displayError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {displayError}
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('setup.username')}
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
              data-testid="setup-username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('setup.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
              data-testid="setup-password"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('setup.confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
              data-testid="setup-confirm-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !username || !password || !confirmPassword}
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md shadow-sm transition-colors"
            data-testid="setup-submit"
          >
            {submitting ? '...' : t('setup.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
