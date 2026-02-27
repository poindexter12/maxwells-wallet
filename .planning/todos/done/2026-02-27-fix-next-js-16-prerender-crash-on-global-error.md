---
created: 2026-02-27T15:30:00.000Z
title: Fix Next.js 16 prerender crash on global-error
area: frontend
files:
  - frontend/src/app/(main)/layout.tsx
  - frontend/src/app/(auth)/layout.tsx
  - frontend/next.config.js
---

## Problem

`next build` fails with `TypeError: Cannot read properties of null (reading 'useContext')` when prerendering `/_global-error`. Next.js 16 force-prerenders this internal page through one of the route group layouts, both of which use `next-intl`'s `NextIntlClientProvider` (via `ProtectedProviders`/`Providers`). The provider crashes during SSR because there's no React context tree during static generation.

This was hidden until the just module `set working-directory` fix (PR #237) — before that, CI never reached the `next build` step.

## Investigation Done

- Adding `export const dynamic = 'force-dynamic'` to layouts doesn't help — `_global-error` ignores route-level config
- Creating custom `global-error.tsx` / `not-found.tsx` doesn't help — Next.js uses its built-in version for `_global-error` prerender
- Creating a root `layout.tsx` and removing `<html>`/`<body>` from group layouts doesn't help — same error
- `experimental.prerender: false` is not a valid Next.js config option
- The `M` function in the stack trace is Next.js internals (`next/dist/esm`), not user code

## Likely Solution Approaches

1. **Root layout refactor**: Create root `layout.tsx` with `<html>`/`<body>`, move providers into group layouts without `<html>`/`<body>`, AND ensure `global-error.tsx` is a completely standalone component with its own `<html>`/`<body>` that doesn't inherit any layout. May need `next-intl` to be optional/lazy in providers.
2. **Upgrade next-intl**: Check if newer next-intl versions handle SSR prerender gracefully (current: 4.8.3)
3. **next.config.js workaround**: Research Next.js 16-specific config to skip `_global-error` prerendering
4. **File a Next.js issue**: This may be a framework bug with route groups + `_global-error` prerendering
