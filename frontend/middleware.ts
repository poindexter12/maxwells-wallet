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
      // Short timeout to prevent blocking page load
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const status = await res.json()

      // ONLY handle fresh install case - redirect to setup if not initialized
      if (!status.initialized) {
        console.log('[Middleware] App not initialized, redirecting to /setup')
        return NextResponse.redirect(new URL('/setup', request.url))
      }
      console.log('[Middleware] App initialized, proceeding to client-side auth')
    } else {
      console.error('[Middleware] Auth status returned non-OK:', res.status)
    }
  } catch (error) {
    // On error (backend down, timeout, etc.), let client-side handle it
    // This prevents blocking the app if backend is temporarily unavailable
    console.error('[Middleware] Auth check failed (backend may be starting):', error)
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
