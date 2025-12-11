'use client'

import { useLocale } from 'next-intl'
import {
  formatCurrency as baseCurrency,
  formatAmount as baseAmount,
  formatCompactCurrency as baseCompactCurrency,
  formatDateShort as baseDateShort,
  formatDateMedium as baseDateMedium,
  formatDateTime as baseDateTime,
  formatDateRange as baseDateRange,
  formatMonthDay as baseMonthDay,
  getShortWeekdays as baseWeekdays,
} from '@/lib/format'

/**
 * Hook that provides locale-aware formatting functions.
 * Uses the current locale from next-intl to format currencies, amounts, and dates.
 */
export function useFormat() {
  const locale = useLocale()

  return {
    /**
     * Format a number as USD currency with commas
     * @param amount - The amount to format
     * @param showSign - Whether to show +/- sign (default: false)
     * @returns Formatted currency string like "$1,234.56" or "+$1,234.56"
     */
    formatCurrency: (amount: number, showSign: boolean = false) =>
      baseCurrency(amount, showSign, locale),

    /**
     * Format a number as USD without the dollar sign (for tables, etc.)
     * @param amount - The amount to format
     * @returns Formatted string like "1,234.56"
     */
    formatAmount: (amount: number) =>
      baseAmount(amount, locale),

    /**
     * Format a number as compact currency for chart axes (e.g., "$1k", "$2.5M")
     * @param amount - The amount to format
     * @returns Formatted compact string like "$1k" or "$2.5M"
     */
    formatCompactCurrency: (amount: number) =>
      baseCompactCurrency(amount, locale),

    /**
     * Format a date in short format (e.g., "12/31/2024")
     * @param date - The date to format
     * @returns Formatted date string
     */
    formatDateShort: (date: Date | string) =>
      baseDateShort(date, locale),

    /**
     * Format a date in medium format (e.g., "Dec 31, 2024")
     * @param date - The date to format
     * @returns Formatted date string
     */
    formatDateMedium: (date: Date | string) =>
      baseDateMedium(date, locale),

    /**
     * Format a date with time (e.g., "Dec 31, 2024 14:30")
     * @param date - The date to format
     * @returns Formatted date-time string
     */
    formatDateTime: (date: Date | string) =>
      baseDateTime(date, locale),

    /**
     * Format a date range (e.g., "Dec 1 - Dec 31, 2024")
     * @param start - Start date
     * @param end - End date
     * @returns Formatted date range string
     */
    formatDateRange: (start: Date | string, end: Date | string) =>
      baseDateRange(start, end, locale),

    /**
     * Format a date as month and day only (e.g., "Dec 31")
     * @param date - The date to format
     * @returns Formatted month-day string
     */
    formatMonthDay: (date: Date | string) =>
      baseMonthDay(date, locale),

    /**
     * Get short weekday names for the current locale (e.g., ["Mon", "Tue", ...])
     * @returns Array of 7 short weekday names starting from Monday
     */
    getShortWeekdays: () => baseWeekdays(locale),

    /**
     * The current locale
     */
    locale,
  }
}
