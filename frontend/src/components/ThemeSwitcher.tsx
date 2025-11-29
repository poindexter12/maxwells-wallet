'use client'

import { useEffect, useState } from 'react'
import { ThemeName, themes, defaultTheme } from '@/lib/themes'

const STORAGE_KEY = 'maxwell-wallet-theme'

export function ThemeSwitcher() {
  const [theme, setThemeState] = useState<ThemeName>(defaultTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Load saved theme from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    const validThemes: ThemeName[] = ['ledger', 'dark', 'cyberpunk', 'soft']
    if (saved && validThemes.includes(saved as ThemeName)) {
      setThemeState(saved as ThemeName)
      document.documentElement.setAttribute('data-theme', saved)
    } else if (saved === 'neon') {
      // Migrate old 'neon' theme to 'cyberpunk'
      setThemeState('cyberpunk')
      document.documentElement.setAttribute('data-theme', 'cyberpunk')
      localStorage.setItem(STORAGE_KEY, 'cyberpunk')
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
