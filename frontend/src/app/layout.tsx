import type { Metadata } from 'next'
import './globals.css'

// All pages require authentication/runtime data — skip static prerendering
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Maxwell's Wallet - Personal Finance Tracker",
  description: 'Personal finance tracker with CSV import, smart tagging, and spending trend analysis.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="ledger" suppressHydrationWarning>
      <body className="bg-theme min-h-screen">
        {children}
      </body>
    </html>
  )
}
