import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import { NavBar } from '@/components/NavBar'
import { DemoBanner } from '@/components/DemoBanner'
import './globals.css'

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
        <Providers>
          <DemoBanner />
          <NavBar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
