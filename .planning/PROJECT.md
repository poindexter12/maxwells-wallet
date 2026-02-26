# Maxwell's Wallet — Project Planning

## What This Is

A full-stack personal finance tracker (Next.js 16 + FastAPI + SQLite/Postgres) with CI-integrated DevSecOps tooling, a healthy well-tested codebase, and a modern mise + Just + gum developer experience. v1.0 shipped five security scanning tools in GitHub Actions. v1.1 addressed all 11 codebase audit concerns. v1.2 replaced Make with Just + gum, managed by mise as the single prerequisite.

## Core Value

A reliable, maintainable personal finance tracker where users can trust their data is accurate and the UI communicates clearly when something goes wrong.

## Requirements

### Validated

- ✓ Dependabot monitors npm, pip, docker, and github-actions ecosystems weekly — existing
- ✓ pip-audit runs nightly against Python dependencies with auto-issue creation — existing
- ✓ GitHub Actions pinned to SHAs for supply chain security — existing
- ✓ CI pipeline with change detection, frontend/backend/e2e/performance/docker jobs — existing
- ✓ Production Dockerfile builds and pushes to GHCR on main — existing
- ✓ SAST scanning via Semgrep on PRs and pushes to main — v1.0
- ✓ Reusable security.yaml workflow callable from ci.yaml and nightly.yaml — v1.0
- ✓ SARIF upload to GitHub Security tab with unique category convention — v1.0
- ✓ SCA dependency scanning via OWASP Dependency-Check on pushes to main — v1.0
- ✓ Repo security posture scoring via OpenSSF Scorecard on pushes to main — v1.0
- ✓ Container image scanning via Trivy against production Dockerfile — v1.0
- ✓ DAST baseline scanning via OWASP ZAP against ephemeral CI app instance — v1.0
- ✓ README documentation of added tooling and output interpretation — v1.0
- ✓ Formal verification artifacts with 3-source traceability for all 28 requirements — v1.0
- ✓ Dashboard page components extracted to dedicated widget files (1,168 → 122 lines) — v1.1
- ✓ Dashboard tab switching crash resolved (stale closures + SWR cache isolation) — v1.1
- ✓ API errors shown to users with toast notifications and retry capability — v1.1
- ✓ TypeScript `any` declarations replaced with typed interfaces (15 types centralized) — v1.1
- ✓ Frontend unit tests for dashboard widgets, transactions, and import pages (93+ tests) — v1.1
- ✓ i18n translation coverage complete with audit script, pseudo-locale E2E, CI validation — v1.1
- ✓ Dashboard data fetching parallelized with SWR caching per dashboard ID — v1.1
- ✓ Report queries verified free of N+1 patterns via SQLAlchemy query logging — v1.1
- ✓ All datetimes UTC-aware with DateTime(timezone=True) — v1.1
- ✓ Budget amount and tag due_day input validation enforced (Pydantic + DB constraints) — v1.1
- ✓ CORS origins configurable via CORS_ORIGINS environment variable — v1.1
- ✓ Transactions page extracted (1,323 → 490 lines) — v1.1
- ✓ React ErrorBoundary catches rendering crashes with recovery UI — v1.1
- ✓ i18n test suite enabled and passing in CI — v1.1
- ✓ mise manages all dev tooling (just, gum, node, python, uv) from .mise.toml — v1.2
- ✓ mise auto-installs correct tool versions on cd into project directory — v1.2
- ✓ Secrets loaded via mise [env] from gitignored .env file — v1.2
- ✓ 82 just recipes across 7 modules replacing all Make targets — v1.2
- ✓ gum-powered terminal UX with TTY detection and CI fallback — v1.2
- ✓ CI workflows migrated to mise-action + just recipes (7 workflows) — v1.2
- ✓ Devcontainer uses mise feature for tool management — v1.2
- ✓ All documentation updated to reference just exclusively (25+ files) — v1.2
- ✓ Deprecated Make build system removed (Makefile + 7 .mk modules + .nvmrc + .python-version) — v1.2

### Active

- [ ] Replace Make with Just as the project task runner
- [ ] Use gum for beautiful, interactive terminal output in all recipes
- [ ] Use mise as the single toolchain manager (just, gum, node, python, uv)
- [ ] Migrate .envrc secrets to mise [env] with .env file
- [ ] Clean break from Make — delete Makefile and make/ entirely
- [ ] Update CLAUDE.md and README to reflect new toolchain

### Out of Scope

