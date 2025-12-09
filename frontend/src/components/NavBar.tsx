'use client'

import Link from 'next/link'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { usePathname } from 'next/navigation'

export function NavBar() {
  const pathname = usePathname()

  // Helper to determine if a link is active
  function isActive(href: string): boolean {
    if (href === '/') {
      return pathname === '/' || pathname.startsWith('/dashboard')
    }
    return pathname.startsWith(href)
  }

  function linkClass(href: string): string {
    const base = 'nav-link inline-flex items-center px-1 pt-1'
    return isActive(href) ? `${base} nav-link-active` : base
  }

  return (
    <nav className="nav-container">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="nav-brand flex items-center px-2 gap-2" data-chaos-target="nav-home">
              <img src="/favicon.svg" alt="" className="w-6 h-6" />
              Maxwell&apos;s Wallet
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-6 sm:items-center">
              <Link href="/" className={linkClass('/')} data-chaos-target="nav-dashboard">
                Dashboard
              </Link>
              <Link href="/transactions" className={linkClass('/transactions')} data-chaos-target="nav-transactions">
                Transactions
              </Link>
              <Link href="/budgets" className={linkClass('/budgets')} data-chaos-target="nav-budgets">
                Budgets
              </Link>
              <Link href="/organize" className={linkClass('/organize')} data-chaos-target="nav-organize">
                Organize
              </Link>
              <Link href="/tools" className={linkClass('/tools')} data-chaos-target="nav-tools">
                Tools
              </Link>
              <Link href="/admin" className={linkClass('/admin')} data-chaos-target="nav-admin">
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
