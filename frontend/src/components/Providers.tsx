'use client'

import { ReactNode, useEffect, useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { DashboardProvider } from '@/contexts/DashboardContext'
import { defaultLocale, Locale, isValidLocale } from '@/i18n'

// Dynamic message loader
async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  try {
    return (await import(`@/messages/${locale}.json`)).default
  } catch {
    // Fallback to default locale if message file not found
    console.warn(`Messages for locale "${locale}" not found, falling back to ${defaultLocale}`)
    return (await import(`@/messages/${defaultLocale}.json`)).default
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    async function initLocale() {
      try {
        // Fetch effective locale from settings API
        const res = await fetch('/api/v1/settings')
        if (res.ok) {
          const data = await res.json()
          const effectiveLocale = data.effective_locale || defaultLocale

          // Validate and set locale
          if (isValidLocale(effectiveLocale)) {
            setLocale(effectiveLocale)
          }
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
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DashboardProvider>
        {children}
      </DashboardProvider>
    </NextIntlClientProvider>
  )
}
