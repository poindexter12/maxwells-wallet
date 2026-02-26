# Roadmap: Maxwell's Wallet

## Milestones

- ✅ **v1.0 DevSecOps Tooling** — Phases 1-6 (shipped 2026-02-23)
- ✅ **v1.1 Codebase Health** — Phases 7-11 (shipped 2026-02-26)

## Phases

<details>
<summary>✅ v1.0 DevSecOps Tooling (Phases 1-6) — SHIPPED 2026-02-23</summary>

See `milestones/v1.0-ROADMAP.md` for archived v1.0 phase details.

**Delivered:** Five security scanning tools running non-blocking in GitHub Actions CI, producing unified SARIF findings in the GitHub Security tab.

**Phases:**
1. Foundation & SAST (Semgrep)
2. SCA & Repository Health (OWASP Dependency-Check, OpenSSF Scorecard)
3. Container Scanning (Trivy)
4. DAST (OWASP ZAP)
5. Documentation
6. Formal Verification Sweep

</details>

<details>
<summary>✅ v1.1 Codebase Health (Phases 7-11) — SHIPPED 2026-02-26</summary>

See `milestones/v1.1-ROADMAP.md` for archived v1.1 phase details.

**Delivered:** Addressed all 11 actionable codebase audit concerns — dashboard extraction (-90%), bug fixes, error handling, type safety, 93+ unit tests, i18n pipeline, and backend hardening for Postgres migration readiness.

**Phases:**
- [x] Phase 7: Type Safety + Dashboard Extraction (1/1 plans) — completed 2026-02-24
- [x] Phase 8: Dashboard Polish + Error Handling (3/3 plans) — completed 2026-02-24
- [x] Phase 9: Performance + Frontend Tests (3/3 plans) — completed 2026-02-25
- [x] Phase 10: Internationalization (3/3 plans) — completed 2026-02-25
- [x] Phase 11: Backend Hardening (2/2 plans) — completed 2026-02-26

</details>

## Phase Quality Gate (applies to ALL phases)

Every phase MUST satisfy these criteria before merge. These are non-negotiable — a phase is not complete until the PR passes all gates.

### Delivery
- [ ] Phase work submitted as a PR against `main`
- [ ] All CI checks pass (build, lint, typecheck, tests, security scans)
- [ ] PR reviewed and approved before merge

### Security
- [ ] No new GitHub Security tab findings introduced (Semgrep SAST, Dependency-Check SCA, Trivy, ZAP)
- [ ] No new `npm audit` or `pip-audit` vulnerabilities introduced
- [ ] No secrets or credentials committed

### Quality
- [ ] Backend test coverage does not decrease from pre-phase baseline
- [ ] Frontend test coverage does not decrease from pre-phase baseline (V8 thresholds: 70% lines/branches/functions/statements)
- [ ] No new TypeScript `any` assertions introduced (existing ones may be removed)
- [ ] `pnpm check` (lint/format) passes with zero warnings

### Performance
- [ ] No measurable performance regressions in affected areas
- [ ] Dashboard load time does not increase (measured by E2E or manual benchmark)
- [ ] No new N+1 query patterns introduced in backend

### Compatibility
- [ ] Existing E2E tests pass without modification (unless test is explicitly updated for new behavior)
- [ ] Existing API contracts unchanged (unless migration is part of the phase)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & SAST | v1.0 | 1/1 | Complete | 2026-02-23 |
| 2. SCA & Repository Health | v1.0 | 2/2 | Complete | 2026-02-23 |
| 3. Container Scanning | v1.0 | 1/1 | Complete | 2026-02-23 |
| 4. DAST | v1.0 | 1/1 | Complete | 2026-02-23 |
| 5. Documentation | v1.0 | 1/1 | Complete | 2026-02-23 |
| 6. Formal Verification Sweep | v1.0 | 1/1 | Complete | 2026-02-23 |
| 7. Type Safety + Dashboard Extraction | v1.1 | 1/1 | Complete | 2026-02-24 |
| 8. Dashboard Polish + Error Handling | v1.1 | 3/3 | Complete | 2026-02-24 |
| 9. Performance + Frontend Tests | v1.1 | 3/3 | Complete | 2026-02-25 |
| 10. Internationalization | v1.1 | 3/3 | Complete | 2026-02-25 |
| 11. Backend Hardening | v1.1 | 2/2 | Complete | 2026-02-26 |
