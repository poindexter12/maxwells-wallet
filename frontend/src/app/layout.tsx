import type { Metadata } from 'next'
import Link from 'next/link'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
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
        <nav className="nav-container">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link href="/" className="nav-brand flex items-center px-2 gap-2">
                  <img src="/favicon.svg" alt="" className="w-6 h-6" />
                  Maxwell&apos;s Wallet
                </Link>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-6">
                  <Link href="/" className="nav-link inline-flex items-center px-1 pt-1">
                    Dashboard
                  </Link>
                  <Link href="/transactions" className="nav-link inline-flex items-center px-1 pt-1">
                    Transactions
                  </Link>
                  <Link href="/budgets" className="nav-link inline-flex items-center px-1 pt-1">
                    Budgets
                  </Link>
                  <Link href="/organize" className="nav-link inline-flex items-center px-1 pt-1">
                    Organize
                  </Link>
                  <Link href="/tools" className="nav-link inline-flex items-center px-1 pt-1">
                    Tools
                  </Link>
                  <Link href="/admin" className="nav-link inline-flex items-center px-1 pt-1">
                    Admin
                  </Link>
                </div>
              </div>
              <div className="flex items-center">
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
