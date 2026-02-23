# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Security scanning tools run automatically in CI and produce visible, actionable findings without breaking any builds.
**Current focus:** Phase 4: DAST

## Current Position

Phase: 4 of 5 (DAST)
Plan: 1 of 1 in current phase
Status: Phase complete
Last activity: 2026-02-23 — Phase 4 complete (04-01 ZAP DAST workflow)

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 1.4 minutes
- Total execution time: 0.14 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-sast | 1 | 2 min | 2 min |
| 02-sca-repository-health | 2 | 3 min | 1.5 min |
| 03-container-scanning | 1 | 1 min | 1 min |
| 04-dast | 1 | 1 min | 1 min |

**Recent Trend:**
- Last 5 plans: 02-01 (1 min), 02-02 (2 min), 03-01 (1 min), 04-01 (1 min)
- Trend: Excellent velocity, Phase 4 completed in 1 minute

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- DefectDojo findings portal cut from milestone (overhead not justified until multiple projects need aggregation)
- Semgrep auto ruleset chosen for initial deployment (auto-detects languages, good starting point before custom rules)
- OWASP Dependency-Check selected alongside existing Dependabot (different databases provide additive coverage)
- Trivy selected for container scanning (lightweight, well-maintained, covers OS + app dependencies)
- ZAP baseline (passive) scan chosen for DAST (safe, fast, no auth config required for first pass)
- [Phase 01-foundation-sast]: Native Semgrep Docker container over semgrep-action wrapper for better control and security
- [Phase 01-foundation-sast]: Non-blocking security scans (continue-on-error) to inform without blocking development
- [Phase 01-foundation-sast]: Job-level permissions over workflow-level for least privilege (security-events: write)
- [Phase 02-sca-repository-health]: NVD database caching with 24h TTL to avoid rate limiting
- [Phase 02-sca-repository-health]: Generate requirements.txt from pyproject.toml using uv for Dependency-Check compatibility
- [Phase 02-sca-repository-health]: Isolated workflow for Scorecard with publish_results: true for API compliance
- [Phase 02-sca-repository-health]: OIDC authentication (id-token: write) for Scorecard public metrics publishing
- [Phase 03-01]: Trivy scans local docker-compose built image before GHCR push for early vulnerability detection
- [Phase 03-01]: Include all Trivy severity levels (UNKNOWN to CRITICAL) for comprehensive visibility
- [Phase 03-01]: Position Trivy before buildx setup to scan all builds including PRs
- [Phase 04-01]: ZAP baseline scan v0.15.0 (SHA 6c5a007541891231cd9e0ddec25d4f25c59c9874)
- [Phase 04-01]: SARIF output via -J zap-report.json cmd_option
- [Phase 04-01]: 20-minute timeout for app startup + scan execution

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 2 Status:**
- ✓ NVD database caching implemented with 24h TTL
- ✓ Scorecard action SHA located and pinned (4eaacf0543bb3f2c246792bd56e8cdeffafb205a)
- Optional: NVD API key still recommended for faster updates (graceful degradation implemented)

**Phase 3 Status:**
- ✓ Trivy integrated into docker job (ci.yaml)
- ✓ Scans local maxwells-wallet:latest image after build, before GHCR push
- ✓ SARIF uploaded with category 'trivy-container'
- ✓ Non-blocking execution, all builds scanned (PRs and main)

**Phase 4 Status:**
- ✓ ZAP baseline scan workflow created (dast.yaml)
- ✓ Docker Compose ephemeral environment orchestration
- ✓ SARIF uploaded with category 'zap'
- ✓ Non-blocking execution, runs on push to main only

**Phase 4 Known Limitation:**
- ZAP false positive volume typically high (50-200 findings before tuning) — post-deployment tuning needed

## Session Continuity

Last session: 2026-02-23 (Phase 4 execution)
Stopped at: Completed 04-01-PLAN.md (ZAP DAST workflow)
Resume file: None