- DefectDojo or any centralized findings dashboard — defer until multiple projects need aggregation
- Rule tuning or false positive suppression — evaluate raw output first (v2 candidate: DAST-V2-03)
- Build gates or merge blocking on findings — informational only (v2 candidate: PIPE-V2-02)
- Mobile or desktop scanning tools — web app only
- Replacing existing Dependabot/pip-audit — additive, not substitutive
- Authenticated ZAP scanning — requires session/JWT configuration (v2 candidate: DAST-V2-01)
- Active ZAP scanning — deeper detection but slower/riskier (v2 candidate: DAST-V2-02)
- SBOM generation — CycloneDX/SPDX format (v2 candidate: CNTR-V2-01)
- Custom Semgrep rules — project-specific patterns (v2 candidate: SAST-V2-01)
- Offline-first capability — requires service worker + CRDT, too much scope currently
- Audit trail / transaction edit history — multi-user feature, single-user app doesn't need yet
- Postgres migration — timezone fix and validation constraints prepared for it, migration itself deferred
- CSV streaming parser — <10MB typical files, streaming deferred until scale demands
- Rate limiting — single-user local deployment, not urgent
- mise tasks replacing just — mise tasks less mature for complex workflows
- Windows support — macOS (primary) + Linux (devcontainer) only

## Context

## Current Milestone: v1.2 Build System Modernization

**Goal:** Replace Make with Just + gum for a modern, beautiful task runner experience, with mise as the single prerequisite managing all dev tooling.

**Target features:**
- Just as task runner (replacing Makefile + 7 modular .mk files)
- gum for sexy interactive terminal output (replacing raw ANSI escape codes)
- mise as sole prerequisite — manages just, gum, node, python, uv
- mise [env] for secrets (replacing .envrc/direnv)
- Clean break — Makefile and make/ directory deleted
- Updated docs (CLAUDE.md, README, devcontainer)

**Shipped milestones:**
- v1.0 DevSecOps Tooling (2026-02-23): 6 phases, 7 plans, 33 files, 5 security scanners in CI
- v1.1 Codebase Health (2026-02-26): 5 phases, 12 plans, 75 files, all 11 audit concerns addressed
- v1.2 Build System Modernization (2026-02-27): 5 phases, 8 plans, 89 files, Make → Just + gum + mise

**App tech stack:** Next.js 16 (App Router, TypeScript), FastAPI (async Python), SQLite (dev) with SQLModel ORM, Alembic migrations, next-intl (9 locales), SWR for data fetching, sonner for toast notifications.

