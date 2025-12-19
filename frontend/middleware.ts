import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware for authentication redirects.
 *
 * Provides server-side redirect logic as a defensive layer before client-side
 * auth guards kick in. This ensures users see redirects immediately rather
 * than seeing a flash of content or "Redirecting..." message.
 *
 * The middleware checks auth status via the backend API and redirects:
 * - Unauthenticated users on protected routes → /login (or /setup if uninitialized)
 * - Authenticated users on /login or /setup → /
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/setup']

// Routes that should be accessible without auth check (static assets, api, etc.)
const BYPASS_ROUTES = ['/api', '/_next', '/favicon.ico', '/icon.svg']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes, static assets, etc.
  if (BYPASS_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check auth status from backend
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
  let isInitialized = false
  let isAuthenticated = false

  try {
    // Get token from cookie or header
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '')

    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${backendUrl}/api/v1/auth/status`, {
      headers,
      // Short timeout to prevent blocking
      signal: AbortSignal.timeout(3000),
    })

    if (res.ok) {
      const status = await res.json()
      isInitialized = status.initialized
      isAuthenticated = status.authenticated
    }
  } catch (error) {
    // On error (backend down, timeout, etc.), let client-side handle it
    // This prevents blocking the app if backend is temporarily unavailable
    console.error('Middleware auth check failed:', error)
    return NextResponse.next()
  }

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  // If not initialized, redirect to setup (unless already there)
  if (!isInitialized && pathname !== '/setup') {
    return NextResponse.redirect(new URL('/setup', request.url))
  }

  // If initialized but not authenticated, redirect to login (unless on public route)
  if (isInitialized && !isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If authenticated and on login/setup, redirect to home
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except static files
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.svg (favicon files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}
