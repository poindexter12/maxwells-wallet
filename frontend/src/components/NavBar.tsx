'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.push('/login')
  }

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
              <Image src="/favicon.svg" alt="" width={24} height={24} />
              {t('brand')}
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-6 sm:items-center">
              <Link href="/" className={linkClass('/')} data-chaos-target="nav-dashboard">
                {t('dashboard')}
              </Link>
              <Link href="/transactions" className={linkClass('/transactions')} data-chaos-target="nav-transactions">
                {t('transactions')}
              </Link>
              <Link href="/budgets" className={linkClass('/budgets')} data-chaos-target="nav-budgets">
                {t('budgets')}
              </Link>
              <Link href="/organize" className={linkClass('/organize')} data-chaos-target="nav-organize">
                {t('organize')}
              </Link>
              <Link href="/tools" className={linkClass('/tools')} data-chaos-target="nav-tools">
                {t('tools')}
              </Link>
              <Link href="/admin" className={linkClass('/admin')} data-chaos-target="nav-admin">
                {t('admin')}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
            {user && (
              <button
                onClick={handleLogout}
                className="nav-link px-3 py-1 text-sm hover:text-red-600 dark:hover:text-red-400"
                data-testid="logout-button"
              >
                {tAuth('logout')}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
