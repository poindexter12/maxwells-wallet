'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getAuthHeadersFromStorage } from '@/contexts/AuthContext'

export function PasswordChangeTab() {
  const t = useTranslations('auth.changePassword')
  const tCommon = useTranslations('common')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }

    // Validate password length
    if (newPassword.length < 4) {
      setError(t('passwordTooShort'))
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/v1/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeadersFromStorage()
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })

      if (!res.ok) {
        const data = await res.json()
        const errorCode = data.detail?.error_code
        if (errorCode === 'INVALID_PASSWORD') {
          setError(t('currentPassword') + ' is incorrect')
        } else {
          setError(data.detail?.message || 'Failed to change password')
        }
        return
      }

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6 max-w-md">
      <h2 className="text-lg font-semibold text-theme mb-4">{t('title')}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-md text-sm">
            {t('success')}
          </div>
        )}

        <div>
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium text-theme mb-1"
          >
            {t('currentPassword')}
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input w-full"
            data-testid="change-password-current"
          />
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-theme mb-1"
          >
            {t('newPassword')}
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="input w-full"
            data-testid="change-password-new"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-theme mb-1"
          >
            {t('confirmPassword')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="input w-full"
            data-testid="change-password-confirm"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          className="btn-primary w-full"
          data-testid="change-password-submit"
        >
          {saving ? tCommon('loading') : t('submit')}
        </button>
      </form>
    </div>
  )
}
