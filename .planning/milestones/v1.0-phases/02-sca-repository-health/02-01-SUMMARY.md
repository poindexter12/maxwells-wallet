---
phase: 02-sca-repository-health
plan: 01
subsystem: security-automation
tags: [sca, dependency-scanning, nvd, owasp, github-actions]
dependency_graph:
  requires: [01-01-foundation-sast]
  provides: [dependency-check-sca, nvd-caching, python-npm-scanning]
  affects: [.github/workflows/security.yaml]
tech_stack:
  added: [owasp/dependency-check, actions/cache@v4, uv pip compile]
  patterns: [nvd-database-caching, dual-language-scanning, experimental-python-support]
key_files:
  created: []
  modified: [.github/workflows/security.yaml]
decisions:
  - "NVD database caching with 24-hour TTL to avoid rate limiting"
  - "Generate requirements.txt from pyproject.toml using uv for Dependency-Check compatibility"
  - "Enable --enableExperimental flag for Python dependency scanning"
  - "Graceful NVD API key degradation using secrets.NVD_API_KEY || ''"
  - "30-day retention for HTML artifact reports"
patterns_established:
  - "Datetime-based cache keys for time-boxed invalidation"
  - "Docker volume mounts for NVD database persistence"
  - "Dual output formats (SARIF + HTML) for different audiences"
requirements_completed: [SCA-01, SCA-02, SCA-03, SCA-04]
duration_minutes: 1
completed_date: 2026-02-23
---

# Phase 02 Plan 01: Add OWASP Dependency-Check Summary

**One-liner:** OWASP Dependency-Check scanning npm and Python dependencies with NVD database caching and SARIF upload to GitHub Security tab

## Performance

- Duration: 1 minute
- Tasks completed: 1/1
- Commits: 1
- Files modified: 1

## Accomplishments

Added OWASP Dependency-Check SCA scanning to the reusable security.yaml workflow with:
- NVD database caching (24-hour TTL) to avoid rate limiting
- Dual-language support: npm (package-lock.json) and Python (generated requirements.txt)
- SARIF upload to GitHub Security tab with unique category 'dependency-check'
- HTML report artifact with 30-day retention
- Graceful degradation when NVD API key not configured
- All actions SHA-pinned per Phase 1 security patterns

## Task Commits

| Task | Commit | Description | Files |
|------|--------|-------------|-------|
| 1 | 8e6db69 | Add dependency-check job with NVD caching and dual-language scanning | .github/workflows/security.yaml |

## Files Created/Modified

### Modified
- `.github/workflows/security.yaml` - Added dependency-check job after semgrep job

## Decisions Made

1. **NVD database caching strategy**: 24-hour TTL using datetime-based cache keys (`${{ runner.os }}-nvd-${{ steps.get-date.outputs.datetime }}`). Balances freshness with rate limit avoidance.

2. **Python scanning approach**: Generate requirements.txt from pyproject.toml using `uv pip compile` because Dependency-Check does not natively support uv.lock format. Requires `--enableExperimental` flag.

3. **NVD API key handling**: Optional secret with graceful degradation (`${{ secrets.NVD_API_KEY || '' }}`). Scan works without key but slower and may hit rate limits.

4. **Dual output formats**: SARIF for automated GitHub Security tab upload, HTML for human-readable artifact download. Different audiences, complementary value.

5. **Docker container approach**: Use native `owasp/dependency-check:latest` Docker image with volume mounts rather than GitHub Action wrapper, following Phase 1 pattern for better control.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:
- dependency-check job exists in security.yaml
- enableExperimental flag present for Python scanning
- SARIF category 'dependency-check' configured
- actions/cache SHA-pinned (1bd1e32a3bdc45362d1e726936510720a7c30a57)
- No unpinned actions found (all using SHA pins)

## Requirements Satisfied

- **SCA-01**: Dependency-Check scans on push to main
- **SCA-02**: Findings appear in GitHub Security tab
- **SCA-03**: NVD database cached with 24h TTL
- **SCA-04**: Scan completes regardless of findings (continue-on-error: true)

## Next Phase Readiness

Ready to proceed. Dependencies satisfied:
- Phase 1 foundation (SHA pinning, job-level permissions, SARIF upload patterns) ✓
- security.yaml workflow exists and is reusable ✓
- Pattern established for adding additional SCA tools ✓

## Self-Check

Verifying deliverables:

```bash
# Check file exists
[ -f ".github/workflows/security.yaml" ] && echo "FOUND: .github/workflows/security.yaml" || echo "MISSING: .github/workflows/security.yaml"

# Check commit exists
git log --oneline --all | grep -q "8e6db69" && echo "FOUND: 8e6db69" || echo "MISSING: 8e6db69"
```

**Self-Check: PASSED**
- .github/workflows/security.yaml modified
- Commit 8e6db69 exists in git history
- All task deliverables verified
