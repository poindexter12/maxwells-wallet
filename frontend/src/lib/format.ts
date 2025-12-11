/**
 * Get the Intl locale code for a given locale.
 * Maps pseudo locale to en-US for Intl API compatibility.
 */
function getIntlLocale(locale?: string): string {
  if (!locale || locale === 'pseudo') {
    return 'en-US'
  }
  return locale
}

/**
 * Apply pseudo-locale styling to formatted values for i18n testing.
 * Wraps the value in brackets and adds a marker.
 */
function applyPseudoStyling(value: string, locale?: string): string {
  if (locale === 'pseudo') {
    return `[${value}]`
  }
  return value
}

/**
 * Format a number as USD currency with commas
 * @param amount - The amount to format
 * @param showSign - Whether to show +/- sign (default: false)
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted currency string like "$1,234.56" or "+$1,234.56"
 */
export function formatCurrency(amount: number, showSign: boolean = false, locale?: string): string {
  const intlLocale = getIntlLocale(locale)
  const formatted = new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))

  let result: string
  if (showSign) {
    result = amount >= 0 ? `+${formatted}` : `-${formatted}`
  } else {
    result = amount >= 0 ? formatted : `-${formatted}`
  }

  return applyPseudoStyling(result, locale)
}

/**
 * Format a number as USD without the dollar sign (for tables, etc.)
 * @param amount - The amount to format
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted string like "1,234.56"
 */
export function formatAmount(amount: number, locale?: string): string {
  const intlLocale = getIntlLocale(locale)
  const formatted = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return applyPseudoStyling(formatted, locale)
}

/**
 * Format a number as compact currency for chart axes (e.g., "$1k", "$2.5M")
 * @param amount - The amount to format
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted compact string like "$1k" or "$2.5M"
 */
export function formatCompactCurrency(amount: number, locale?: string): string {
  const intlLocale = getIntlLocale(locale)
  const formatted = new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)

  return applyPseudoStyling(formatted, locale)
}

/**
 * Format a date in short format (e.g., "12/31/2024" or locale equivalent)
 * @param date - The date to format
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDateShort(date: Date | string, locale?: string): string {
  const intlLocale = getIntlLocale(locale)
  const d = typeof date === 'string' ? new Date(date) : date
  const formatted = new Intl.DateTimeFormat(intlLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)

  return applyPseudoStyling(formatted, locale)
}

/**
 * Format a date in medium format (e.g., "Dec 31, 2024" or locale equivalent)
 * @param date - The date to format
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDateMedium(date: Date | string, locale?: string): string {
  const intlLocale = getIntlLocale(locale)
  const d = typeof date === 'string' ? new Date(date) : date
  const formatted = new Intl.DateTimeFormat(intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)

  return applyPseudoStyling(formatted, locale)
}

/**
 * Format a date with time (e.g., "Dec 31, 2024 14:30" or locale equivalent)
 * @param date - The date to format
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted date-time string
 */
export function formatDateTime(date: Date | string, locale?: string): string {
  const intlLocale = getIntlLocale(locale)
  const d = typeof date === 'string' ? new Date(date) : date
  const formatted = new Intl.DateTimeFormat(intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

  return applyPseudoStyling(formatted, locale)
}

/**
 * Format a date range (e.g., "Dec 1 - Dec 31, 2024")
 * @param start - Start date
 * @param end - End date
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted date range string
 */
export function formatDateRange(start: Date | string, end: Date | string, locale?: string): string {
  const intlLocale = getIntlLocale(locale)
  const startDate = typeof start === 'string' ? new Date(start) : start
  const endDate = typeof end === 'string' ? new Date(end) : end

  // Use Intl.DateTimeFormat range formatting if available
  try {
    const formatter = new Intl.DateTimeFormat(intlLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    const formatted = formatter.formatRange(startDate, endDate)
    return applyPseudoStyling(formatted, locale)
  } catch {
    // Fallback for older browsers
    const startFormatted = formatDateMedium(startDate, locale)
    const endFormatted = formatDateMedium(endDate, locale)
    return `${startFormatted} - ${endFormatted}`
  }
}

/**
 * Format a date as month and day only (e.g., "Dec 31")
 * @param date - The date to format
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Formatted month-day string
 */
export function formatMonthDay(date: Date | string, locale?: string): string {
  const intlLocale = getIntlLocale(locale)
  const d = typeof date === 'string' ? new Date(date) : date
  const formatted = new Intl.DateTimeFormat(intlLocale, {
    month: 'short',
    day: 'numeric',
  }).format(d)

  return applyPseudoStyling(formatted, locale)
}

/**
 * Get short weekday names for the locale (e.g., ["Mon", "Tue", ...])
 * Returns weekdays starting from Monday (index 0 = Monday)
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns Array of 7 short weekday names starting from Monday
 */
export function getShortWeekdays(locale?: string): string[] {
  const intlLocale = getIntlLocale(locale)
  const formatter = new Intl.DateTimeFormat(intlLocale, { weekday: 'short' })

  // Generate weekdays starting from Monday (Jan 6, 2025 is a Monday)
  const weekdays: string[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(2025, 0, 6 + i) // Jan 6-12, 2025 = Mon-Sun
    const formatted = formatter.format(date)
    weekdays.push(locale === 'pseudo' ? `[${formatted}]` : formatted)
  }

  return weekdays
}
