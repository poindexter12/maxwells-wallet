---
name: typescript
description: Use when editing TypeScript 6 frontend or shared code, especially types, API contracts, server actions, and error handling.
---

- Stay strict: avoid `any` and unsafe `as`; derive types from data (`as const`, `satisfies`) to prevent drift.
- Use discriminated unions for branching; model loading/error states explicitly; narrow errors and promise results.
- Share API contracts in one place; keep frontend/backends in sync via common types.
- Prefer typed fetch/server-action wrappers; avoid duplicating request/response shapes.
- Composition: keep functions pure where possible; pass narrow types; avoid over-broad generics.
- Error handling: define typed error envelopes; log with context; avoid swallowing rejections.
- Tooling: keep ESLint/TypeScript configs aligned with strict settings; favor incremental adoption through localized `satisfies`.
