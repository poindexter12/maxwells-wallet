'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * AuthGuard component that protects routes requiring authentication.
 * Redirects to /setup if app is not initialized, or /login if not authenticated.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const { isAuthenticated, isInitialized, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (!isInitialized) {
        router.replace('/setup')
      } else if (!isAuthenticated) {
        router.replace('/login')
      }
    }
  }, [loading, isInitialized, isAuthenticated, router])

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  // Don't render protected content until authenticated
  if (!isInitialized || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Redirecting...</div>
      </div>
    )
  }

  return <>{children}</>
}
