---
phase: 04-dast
plan: 01
subsystem: ci-security
tags: [dast, zap, docker-compose, security-scanning]
dependencies:
  requires: [03-01]
  provides: [dast-workflow]
  affects: [ci-pipeline, security-tab]
tech-stack:
  added: [zaproxy/action-baseline@v0.15.0]
  patterns: [ephemeral-docker-environments, sarif-upload, non-blocking-scans]
key-files:
  created: [.github/workflows/dast.yaml]
  modified: []
decisions:
  - ZAP baseline scan v0.15.0 (SHA 6c5a007541891231cd9e0ddec25d4f25c59c9874)
  - SARIF output via `-J zap-report.json` cmd_option
  - 20-minute timeout for app startup + scan execution
  - Health check pattern matching ci.yaml docker job (15s initial sleep + 10 retries with 3s intervals)
patterns-established:
  - Ephemeral Docker Compose environments for dynamic testing
  - SARIF category 'zap' for DAST findings isolation
  - 30-day artifact retention for HTML/Markdown reports
requirements-completed: [DAST-01, DAST-02, DAST-03, DAST-04]
metrics:
  duration: 80
  completed: 2026-02-23
---

# Phase 04 Plan 01: DAST Workflow with ZAP Baseline Scan Summary

**One-liner:** OWASP ZAP baseline (passive) scan against ephemeral Docker Compose app with SARIF upload to Security tab.

## What Was Built

Created `.github/workflows/dast.yaml` implementing:

1. **Trigger:** Push to main + manual dispatch
2. **Environment orchestration:** Docker Compose spins up Maxwell's Wallet (frontend:3000, backend:3001) in ephemeral environment
3. **Health validation:** 15-second initial wait + retry loops (10 attempts, 3s intervals) for both services
4. **ZAP baseline scan:** Passive scan against http://localhost:3000 using zaproxy/action-baseline@v0.15.0
5. **SARIF upload:** Results uploaded to Security tab with category 'zap'
6. **Artifacts:** HTML and Markdown reports retained for 30 days
7. **Cleanup:** Always runs `docker compose down -v --remove-orphans`

## Verification Results

All verification checks passed:
- ✓ Workflow file created at `.github/workflows/dast.yaml`
- ✓ Docker Compose orchestration command present
- ✓ ZAP action reference found
- ✓ SARIF category 'zap' configured
- ✓ Non-blocking execution (`continue-on-error: true`)
- ✓ Checkout action SHA-pinned
- ✓ All actions use commit SHA format (no @v tags)

## Task Completion

| Task | Type | Status | Files | Commit |
|------|------|--------|-------|--------|
| Create dast.yaml workflow with Docker Compose app orchestration and ZAP baseline scan | auto | ✓ | .github/workflows/dast.yaml | af17d18 |

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Upstream dependencies:**
- Requires Phase 03 (Trivy container scanning) complete
- Uses existing `docker-compose.dev.yaml` from repository
- Follows health check pattern from `ci.yaml` docker job

**Downstream impact:**
- Adds new 'zap' category to GitHub Security tab (joins semgrep, dependency-check, scorecard, trivy-container)
- DAST scan runs on every push to main (slow operation, intentionally excluded from PRs)
- Findings are informational (non-blocking per DAST-04 requirement)

**SARIF categories in use:**
- `semgrep` (Phase 01 - SAST)
- `dependency-check` (Phase 02 - SCA)
- `scorecard` (Phase 02 - Repository Health)
- `trivy-container` (Phase 03 - Container Scanning)
- `zap` (Phase 04 - DAST) ← NEW

## Technical Decisions

1. **ZAP baseline over full scan:** Baseline scan is passive (safe, no auth required), fast (~2-5 minutes), and sufficient for initial DAST coverage. Full scan would require authentication configuration and take significantly longer.

2. **SARIF via `-J` flag:** ZAP baseline action supports SARIF output through the `cmd_options: '-J zap-report.json'` parameter. This produces JSON in SARIF format compatible with GitHub Code Scanning.

3. **20-minute timeout:** Allows for Docker Compose build (5-7 minutes), health check retries (up to 2 minutes), and ZAP scan execution (typically 2-5 minutes for baseline). Provides buffer for CI runner variability.

4. **Health check pattern:** Matched existing pattern from `ci.yaml` docker job exactly (15s initial sleep + 10 retries @ 3s intervals). Ensures consistency across workflows and leverages proven timing values.

5. **Trigger on main only:** DAST is slower than SAST/SCA scans. Running only on main branch prevents PR pipeline slowdown while maintaining security coverage for deployed code.

## Known Limitations

1. **False positive volume:** ZAP baseline scans typically report 50-200 findings before tuning. Many are low-risk or false positives. Post-deployment tuning (Phase 4 continuation work) will add context file to suppress known safe patterns.

2. **No authentication:** Baseline scan only tests publicly accessible pages. Protected routes require ZAP authentication configuration (not included in this phase).

3. **Single target:** Scan targets `http://localhost:3000` (frontend) only. Backend API (`http://localhost:3001`) is not directly scanned (though API calls from frontend may be tested indirectly).

## Self-Check: PASSED

**File existence:**
```
FOUND: .github/workflows/dast.yaml
```

**Commit verification:**
```
FOUND: af17d18 (feat(04-01): create dast.yaml workflow with Docker Compose + ZAP baseline scan)
```

**Workflow validation:**
- All actions SHA-pinned (no @v tags)
- SARIF category 'zap' configured
- Docker Compose orchestration with health checks
- Non-blocking execution enabled
- Cleanup step always runs

## Requirements Traceability

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| DAST-01 | ✓ | ZAP baseline scan via zaproxy/action-baseline@v0.15.0 |
| DAST-02 | ✓ | Docker Compose orchestration with health validation |
| DAST-03 | ✓ | SARIF upload to Security tab (category: zap) |
| DAST-04 | ✓ | continue-on-error: true (non-blocking execution) |

All requirements completed successfully.
