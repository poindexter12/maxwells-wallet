# Maxwell's Wallet — Project Planning

## What This Is

A full-stack personal finance tracker (Next.js 16 + FastAPI + SQLite/Postgres) with CI-integrated DevSecOps tooling. v1.0 shipped five security scanning tools in GitHub Actions; v1.1 focuses on codebase health — extracting oversized components, fixing bugs found by chaos testing, adding error handling and test coverage, and hardening the backend for future Postgres migration.

## Core Value

A reliable, maintainable personal finance tracker where users can trust their data is accurate and the UI communicates clearly when something goes wrong.

## Current Milestone: v1.1 Codebase Health

**Goal:** Address all 11 actionable concerns from the codebase audit — dashboard extraction, bug fixes, error handling, type safety, tests, i18n completion, performance, and backend validation/hardening.

**Target concerns:**
- Dashboard page extraction (1,168 → ~300 lines)
- Dashboard tab switching crash fix
- Silent API error handling → user-visible feedback
- Type safety gaps (remove `any`, validate API responses)
- Frontend unit test coverage for main pages
- i18n translation coverage completion
- Dashboard data fetching performance (sequential → parallel)
- N+1 query risk in reports
- Timezone-naive datetimes → UTC-aware
- Budget amount + tag due_day validation
- CORS environment-variable configuration

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

### Active

- [ ] Dashboard page components extracted to dedicated widget files
- [ ] Dashboard tab switching crash resolved
- [ ] API errors shown to users with retry capability
- [ ] TypeScript `any` declarations replaced with typed interfaces
- [ ] Frontend unit tests for dashboard, transactions, import pages
- [ ] i18n translation coverage complete across all pages/components
- [ ] Dashboard data fetching parallelized with caching
- [ ] Report queries verified free of N+1 patterns
- [ ] All datetimes UTC-aware with timezone=True
- [ ] Budget amount and tag due_day input validation enforced
- [ ] CORS origins configurable via environment variable

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

## Context

v1.0 shipped DevSecOps tooling (33 files, 5 security scanners in CI). v1.1 shifts focus to the application codebase itself.

**App tech stack:** Next.js 16 (App Router, TypeScript), FastAPI (async Python), SQLite (dev) with SQLModel ORM, Alembic migrations, next-intl (9 locales).

**Codebase state (from audit 2026-02-24):**
- Dashboard page.tsx is 1,168 lines with 9 inline widget renderers and 18+ state hooks
- Transactions page.tsx is 1,323 lines
- Chaos tests found tab switching crash (skipped pending fix)
- i18n test suite skipped — only widget components have translation support
- Frontend unit test coverage estimated at 5-10% of critical paths
- All datetimes are timezone-naive (blocks Postgres migration)
- 8+ sequential API calls on dashboard load (5-8s)

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

---
*Last updated: 2026-02-24 after v1.1 milestone started*
