'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface TooltipProps {
  content: string | ReactNode
  children?: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function Tooltip({ content, children, position = 'top', className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  // Adjust position if tooltip would go off-screen
  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const _triggerRect = triggerRef.current.getBoundingClientRect()

      let newPosition = position

      if (position === 'top' && tooltipRect.top < 0) {
        newPosition = 'bottom'
      } else if (position === 'bottom' && tooltipRect.bottom > window.innerHeight) {
        newPosition = 'top'
      } else if (position === 'left' && tooltipRect.left < 0) {
        newPosition = 'right'
      } else if (position === 'right' && tooltipRect.right > window.innerWidth) {
        newPosition = 'left'
      }

      if (newPosition !== actualPosition) {
        setActualPosition(newPosition)
      }
    }
  }, [isVisible, position, actualPosition])

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--color-text)] border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--color-text)] border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--color-text)] border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--color-text)] border-y-transparent border-l-transparent',
  }

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children || (
        <button
          type="button"
          className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-theme-subtle text-theme-muted hover:text-theme hover:bg-[var(--color-bg-hover)] transition-colors"
          aria-label="Help"
        >
          ?
        </button>
      )}

      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            absolute z-50 px-3 py-2 text-xs
            bg-[var(--color-text)] text-[var(--color-bg)]
            rounded-md shadow-lg
            max-w-xs whitespace-normal
            animate-in fade-in duration-150
            ${positionClasses[actualPosition]}
          `}
        >
          {content}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[actualPosition]}`}
          />
        </div>
      )}
    </div>
  )
}

// Convenience component for help icon with tooltip
interface HelpTipProps {
  content: string | ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function HelpTip({ content, position = 'top', className = '' }: HelpTipProps) {
  return (
    <Tooltip content={content} position={position} className={className} />
  )
}
