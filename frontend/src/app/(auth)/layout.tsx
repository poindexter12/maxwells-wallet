import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'

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
    <div className="flex items-center justify-center min-h-screen">
      <Providers>
        {children}
      </Providers>
    </div>
  )
}
