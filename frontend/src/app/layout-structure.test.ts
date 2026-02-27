/**
 * Structural guards for the App Router layout hierarchy.
 *
 * Next.js 16 + React 19 crash during `next build` prerendering when:
 *  - Route group layouts provide their own <html>/<body> (no root layout)
 *  - NODE_ENV !== 'production' during build (React SSR dispatcher null)
 *  - global-error.tsx is missing (Next.js internal /_global-error prerender fails)
 *
 * These tests catch the invariants that prevent the crash so future
 * refactors don't reintroduce it. See: https://github.com/vercel/next.js/issues/86178
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, resolve } from 'path'

const APP_DIR = resolve(__dirname)
const FRONTEND_DIR = resolve(__dirname, '..', '..')

function readFile(relativePath: string): string {
  return readFileSync(join(APP_DIR, relativePath), 'utf-8')
}

/** Find all route group directories (parenthesized names) under app/ */
function findRouteGroupLayouts(): { group: string; path: string; content: string }[] {
  const entries = readdirSync(APP_DIR, { withFileTypes: true })
  const results: { group: string; path: string; content: string }[] = []

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('(') && entry.name.endsWith(')')) {
      const layoutPath = join(APP_DIR, entry.name, 'layout.tsx')
      if (existsSync(layoutPath)) {
        results.push({
          group: entry.name,
          path: layoutPath,
          content: readFileSync(layoutPath, 'utf-8'),
        })
      }
    }
  }

  return results
}

describe('App Router layout structure', () => {
  it('root layout.tsx exists and provides <html>/<body>', () => {
    const rootLayout = readFile('layout.tsx')
    expect(rootLayout).toContain('<html')
    expect(rootLayout).toContain('<body')
  })

  it('root layout exports force-dynamic to prevent static prerendering', () => {
    const rootLayout = readFile('layout.tsx')
    expect(rootLayout).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/)
  })

  it('route group layouts do NOT contain <html> or <body> tags', () => {
    const groupLayouts = findRouteGroupLayouts()
    expect(groupLayouts.length).toBeGreaterThan(0)

    for (const { group, content } of groupLayouts) {
      expect(content, `${group}/layout.tsx should not contain <html>`).not.toMatch(/<html[\s>]/)
      expect(content, `${group}/layout.tsx should not contain <body>`).not.toMatch(/<body[\s>]/)
    }
  })

  it('global-error.tsx exists and is a client component with its own <html>/<body>', () => {
    const globalError = readFile('global-error.tsx')
    expect(globalError).toContain("'use client'")
    expect(globalError).toContain('<html')
    expect(globalError).toContain('<body')
  })

  it('build script sets NODE_ENV=production', () => {
    const pkg = JSON.parse(readFileSync(join(FRONTEND_DIR, 'package.json'), 'utf-8'))
    expect(pkg.scripts.build).toContain('NODE_ENV=production')
  })
})
