import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js middleware for:
 * 1. Fresh install redirect (no users → /setup)
 * 2. Per-request CSP nonce generation
 *
 * Auth beyond fresh-install detection is handled client-side because existing
 * installs store tokens in localStorage, which middleware cannot access.
 */

// Routes that skip middleware entirely (static assets, api, metadata files)
const BYPASS_ROUTES = ['/api', '/_next', '/favicon.ico', '/icon.svg', '/robots.txt', '/sitemap.xml']

function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production'
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}'`
    : `'self' 'nonce-${nonce}' 'unsafe-eval'`

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes, static assets, etc.
  if (BYPASS_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Generate per-request nonce for CSP
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
  const csp = buildCsp(nonce)

  // Pass nonce to server components via request header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  // Already on setup page — serve with CSP
  if (pathname === '/setup') {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', csp)
    return response
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
        const response = NextResponse.redirect(new URL('/setup', request.url))
        response.headers.set('Content-Security-Policy', csp)
        return response
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
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
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
     * - robots.txt, sitemap.xml (metadata files served directly)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)',
  ],
}
