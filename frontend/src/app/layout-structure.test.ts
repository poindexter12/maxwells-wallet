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
import { readFileSync } from 'fs'
import { resolve } from 'path'

// All paths are hardcoded constants — no dynamic input
const APP_DIR = resolve(__dirname)
const ROOT_LAYOUT = resolve(APP_DIR, 'layout.tsx')
const GLOBAL_ERROR = resolve(APP_DIR, 'global-error.tsx')
const MAIN_LAYOUT = resolve(APP_DIR, '(main)', 'layout.tsx')
const AUTH_LAYOUT = resolve(APP_DIR, '(auth)', 'layout.tsx')
const PACKAGE_JSON = resolve(APP_DIR, '..', '..', 'package.json')

describe('App Router layout structure', () => {
  it('root layout.tsx exists and provides <html>/<body>', () => {
    const content = readFileSync(ROOT_LAYOUT, 'utf-8')
    expect(content).toContain('<html')
    expect(content).toContain('<body')
  })

  it('root layout exports force-dynamic to prevent static prerendering', () => {
    const content = readFileSync(ROOT_LAYOUT, 'utf-8')
    expect(content).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/)
  })

  it('route group layouts do NOT contain <html> or <body> tags', () => {
    for (const { name, path } of [
      { name: '(main)', path: MAIN_LAYOUT },
      { name: '(auth)', path: AUTH_LAYOUT },
    ]) {
      const content = readFileSync(path, 'utf-8')
      expect(content, `${name}/layout.tsx should not contain <html>`).not.toMatch(/<html[\s>]/)
      expect(content, `${name}/layout.tsx should not contain <body>`).not.toMatch(/<body[\s>]/)
    }
  })

  it('global-error.tsx exists and is a client component with its own <html>/<body>', () => {
    const content = readFileSync(GLOBAL_ERROR, 'utf-8')
    expect(content).toContain("'use client'")
    expect(content).toContain('<html')
    expect(content).toContain('<body')
  })

  it('build script sets NODE_ENV=production', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'))
    expect(pkg.scripts.build).toContain('NODE_ENV=production')
  })
})
