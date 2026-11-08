---
description: pseudo.json is generated, so regenerate it before trusting locale key-mismatch failures
paths:
  - "frontend/src/messages/**"
  - "frontend/src/**/*.test.ts"
  - "frontend/src/**/*.test.tsx"
priority: 50
---
`frontend/src/messages/pseudo.json` is generated and untracked (CI builds it; see commit c7c0c7a).
A local copy goes stale whenever `en-US.json` changes. When a locale-completeness test fails on
"extra keys in pseudo.json" or "missing keys", run `just i18n::pseudo` and rerun before treating it
as a regression. Never commit `pseudo.json`, and never hand-edit any locale except `en-US.json`.
