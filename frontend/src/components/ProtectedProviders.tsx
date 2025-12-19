'use client'

import { ReactNode, useEffect, useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DashboardProvider } from '@/contexts/DashboardContext'
import { DemoModeProvider } from '@/contexts/DemoModeContext'
import { defaultLocale, Locale, isValidLocale } from '@/i18n'
import universal from '@/messages/universal.json'
import { useRouter } from 'next/navigation'

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
  try {
    const localeMessages = (await import(`@/messages/${locale}.json`)).default
    return deepMerge(localeMessages, universal)
  } catch {
    // Fallback to default locale if message file not found
    console.warn(`Messages for locale "${locale}" not found, falling back to ${defaultLocale}`)
    const fallbackMessages = (await import(`@/messages/${defaultLocale}.json`)).default
    return deepMerge(fallbackMessages, universal)
  }
}

function AuthGuardInner({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isInitialized, loading } = useAuth()

  console.log('[AuthGuard] State:', { loading, isInitialized, isAuthenticated })

  useEffect(() => {
    if (!loading) {
      if (!isInitialized) {
        console.log('[AuthGuard] Not initialized, redirecting to /setup')
        router.replace('/setup')
      } else if (!isAuthenticated) {
        console.log('[AuthGuard] Not authenticated, redirecting to /login')
        router.replace('/login')
      }
    }
  }, [loading, isInitialized, isAuthenticated, router])

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  // Don't render protected content until authenticated
  if (!isInitialized || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Redirecting...</div>
      </div>
    )
  }

  return <>{children}</>
}

export function ProtectedProviders({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [demoMessage, setDemoMessage] = useState<string | null>(null)

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
        <AuthGuardInner>
          <DemoModeProvider isDemoMode={demoMode} message={demoMessage}>
            <DashboardProvider>
              {children}
            </DashboardProvider>
          </DemoModeProvider>
        </AuthGuardInner>
      </NextIntlClientProvider>
    </AuthProvider>
  )
}
