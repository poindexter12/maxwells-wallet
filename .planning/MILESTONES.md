# Milestones

## v1.0 DevSecOps Tooling Integration (Shipped: 2026-02-23)

**Delivered:** Free, open-source Veracode alternative with five security scanning tools running non-blocking in GitHub Actions CI, producing unified SARIF findings in the GitHub Security tab.

**Phases completed:** 6 phases, 7 plans, ~14 tasks
**Files modified:** 33 (+5,387 / -609 lines)
**Timeline:** 2026-02-23 (single day)
**Git range:** feat(01-01) → docs(06-01)
**Requirements:** 28/28 satisfied (100%)

**Key accomplishments:**
1. Reusable security.yaml workflow with Semgrep SAST (native Docker, auto ruleset, SARIF → Security tab)
2. OWASP Dependency-Check SCA with NVD database caching (24h TTL) and dual-language npm/Python scanning
3. OpenSSF Scorecard in isolated workflow with OIDC auth and API-compliant publish_results
4. Trivy container scanning in docker CI job — scans local image before GHCR push
5. OWASP ZAP baseline DAST with ephemeral Docker Compose orchestration and SARIF upload
6. README Security Tools documentation covering all five tools with interpretation guide
7. Formal verification sweep establishing 3-source traceability for all 28 requirements

### Known Tech Debt
- Phase 1 SUMMARY.md lacks `requirements_completed` YAML frontmatter (body text has them) — Low
- ZAP baseline expected 50-200 findings before tuning — deferred to DAST-V2-03
- ZAP scans public pages only, no authenticated scanning — deferred to DAST-V2-01
- ZAP targets frontend only, backend API not directly scanned — deferred to DAST-V2-02
- Phase 6 meta-phase has no VERIFICATION.md (creates verification, not implementation) — Low

**Archives:**
- `milestones/v1.0-ROADMAP.md`
- `milestones/v1.0-REQUIREMENTS.md`
- `milestones/v1.0-MILESTONE-AUDIT.md`

---


## v1.1 Codebase Health (Shipped: 2026-02-26)

**Delivered:** Addressed all 11 actionable codebase audit concerns — dashboard extraction, bug fixes, error handling, type safety, frontend test coverage, i18n completion, performance verification, and backend hardening for Postgres migration readiness.

**Phases completed:** 5 phases (7-11), 12 plans
**Files modified:** 75 (+11,399 / -1,141 lines)
**Timeline:** 3 days (2026-02-24 → 2026-02-26)
**Git range:** 911838d..aaa6b73 (PRs #228-#231)
**Requirements:** 26/26 satisfied (100%)

**Key accomplishments:**
1. Dashboard extraction: 1,168 → 122 lines (-90%) with 10 typed SWR widget components and lazy loading
2. Transactions extraction: 1,323 → 490 lines (-63%) with TransactionFilters, BulkActions, useTransactionData
3. Dashboard tab crash fixed via functional state updates and SWR cache isolation per dashboard ID
4. Error infrastructure: React ErrorBoundary + sonner toasts + retry buttons on all 9 widget hooks
5. Frontend test coverage: 93+ unit tests for widgets, transactions, and import workflows
6. i18n pipeline: audit script, pseudo-locale E2E test, 30+ translation keys, CI integration
7. Backend hardening: UTC-aware datetimes, dual-layer validation (Pydantic + DB), configurable CORS

### Known Tech Debt
- 10 widget/hook test failures documented (mock timing, Recharts prop interfaces) — TEST-01 at ~82% pass rate
- i18n migration focused on high-impact strings; low-priority remnants addressable in future iterations
- Phase 8 and Phase 9 plan checkboxes in ROADMAP never updated (cosmetic only, work was completed)

**Archives:**
- `milestones/v1.1-ROADMAP.md`
- `milestones/v1.1-REQUIREMENTS.md`

---

