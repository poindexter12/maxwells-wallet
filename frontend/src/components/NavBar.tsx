'use client'

import Link from 'next/link'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { DashboardSelector } from '@/components/DashboardSelector'
import { usePathname } from 'next/navigation'

export function NavBar() {
  const pathname = usePathname()
  const isDashboard = pathname === '/' || pathname.startsWith('/dashboard')

  return (
    <nav className="nav-container">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="nav-brand flex items-center px-2 gap-2">
              <img src="/favicon.svg" alt="" className="w-6 h-6" />
              Maxwell&apos;s Wallet
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-6 sm:items-center">
              {/* Dashboard selector (only show on dashboard pages or always) */}
              <DashboardSelector />
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
  )
}
