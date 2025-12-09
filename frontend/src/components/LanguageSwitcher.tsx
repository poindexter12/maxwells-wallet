'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { locales, languageNames, Locale } from '@/i18n'

interface LanguageOption {
  code: string
  label: string
}

// Build language options: "browser" + all locales
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'browser', label: 'Auto' }, // Label will be overridden with translation
  ...locales.map((locale) => ({
    code: locale,
    label: languageNames[locale],
  })),
]

export function LanguageSwitcher() {
  const t = useTranslations('settings')
  const [language, setLanguage] = useState('browser')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Fetch current language preference from settings API
    fetch('/api/v1/settings')
      .then((res) => res.json())
      .then((data) => setLanguage(data.language || 'browser'))
      .catch(console.error)
  }, [])

  const handleChange = async (newLang: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: newLang }),
      })

      if (res.ok) {
        setLanguage(newLang)
        // Reload to apply new locale throughout the app
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to save language preference:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={language}
      onChange={(e) => handleChange(e.target.value)}
      disabled={saving}
      className="select select-ghost select-sm text-sm bg-base-100 border-none focus:outline-none"
      aria-label={t('language')}
      data-testid="language-switcher"
    >
      {LANGUAGE_OPTIONS.map((option) => (
        <option key={option.code} value={option.code}>
          {option.code === 'browser' ? t('browserDefault') : option.label}
        </option>
      ))}
    </select>
  )
}
