# Roadmap: Maxwell's Wallet

## Milestones

- ✅ **v1.0 DevSecOps Tooling** — Phases 1-6 (shipped 2026-02-23)
- ✅ **v1.1 Codebase Health** — Phases 7-11 (shipped 2026-02-26)
- 🚧 **v1.2 Build System Modernization** — Phases 12-16 (in progress)

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

### 🚧 v1.2 Build System Modernization (In Progress)

**Milestone Goal:** Replace Make with Just + gum for a modern, beautiful task runner experience, with mise as the single prerequisite managing all dev tooling.

- [x] **Phase 12: Tool Foundation** - mise manages all dev tools and environment
- [x] **Phase 13: Justfile Migration** - Convert all Make targets to just recipes with gum UX (completed 2026-02-27)
- [x] **Phase 14: Integration** - Update CI workflows and devcontainer (completed 2026-02-27)
- [x] **Phase 15: Documentation** - Update all docs to reference just (completed 2026-02-27)
- [ ] **Phase 16: Cleanup** - Remove deprecated Make files

## Phase Details

### Phase 12: Tool Foundation
**Goal**: Establish mise as the single tool version manager and environment handler
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: MISE-01, MISE-02, MISE-03, MISE-04
**Success Criteria** (what must be TRUE):
  1. Developer runs `cd` into project directory and mise auto-installs all tools (just, gum, node, python, uv)
  2. All tool versions match `.mise.toml` specification without manual intervention
  3. Secrets load from gitignored `.env` file via mise `[env]` section
  4. Running `just --version`, `gum --version`, `node --version`, `python --version`, `uv --version` all succeed without additional setup
**Plans:** 1 plan
Plans:
- [x] 12-01-PLAN.md — Create .mise.toml, migrate secrets to .env, validate tool installation

### Phase 13: Justfile Migration
**Goal**: Convert all ~60 Make targets to just recipes with beautiful gum terminal UX
**Depends on**: Phase 12
**Requirements**: JUST-01, JUST-02, JUST-03, JUST-04, JUST-05, JUST-06, JUST-07, GUM-01, GUM-02, GUM-03, GUM-04, GUM-05
**Success Criteria** (what must be TRUE):
  1. All existing Make targets have identical behavior in just recipes (setup, dev, test, db, docker, i18n, release, utils)
  2. Running `just --list` shows organized, documented recipes with descriptions
  3. Destructive commands (db-reset, clean-all) require interactive confirmation via gum
  4. Long operations (install, build, test) show progress spinners
  5. Both `make <target>` and `just <recipe>` work in parallel during transition period
**Plans:** 2/2 plans complete
Plans:
- [x] 13-01-PLAN.md — Foundation: gum-helpers.sh, root justfile, dev + db modules, stub remaining modules
- [x] 13-02-PLAN.md — Complete remaining modules: test, docker, release, i18n, utils

### Phase 14: Integration
**Goal**: Update CI workflows and devcontainer to use mise + just
**Depends on**: Phase 13
**Requirements**: CI-01, CI-02, CI-03, DEVC-01, DEVC-02, DEVC-03
**Success Criteria** (what must be TRUE):
  1. All GitHub Actions workflows use mise-action and call `just <recipe>` instead of inline bash
  2. Devcontainer rebuilds and all tools are available in new terminal sessions
  3. CI jobs pass using just recipes with identical behavior to previous Make commands
  4. Gum commands gracefully fall back to plain output in CI (non-TTY environments)
**Plans:** 2/2 plans complete
Plans:
- [x] 14-01-PLAN.md — Migrate CI workflows to mise-action + just recipes
- [x] 14-02-PLAN.md — Update devcontainer for mise tool management

### Phase 15: Documentation
**Goal**: Update all documentation to reference just instead of make
**Depends on**: Phase 14
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. CLAUDE.md Development Commands section references `just` targets exclusively
  2. README.md setup and development instructions use `just` commands
  3. Searching codebase for backtick-wrapped make commands returns zero results (`git grep -i "\`make"`)
  4. New contributors can follow README to successful setup without encountering make references
**Plans:** 2/2 plans complete
Plans:
- [x] 15-01-PLAN.md — Rewrite CLAUDE.md, README.md, QUICKSTART.md with just commands and mise-first onboarding
- [x] 15-02-PLAN.md — Sweep all remaining docs, agents, skills; run DOC-03 grep audit

### Phase 16: Cleanup
**Goal**: Remove deprecated Make files after migration validated
**Depends on**: Phase 15
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03
**Success Criteria** (what must be TRUE):
  1. Makefile and make/ directory no longer exist in repository
  2. `.nvmrc` and `.python-version` removed (replaced by `.mise.toml`)
  3. CI remains green after deletion (all workflows using just)
  4. Developer workflows unchanged (just recipes provide identical functionality)
**Plans:** 1 plan
Plans:
- [ ] 16-01-PLAN.md — Delete deprecated Make/tool-version files, sweep stale references

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
| 12. Tool Foundation | v1.2 | 1/1 | Complete | 2026-02-26 |
| 13. Justfile Migration | v1.2 | 2/2 | Complete | 2026-02-27 |
| 14. Integration | v1.2 | 2/2 | Complete | 2026-02-27 |
| 15. Documentation | v1.2 | 2/2 | Complete | 2026-02-27 |
| 16. Cleanup | v1.2 | 0/0 | Not started | - |
