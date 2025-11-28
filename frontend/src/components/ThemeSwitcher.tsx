'use client'

import { useEffect, useState } from 'react'
import { ThemeName, themes, defaultTheme } from '@/lib/themes'

const STORAGE_KEY = 'maxwell-wallet-theme'

export function ThemeSwitcher() {
  const [theme, setThemeState] = useState<ThemeName>(defaultTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Load saved theme from localStorage
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null
    if (saved && ['ledger', 'neon', 'soft'].includes(saved)) {
      setThemeState(saved)
      document.documentElement.setAttribute('data-theme', saved)
    } else {
      document.documentElement.setAttribute('data-theme', defaultTheme)
    }
    setMounted(true)
  }, [])

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <select className="theme-switcher" aria-label="Select theme" disabled>
        <option>Theme</option>
      </select>
    )
  }

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as ThemeName)}
      className="theme-switcher"
      aria-label="Select theme"
    >
      {themes.map((t) => (
        <option key={t.name} value={t.name}>
          {t.label}
        </option>
      ))}
    </select>
  )
}
