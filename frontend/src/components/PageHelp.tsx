'use client'

import { useState, useEffect, ReactNode } from 'react'

interface PageHelpProps {
  pageId: string  // Unique ID for localStorage persistence
  title: string
  description: string
  steps?: string[]
  tips?: string[]
  children?: ReactNode  // For custom content
}

type HelpState = 'first-visit' | 'dismissed' | 'minimized'

export function PageHelp({
  pageId,
  title,
  description,
  steps,
  tips,
  children,
}: PageHelpProps) {
  const [helpState, setHelpState] = useState<HelpState>('first-visit')
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`pagehelp-${pageId}`)
    if (saved === 'dismissed' || saved === 'minimized') {
      setHelpState(saved as HelpState)
      setIsExpanded(false)
    } else {
      // First visit - show expanded
      setHelpState('first-visit')
      setIsExpanded(true)
    }
    setHasLoaded(true)
  }, [pageId])

  // Handle dismissal - after first dismissal, switch to minimized mode
  function handleDismiss() {
    setIsExpanded(false)
    if (helpState === 'first-visit') {
      setHelpState('dismissed')
      localStorage.setItem(`pagehelp-${pageId}`, 'dismissed')
    }
  }

  // Handle toggle for minimized state
  function handleToggle() {
    if (helpState === 'dismissed' || helpState === 'minimized') {
      setIsExpanded(!isExpanded)
    } else {
      // First visit - dismissing sets to dismissed
      if (isExpanded) {
        handleDismiss()
      } else {
        setIsExpanded(true)
      }
    }
  }

  // Don't render until we've checked localStorage to avoid flash
  if (!hasLoaded) {
    return null
  }

  // After first dismissal: show minimal icon only
  if (helpState === 'dismissed' && !isExpanded) {
    return (
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-theme-muted hover:text-theme hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
          title="Show help"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Help</span>
        </button>
      </div>
    )
  }

  return (
    <div className="card mb-6 overflow-hidden">
      {/* Header - always visible when panel is shown */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-[var(--color-accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium text-theme">{title}</span>
          {helpState === 'first-visit' && (
            <span className="text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)] px-1.5 py-0.5 rounded">
              New
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {helpState === 'dismissed' && isExpanded && (
            <span
              onClick={(e) => { e.stopPropagation(); setIsExpanded(false) }}
              className="text-xs text-theme-muted hover:text-theme"
            >
              Close
            </span>
          )}
          <svg
            className={`w-5 h-5 text-theme-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible content */}
      <div
        className={`
          transition-all duration-200 ease-in-out
          ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}
        `}
      >
        <div className="px-4 pb-4 space-y-4 border-t border-theme">
          {/* Description */}
          <p className="text-theme-muted pt-3">{description}</p>

          {/* How to use steps */}
          {steps && steps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-theme mb-2">How to use</h4>
              <ul className="space-y-1.5">
                {steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-theme-muted">
                    <span className="text-[var(--color-accent)] mt-0.5">•</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tips */}
          {tips && tips.length > 0 && (
            <div className="bg-theme-subtle rounded-md p-3">
              <h4 className="text-sm font-medium text-theme mb-1.5 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Tips
              </h4>
              <ul className="space-y-1">
                {tips.map((tip, index) => (
                  <li key={index} className="text-sm text-theme-muted">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Custom content */}
          {children}

          {/* Got it button for first visit */}
          {helpState === 'first-visit' && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-sm bg-[var(--color-accent)] text-[var(--color-primary-text)] rounded-md hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Compact inline help for smaller sections
interface InlineHelpProps {
  children: ReactNode
  className?: string
}

export function InlineHelp({ children, className = '' }: InlineHelpProps) {
  return (
    <div className={`flex items-start gap-2 p-3 rounded-md bg-theme-subtle text-sm text-theme-muted ${className}`}>
      <svg
        className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
      <div>{children}</div>
    </div>
  )
}
