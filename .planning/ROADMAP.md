# Roadmap: Maxwell's Wallet

## Milestones

- ✅ **v1.0 DevSecOps Tooling** - Phases 1-6 (shipped 2026-02-23)
- 🚧 **v1.1 Codebase Health** - Phases 7-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 DevSecOps Tooling (Phases 1-6) - SHIPPED 2026-02-23</summary>

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

### 🚧 v1.1 Codebase Health (In Progress)

**Milestone Goal:** Address all 11 actionable concerns from codebase audit — dashboard extraction, bug fixes, error handling, type safety, tests, i18n completion, performance, and backend validation/hardening.

- [ ] **Phase 7: Type Safety + Dashboard Extraction** - Extract dashboard widgets with typed interfaces
- [ ] **Phase 8: Dashboard Polish + Error Handling** - Fix tab crash, add error boundaries and user feedback
- [ ] **Phase 9: Performance + Frontend Tests** - Parallel data fetching, caching, and unit test coverage
- [ ] **Phase 10: Internationalization** - Complete translation coverage across all UI surfaces
- [ ] **Phase 11: Backend Hardening** - UTC datetimes, validation constraints, configurable CORS

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

**How this works in practice:** Each phase planner captures these gates in the plan's verification step. The executor runs the full CI suite before committing the final PR. If any gate fails, the phase is not complete — fix before merge.

---

## Phase Details

### Phase 7: Type Safety + Dashboard Extraction
**Goal**: Dashboard page.tsx reduced to manageable size with typed widget components
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: DASH-01, DASH-02, TYPE-01, TYPE-02, TYPE-03
**Success Criteria** (what must be TRUE):
  1. Dashboard page.tsx is under 400 lines with extracted widget components
  2. Each widget component manages its own local state instead of sharing 18+ hooks
  3. All API response shapes have typed interfaces in a centralized module
  4. No `useState<any>` declarations remain in dashboard or widget code
  5. API response validation catches unexpected backend shapes as typed errors
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 8: Dashboard Polish + Error Handling
**Goal**: Dashboard reliably handles rapid interaction and communicates errors to users
**Depends on**: Phase 7 (widget extraction clarifies state bug)
**Requirements**: DASH-03, DASH-04, ERR-01, ERR-02, ERR-03, ERR-04
**Success Criteria** (what must be TRUE):
  1. Dashboard tabs switch reliably under rapid user clicks without crashes
  2. Transactions page.tsx is under 500 lines with extracted sub-components
  3. User sees toast notifications when any API call fails with retry button
  4. React error boundary catches rendering crashes and shows recovery UI
  5. Loading skeleton placeholders display while dashboard widgets fetch data
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 9: Performance + Frontend Tests
**Goal**: Dashboard loads faster with comprehensive frontend test coverage
**Depends on**: Phase 7 (extracted widgets enable parallel fetching and unit tests)
**Requirements**: PERF-01, PERF-02, PERF-03, TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Dashboard widget API calls execute in parallel instead of sequentially
  2. Dashboard data is cached with SWR or React Query to prevent redundant refetches
  3. Report endpoints verified free of N+1 query patterns via query logging
  4. Unit tests exist for each extracted dashboard widget component
  5. Unit tests exist for transactions page interactions (filter, sort, search)
  6. Unit tests exist for import workflow UI states (upload, preview, confirm, error)
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 10: Internationalization
**Goal**: All user-facing text uses translation keys with verification
**Depends on**: Nothing (independent of frontend extraction work)
**Requirements**: I18N-01, I18N-02, I18N-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. All NavBar items, page titles, and modal buttons use translation keys
  2. All form labels, help text, and error messages use translation keys
  3. Pseudo-locale test validates no untranslated strings remain in core flows
  4. i18n test suite is enabled and passing in CI
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 11: Backend Hardening
**Goal**: Backend ready for Postgres migration with robust validation
**Depends on**: Nothing (independent backend work, can run in parallel)
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, BACK-05
**Success Criteria** (what must be TRUE):
  1. All datetime fields use timezone-aware UTC with `timezone=True`
  2. Alembic migration converts existing timezone-naive data to UTC-aware
  3. Budget amount validation enforces positive values via Pydantic and DB constraints
  4. Tag due_day validation enforces 1-28 range in schema
  5. CORS origins are configurable via `CORS_ORIGINS` environment variable
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute numerically. Phases 10 and 11 are independent and can run in parallel with other work.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & SAST | v1.0 | 1/1 | Complete | 2026-02-23 |
| 2. SCA & Repository Health | v1.0 | 2/2 | Complete | 2026-02-23 |
| 3. Container Scanning | v1.0 | 1/1 | Complete | 2026-02-23 |
| 4. DAST | v1.0 | 1/1 | Complete | 2026-02-23 |
| 5. Documentation | v1.0 | 1/1 | Complete | 2026-02-23 |
| 6. Formal Verification Sweep | v1.0 | 1/1 | Complete | 2026-02-23 |
| 7. Type Safety + Dashboard Extraction | v1.1 | 0/? | Not started | - |
| 8. Dashboard Polish + Error Handling | v1.1 | 0/? | Not started | - |
| 9. Performance + Frontend Tests | v1.1 | 0/? | Not started | - |
| 10. Internationalization | v1.1 | 0/? | Not started | - |
| 11. Backend Hardening | v1.1 | 0/? | Not started | - |