**Dev tooling (post v1.2):**
- mise manages all dev tools: node 22, python 3.11, uv, just, gum
- 82 just recipes across 7 modules (.just/*.just): dev, db, test, docker, release, i18n, utils
- gum-helpers.sh provides TTY-aware styled output with CI fallback
- Secrets in gitignored .env loaded via mise [env] section

**Codebase state (post v1.2):**
- Dashboard page.tsx: 122 lines (from 1,168) with 10 extracted widget components
- Transactions page.tsx: 490 lines (from 1,323) with extracted filters, bulk actions, data hook
- Error handling: React ErrorBoundary + sonner toasts + SWR retry on all 9 widget hooks
- Type safety: 15 typed interfaces in centralized types.ts, zero `useState<any>`
- Frontend tests: 93+ unit tests for widgets, transactions, import workflows
- i18n: audit script, pseudo-locale E2E, 30+ translation keys, CI validation
- Backend: UTC-aware datetimes, Pydantic + DB constraint validation, configurable CORS
- All datetimes are timezone-aware (Postgres migration ready)
- 1,153 backend tests, 336+ frontend tests

**DevSecOps (v1.0) — still operational:**
- SARIF categories: semgrep, dependency-check, scorecard, trivy-container, zap
- ZAP limitations: public pages only, frontend only, ~50-200 findings before tuning

## Constraints

- **No build gates:** All findings must be informational only. No workflow should cause PR checks or pushes to fail based on security findings.
- **GitHub Actions only:** All tooling runs within GitHub Actions workflows — no external CI systems.
- **SHA-pinned Actions:** All third-party Actions must be pinned to commit SHAs (existing convention in this repo).
- **Ephemeral DAST:** ZAP scans must use an ephemeral Docker Compose environment spun up in CI — no dependency on persistent infrastructure.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Semgrep `auto` ruleset | Auto-detects languages and applies relevant community rules — good starting point before custom rules | ✓ Shipped v1.0 |
| Native Semgrep Docker container | Direct control over CLI flags; semgrep-action wrapper deprecated | ✓ Shipped v1.0 |
| Reusable security.yaml workflow | Single definition called by ci.yaml and nightly.yaml; DRY pattern for adding tools | ✓ Shipped v1.0 |
| OWASP Dep-Check alongside Dependabot | Different databases (NVD vs GitHub Advisory) catch different vulnerabilities — additive coverage | ✓ Shipped v1.0 |
| NVD database caching (24h TTL) | Avoids rate limiting, reduces scan time; optional API key for faster updates | ✓ Shipped v1.0 |
| Isolated Scorecard workflow | OpenSSF API requires strict validation (no env/defaults blocks); separate workflow simpler than shared | ✓ Shipped v1.0 |
| Trivy for container scanning | Lightweight, well-maintained, covers OS packages + app dependencies in container images | ✓ Shipped v1.0 |
| Trivy before buildx (scans all builds) | Positioned before conditional buildx setup so PRs get scanned too, not just main | ✓ Shipped v1.0 |
| ZAP baseline (passive) scan | Passive scan is safe, fast, and doesn't require auth configuration — good first pass | ✓ Shipped v1.0 |
| ZAP on main only | DAST is slow; running only on main prevents PR pipeline slowdown | ✓ Shipped v1.0 |
| Cut DefectDojo from milestone | Overhead of standing up Django + Postgres + Celery not justified until multiple projects need aggregation | ✓ Good |
| Non-blocking execution (all tools) | Security findings should inform but not block development; visibility in Security tab sufficient | ✓ Shipped v1.0 |
| Job-level permissions | Least privilege — only security jobs get security-events: write, not all jobs | ✓ Shipped v1.0 |
| 3-source verification pattern | VERIFICATION.md + SUMMARY.md + REQUIREMENTS.md provides audit-ready traceability | ✓ Shipped v1.0 |
| SWR for widget data fetching | Automatic request deduplication, caching, revalidation; better than manual fetch/useState | ✓ Shipped v1.1 |
| Sonner for toast notifications | Battle-tested library with good DX and accessibility; avoids building custom toast system | ✓ Shipped v1.1 |
| Functional state updates in DashboardContext | Prevents stale closures when async operations complete after state has changed | ✓ Shipped v1.1 |
| Dashboard ID in SWR cache keys | Isolates cached widget data per dashboard — prevents cross-contamination during tab switches | ✓ Shipped v1.1 |
| Dual-layer validation (Pydantic + DB) | Pydantic catches invalid requests early; DB constraints prevent bad data even if bypassing API | ✓ Shipped v1.1 |
| DateTime(timezone=True) for all columns | Prevents timezone-related data corruption during SQLite → Postgres migration | ✓ Shipped v1.1 |
| Regex-based i18n audit (not AST) | Simpler and faster; may produce false positives but good enough for development-time auditing | ✓ Shipped v1.1 |
| Simplified async hook tests | Focus on API surface rather than deep async integration testing; timing-sensitive tests deferred to E2E | ⚠️ Tech debt |
| mise as single tool version manager | Replaces nvm + pyenv + direnv with single declarative .mise.toml; auto-installs on cd | ✓ Shipped v1.2 |
| aqua backend for just/gum (not cargo) | cargo backend requires Rust toolchain; aqua downloads pre-built binaries (faster, no Rust dependency) | ✓ Shipped v1.2 |
| just as task runner (replaces Make) | Better UX (doc comments, modules, parameters), no tab/space gotchas, gum integration | ✓ Shipped v1.2 |
| gum for terminal UX | TTY-aware styled output with CI fallback; replaces raw ANSI escape codes | ✓ Shipped v1.2 |
| Shebang recipe pattern | Every multi-line recipe uses #!/usr/bin/env bash + set -euo pipefail + source gum-helpers.sh | ✓ Shipped v1.2 |
| Test recipes stream output directly | Users need to see pytest/lint output in real-time; no gum spin wrapper | ✓ Shipped v1.2 |
| Clean break from Make | Delete Makefile and make/ entirely; no backward-compat wrapper or deprecation period | ✓ Shipped v1.2 |
| CI coverage uses direct uv run pytest | CI needs XML report format for Codecov upload; just recipe generates HTML for local dev | ✓ Shipped v1.2 |
| Sub-project Makefiles preserved | data/Makefile and deploy/swag-test/Makefile are separate concerns; just recipes delegate to them | ✓ Shipped v1.2 |

---
*Last updated: 2026-02-26 after v1.2 milestone started*
