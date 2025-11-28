/**
 * Format a number as USD currency with commas
 * @param amount - The amount to format
 * @param showSign - Whether to show +/- sign (default: false)
 * @returns Formatted currency string like "$1,234.56" or "+$1,234.56"
 */
export function formatCurrency(amount: number, showSign: boolean = false): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))

  if (showSign) {
    return amount >= 0 ? `+${formatted}` : `-${formatted}`
  }

  return amount >= 0 ? formatted : `-${formatted}`
}

/**
 * Format a number as USD without the dollar sign (for tables, etc.)
 * @param amount - The amount to format
 * @returns Formatted string like "1,234.56"
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
