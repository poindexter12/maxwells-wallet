---
phase: 02-sca-repository-health
plan: 02
subsystem: security-automation
tags: [scorecard, openssf, repository-security, github-actions]
dependency_graph:
  requires: [01-01-foundation-sast]
  provides: [scorecard-analysis, repository-health-metrics, oidc-authentication]
  affects: [.github/workflows/scorecard.yaml]
tech_stack:
  added: [ossf/scorecard-action@v2.4.3]
  patterns: [isolated-workflow, oidc-token-auth, publish-results-api-compliance]
key_files:
  created: [.github/workflows/scorecard.yaml]
  modified: []
decisions:
  - "Isolated workflow file (not integrated into security.yaml) per OpenSSF best practices"
  - "publish_results: true for OpenSSF API compliance and public scorecard publishing"
  - "OIDC token authentication (id-token: write) required by Scorecard API"
  - "persist-credentials: false on checkout for security best practice"
  - "No top-level env or defaults blocks to satisfy API validation requirements"
  - "Weekly schedule (Sundays 2 AM UTC) plus push to main for regular assessment"
patterns_established:
  - "Workflow-level permissions: read-all with job-level write escalation"
  - "Strict compliance with publish_results API validation rules"
  - "5-day artifact retention for SARIF results (shorter than HTML reports)"
requirements_completed: [SCORE-01, SCORE-02, SCORE-03, SCORE-04]
duration_minutes: 2
completed_date: 2026-02-23
---

# Phase 02 Plan 02: Create OpenSSF Scorecard Workflow Summary

**One-liner:** OpenSSF Scorecard isolated workflow assessing repository security posture with OIDC authentication and API-compliant publish_results

## Performance

- Duration: 2 minutes
- Tasks completed: 1/1
- Commits: 1
- Files created: 1

## Accomplishments

Created isolated OpenSSF Scorecard workflow with:
- Triggers: push to main branch and weekly schedule (Sundays 2 AM UTC)
- Workflow-level read-all permissions with job-level write escalation
- OIDC token authentication (id-token: write) for Scorecard API
- publish_results: true for public scorecard publishing
- SARIF upload to GitHub Security tab with category 'scorecard'
- Artifact upload with 5-day retention
- Strict compliance with API validation requirements (no top-level env/defaults)
- All actions SHA-pinned per Phase 1 security patterns

## Task Commits

| Task | Commit | Description | Files |
|------|--------|-------------|-------|
| 1 | a96044c | Create scorecard.yaml isolated workflow with publish_results compliance | .github/workflows/scorecard.yaml |

## Files Created/Modified

### Created
- `.github/workflows/scorecard.yaml` - Isolated OpenSSF Scorecard workflow

## Decisions Made

1. **Isolated workflow approach**: Created separate scorecard.yaml instead of adding to security.yaml. OpenSSF documentation and publish_results API requirements favor isolated workflows for better control and validation.

2. **publish_results: true**: Enables public scorecard publishing to OpenSSF API and enforces strict workflow validation. This requires:
   - id-token: write permission for OIDC authentication
   - No top-level env or defaults blocks
   - Only approved actions (checkout, upload-artifact, upload-sarif, scorecard-action)
   - Ubuntu runners only

3. **Trigger strategy**: Dual triggers (push to main + weekly schedule) balance freshness with compute cost. Weekly run ensures regular assessment even during low-activity periods.

4. **persist-credentials: false**: Security best practice to prevent credential leakage in subsequent steps. Scorecard doesn't need repository write access.

5. **5-day artifact retention**: Shorter than HTML reports (30 days) because SARIF is already in Security tab. Artifact is backup/debugging aid only.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:
- ossf/scorecard-action SHA-pinned (4eaacf0543bb3f2c246792bd56e8cdeffafb205a)
- publish_results: true configured
- SARIF category 'scorecard' configured
- id-token: write permission present
- persist-credentials: false on checkout
- No top-level env block (API compliance)
- No top-level defaults block (API compliance)
- No unpinned actions found (all using SHA pins)

## Requirements Satisfied

- **SCORE-01**: Scorecard runs on push to main and weekly schedule
- **SCORE-02**: Findings appear in GitHub Security tab
- **SCORE-03**: Metrics published to OpenSSF API (publish_results: true)
- **SCORE-04**: Scan completes regardless of findings (continue-on-error: true)

## Next Phase Readiness

Ready to proceed to Phase 3 (Container Scanning). Dependencies satisfied:
- Phase 1 foundation (SHA pinning, SARIF upload patterns) ✓
- Phase 2 SCA tools deployed (Dependency-Check, Scorecard) ✓
- Security.yaml workflow extensible for additional tools ✓
- Pattern established for both integrated and isolated workflows ✓

## Self-Check

Verifying deliverables:

```bash
# Check file exists
[ -f ".github/workflows/scorecard.yaml" ] && echo "FOUND: .github/workflows/scorecard.yaml" || echo "MISSING: .github/workflows/scorecard.yaml"

# Check commit exists
git log --oneline --all | grep -q "a96044c" && echo "FOUND: a96044c" || echo "MISSING: a96044c"
```

**Self-Check: PASSED**
- .github/workflows/scorecard.yaml created
- Commit a96044c exists in git history
- All task deliverables verified
