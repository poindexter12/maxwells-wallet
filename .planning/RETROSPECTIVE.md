# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — DevSecOps Tooling

**Shipped:** 2026-02-23
**Phases:** 6 | **Plans:** 7

### What Was Built
- Reusable security.yaml workflow with 5 scanning tools (Semgrep, Dependency-Check, Scorecard, Trivy, ZAP)
- All tools produce SARIF findings in GitHub Security tab
- Non-blocking CI integration — informational only, never blocks merges

### What Worked
- Clean separation of concerns: one tool per phase made each easy to reason about
- Reusable workflow pattern (security.yaml) made adding tools incremental
- 3-source verification established audit-ready traceability from day one

### What Was Inefficient
- Phase 1 SUMMARY.md format lacked YAML frontmatter (corrected in later phases)
- ZAP baseline scan produces 50-200 findings without tuning — noise level high

### Patterns Established
- SARIF upload with unique category convention per tool
- Job-level permissions (least privilege)
- SHA-pinned Actions for supply chain security

### Key Lessons
1. Starting with passive/baseline scans is the right call — active scanning adds risk with diminishing returns early on
2. Reusable workflows save significant setup time when you know you'll add more tools

---

## Milestone: v1.1 — Codebase Health

**Shipped:** 2026-02-26
**Phases:** 5 | **Plans:** 12

### What Was Built
- Dashboard extraction: 1,168 → 122 lines with 10 typed widget components
- Transactions extraction: 1,323 → 490 lines
- Error handling infrastructure (ErrorBoundary + sonner toasts + SWR retry)
- 93+ frontend unit tests
- i18n pipeline with audit script and pseudo-locale E2E
- Backend hardening: UTC datetimes, dual-layer validation, configurable CORS

### What Worked
- Audit-driven milestone: starting from a clear list of 11 concerns made scope tight
- SWR adoption solved multiple problems at once (dedup, caching, revalidation, error retry)
- Extraction-first approach (dashboard, transactions) made testing much easier

### What Was Inefficient
- REQUIREMENTS.md traceability table wasn't kept in sync during execution (cosmetic but annoying)
- Some widget/hook tests were fragile due to mock timing issues — 10 test failures documented

### Patterns Established
- SWR for all data fetching hooks with dashboard-scoped cache keys
- Sonner toasts for user-facing error messages
- Dual-layer validation (Pydantic + DB constraints)

### Key Lessons
1. Component extraction should happen before adding tests — testing 1,168-line files is painful
2. Traceability table maintenance should be part of phase completion checklists, not deferred

---

## Milestone: v1.2 — Build System Modernization

**Shipped:** 2026-02-27
**Phases:** 5 | **Plans:** 8

### What Was Built
- mise as single tool version manager (.mise.toml managing 5 tools)
- 82 just recipes across 7 modules replacing all Make targets
- gum-powered terminal UX with TTY detection and CI fallback
- 7 CI workflows migrated to mise-action
- 25+ documentation files updated
- Deprecated Make files removed

### What Worked
- Linear dependency chain (12→13→14→15→16) meant zero merge conflicts or coordination issues
- Stub module pattern in Phase 13: create all 7 modules with stubs first, then fill them — just can parse imports at every step
- gum-helpers.sh centralized all styling logic, making consistency trivial
- Two-commit strategy for cleanup (update refs → delete files) produced clean git history

### What Was Inefficient
- REQUIREMENTS.md checkboxes weren't updated for phases 12, 14, 15 (same issue as v1.1 — pattern repeating)
- summary-extract tool couldn't parse the one_liner field from these summaries (format mismatch)

### Patterns Established
- Shebang recipe pattern: `#!/usr/bin/env bash` + `set -euo pipefail` + `source scripts/gum-helpers.sh`
- gum style color codes: 1=red, 2=green, 3=yellow, 12=blue
- Test recipes stream output directly (no spin wrapper)
- Sub-project Makefiles preserved when just recipes delegate to them

### Key Lessons
1. Build system migration is best done as a hard cut — no backward-compat wrapper needed when phases validate each step
2. The REQUIREMENTS.md traceability sync problem has repeated 3 milestones now — this needs a process fix (automated check or phase-completion hook)
3. mise's aqua backend for tools like just/gum is much faster than cargo — always check the default backend before specifying one

### Cost Observations
- Execution time: 0.38 hours (8 plans, avg 2.6 min/plan)
- Fastest milestone per plan — build system work is mostly config/file operations, not complex logic
- Notable: Zero deviations in 5 of 8 plans — the phases were well-researched

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Avg Duration/Plan | Key Change |
|-----------|--------|-------|-------------------|------------|
| v1.0 | 6 | 7 | 2.4 min | Established GSD workflow |
| v1.1 | 5 | 12 | 3.7 min | Audit-driven scope, extraction patterns |
| v1.2 | 5 | 8 | 2.6 min | Config-heavy work, linear dependencies |

### Cumulative Quality

| Milestone | Backend Tests | Frontend Tests | Files Modified | Lines Changed |
|-----------|---------------|----------------|----------------|---------------|
| v1.0 | 1,153 | 336+ | 33 | +5,387 / -609 |
| v1.1 | 1,153 | 336+ (93 new) | 75 | +11,399 / -1,141 |
| v1.2 | 1,153 | 336+ | 89 | +8,072 / -1,465 |

### Top Lessons (Verified Across Milestones)

1. **REQUIREMENTS.md traceability sync is consistently broken** — checkbox updates are missed during phase execution across all 3 milestones. Needs automated enforcement.
2. **Extraction before testing** — applies to both code (v1.1 dashboard) and build systems (v1.2 modules). Working with large monoliths is always harder.
3. **Linear phase dependencies produce clean execution** — zero conflicts, easy to reason about, fast throughput. Prefer this when possible.
