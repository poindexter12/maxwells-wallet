import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import '../globals.css'

export const metadata: Metadata = {
  title: "Maxwell's Wallet - Login",
  description: 'Sign in to your personal finance tracker.',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="ledger" suppressHydrationWarning>
      <body className="bg-theme min-h-screen flex items-center justify-center">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
