'use client'

import { ReactNode, useEffect, useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { AuthProvider } from '@/contexts/AuthContext'
import { DashboardProvider } from '@/contexts/DashboardContext'
import { DemoModeProvider } from '@/contexts/DemoModeContext'
import { defaultLocale, Locale, isValidLocale } from '@/i18n'
import universal from '@/messages/universal.json'
import enUS from '@/messages/en-US.json'

// Deep merge objects (universal strings override locale strings)
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base }
  for (const key of Object.keys(override)) {
    const overrideVal = override[key]
    if (typeof overrideVal === 'object' && overrideVal !== null && !Array.isArray(overrideVal) &&
        typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, overrideVal as Record<string, unknown>)
    } else {
      result[key] = overrideVal
    }
  }
  return result
}

// Dynamic message loader - merges locale messages with universal strings
async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  // The pseudo locale is a QA/test locale where EVERY string must be
  // transformed (accented). Universal strings (e.g. "Tools") are intentionally
  // identical English across real languages, but merging them over pseudo would
  // leave those keys as plain English and defeat the i18n-coverage tests, so we
  // skip the universal merge for pseudo.
  const mergeUniversal = (msgs: Record<string, unknown>) =>
    locale === 'pseudo' ? msgs : deepMerge(msgs, universal)
  // Layer en-US underneath so any key a locale is missing falls back to English
  // at runtime instead of rendering the raw key path. Skip pseudo (it must stay
  // fully transformed for the coverage tests).
  const withEnglishBase = (msgs: Record<string, unknown>) =>
    locale === 'pseudo' ? msgs : deepMerge(enUS as Record<string, unknown>, msgs)
  try {
    const localeMessages = (await import(`@/messages/${locale}.json`)).default
    return mergeUniversal(withEnglishBase(localeMessages))
  } catch {
    // Fallback to default locale if message file not found
    console.warn(`Messages for locale "${locale}" not found, falling back to ${defaultLocale}`)
    const fallbackMessages = (await import(`@/messages/${defaultLocale}.json`)).default
    return mergeUniversal(fallbackMessages)
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [demoMessage, setDemoMessage] = useState<string | null>(null)

  useEffect(() => {
    async function initLocale() {
      // Allow an explicit locale override via localStorage (used by QA / E2E
      // pseudo-locale tests). This takes precedence over the API-resolved
      // locale and is never set in normal production usage.
      const override = typeof window !== 'undefined' ? window.localStorage.getItem('locale') : null
      if (override && isValidLocale(override)) {
        setLocale(override)
      }

      try {
        // Fetch effective locale from settings API
        const res = await fetch('/api/v1/settings')
        if (res.ok) {
          const data = await res.json()
          const effectiveLocale = data.effective_locale || defaultLocale

          // Validate and set locale (skip if a localStorage override is active)
          if (!(override && isValidLocale(override)) && isValidLocale(effectiveLocale)) {
            setLocale(effectiveLocale)
          }

          // Set demo mode state
          setDemoMode(data.demo_mode || false)
          setDemoMessage(data.demo_message || null)
        }
      } catch (error) {
        console.error('Failed to fetch locale settings:', error)
      }
    }
    initLocale()
  }, [])

  useEffect(() => {
    async function loadLocaleMessages() {
      const msgs = await loadMessages(locale)
      setMessages(msgs)
    }
    loadLocaleMessages()
  }, [locale])

  // Show nothing until messages are loaded to prevent hydration mismatch
  if (!messages) {
    return (
      <div className="min-h-screen bg-theme flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <DemoModeProvider isDemoMode={demoMode} message={demoMessage}>
          <DashboardProvider>
            {children}
          </DashboardProvider>
        </DemoModeProvider>
      </NextIntlClientProvider>
    </AuthProvider>
  )
}
