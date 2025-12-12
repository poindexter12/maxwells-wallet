'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid } from 'date-fns'
import {
  enUS,
  enGB,
  es,
  fr,
  it,
  pt,
  de,
  nl,
} from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns'

// Map app locales to date-fns locales
const dateFnsLocales: Record<string, DateFnsLocale> = {
  'en-US': enUS,
  'en-GB': enGB,
  'es-ES': es,
  'fr-FR': fr,
  'it-IT': it,
  'pt-PT': pt,
  'de-DE': de,
  'nl-NL': nl,
  'pseudo': enUS, // Fallback for pseudo locale
}

// Locale-specific date format patterns
const dateFormats: Record<string, string> = {
  'en-US': 'MM/dd/yyyy',
  'en-GB': 'dd/MM/yyyy',
  'es-ES': 'dd/MM/yyyy',
  'fr-FR': 'dd/MM/yyyy',
  'it-IT': 'dd/MM/yyyy',
  'pt-PT': 'dd/MM/yyyy',
  'de-DE': 'dd.MM.yyyy',
  'nl-NL': 'dd-MM-yyyy',
  'pseudo': 'MM/dd/yyyy',
}

interface DatePickerProps {
  /** Current value in YYYY-MM-DD format */
  value: string
  /** Called with YYYY-MM-DD format when date changes */
  onChange: (value: string) => void
  /** Input placeholder when empty */
  placeholder?: string
  /** Additional CSS classes for the input */
  className?: string
  /** data-testid attribute */
  'data-testid'?: string
  /** data-chaos-target attribute */
  'data-chaos-target'?: string
  /** Title/tooltip for the input */
  title?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className = '',
  'data-testid': testId,
  'data-chaos-target': chaosTarget,
  title,
}: DatePickerProps) {
  const locale = useLocale()
  const t = useTranslations('datePicker')
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const dateFnsLocale = dateFnsLocales[locale] || enUS
  const dateFormat = dateFormats[locale] || 'MM/dd/yyyy'

  // Convert YYYY-MM-DD to Date object
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const validSelectedDate = selectedDate && isValid(selectedDate) ? selectedDate : undefined

  // Update input value when external value changes
  useEffect(() => {
    if (validSelectedDate) {
      setInputValue(format(validSelectedDate, dateFormat, { locale: dateFnsLocale }))
    } else {
      setInputValue('')
    }
  }, [value, dateFormat, dateFnsLocale, validSelectedDate])

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.focus()
    } else if (e.key === 'Enter' && !isOpen) {
      setIsOpen(true)
    }
  }, [isOpen])

  // Handle input text changes (manual typing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Try to parse the input as a date
    if (newValue === '') {
      onChange('')
    } else {
      const parsed = parse(newValue, dateFormat, new Date())
      if (isValid(parsed)) {
        onChange(format(parsed, 'yyyy-MM-dd'))
      }
    }
  }

  // Handle input blur (validate on blur)
  const handleInputBlur = () => {
    if (inputValue === '') {
      onChange('')
    } else {
      const parsed = parse(inputValue, dateFormat, new Date())
      if (isValid(parsed)) {
        onChange(format(parsed, 'yyyy-MM-dd'))
        setInputValue(format(parsed, dateFormat, { locale: dateFnsLocale }))
      } else if (validSelectedDate) {
        // Reset to valid date if input is invalid
        setInputValue(format(validSelectedDate, dateFormat, { locale: dateFnsLocale }))
      } else {
        setInputValue('')
        onChange('')
      }
    }
  }

  // Handle date selection from picker
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
      setInputValue(format(date, dateFormat, { locale: dateFnsLocale }))
    } else {
      onChange('')
      setInputValue('')
    }
    setIsOpen(false)
    inputRef.current?.focus()
  }

  // Clear button handler
  const handleClear = () => {
    onChange('')
    setInputValue('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative inline-block" onKeyDown={handleKeyDown}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || dateFormat.toLowerCase()}
          className={`${className} pr-8`}
          data-testid={testId}
          data-chaos-target={chaosTarget}
          title={title}
          aria-label={title || placeholder}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('clear', { defaultValue: 'Clear date' })}
          >
            ×
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          aria-label={t('openCalendar', { defaultValue: 'Open calendar' })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2"
          role="dialog"
          aria-label={t('selectDate', { defaultValue: 'Select date' })}
        >
          <DayPicker
            mode="single"
            selected={validSelectedDate}
            onSelect={handleSelect}
            locale={dateFnsLocale}
            showOutsideDays
            classNames={{
              root: 'text-sm',
              months: 'flex flex-col',
              month: 'space-y-2',
              caption: 'flex justify-center relative items-center h-8',
              caption_label: 'text-sm font-medium text-gray-900 dark:text-gray-100',
              nav: 'flex items-center gap-1',
              nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700',
              nav_button_previous: 'absolute left-1',
              nav_button_next: 'absolute right-1',
              table: 'w-full border-collapse',
              head_row: 'flex',
              head_cell: 'text-gray-500 dark:text-gray-400 w-8 font-normal text-xs',
              row: 'flex w-full mt-1',
              cell: 'text-center text-sm p-0 relative focus-within:z-20',
              day: 'h-8 w-8 p-0 font-normal inline-flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
              day_selected: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
              day_today: 'text-blue-600 dark:text-blue-400 font-semibold',
              day_outside: 'text-gray-300 dark:text-gray-600 opacity-50',
              day_disabled: 'text-gray-300 dark:text-gray-600',
              day_hidden: 'invisible',
            }}
          />
        </div>
      )}
    </div>
  )
}
