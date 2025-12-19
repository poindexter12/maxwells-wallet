import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware for fresh install redirect only.
 *
 * This middleware ONLY handles the fresh install case:
 * - If no users exist (not initialized), redirect to /setup
 *
 * All other auth logic (login redirect, authenticated user redirects) is
 * handled client-side. This is because existing installs store tokens in
 * localStorage, which middleware cannot access. Only new logins after this
 * update will have tokens in cookies.
 *
 * By limiting middleware to fresh install detection, we avoid redirect loops
 * for existing users who have tokens only in localStorage.
 */

// Routes that should be accessible without auth check (static assets, api, etc.)
const BYPASS_ROUTES = ['/api', '/_next', '/favicon.ico', '/icon.svg']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes, static assets, etc.
  if (BYPASS_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Already on setup page, no need to check
  if (pathname === '/setup') {
    return NextResponse.next()
  }

  // Check if app is initialized (any user exists)
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'

  try {
    const res = await fetch(`${backendUrl}/api/v1/auth/status`, {
      // Short timeout to prevent blocking
      signal: AbortSignal.timeout(3000),
    })

    if (res.ok) {
      const status = await res.json()

      // ONLY handle fresh install case - redirect to setup if not initialized
      if (!status.initialized) {
        return NextResponse.redirect(new URL('/setup', request.url))
      }
    }
  } catch (error) {
    // On error (backend down, timeout, etc.), let client-side handle it
    console.error('Middleware auth check failed:', error)
  }

  // For all other cases (initialized app), let client-side handle auth
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
