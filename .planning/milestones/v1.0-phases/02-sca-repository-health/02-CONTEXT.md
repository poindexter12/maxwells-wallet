# Phase 2: SCA & Repository Health - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add OWASP Dependency-Check (SCA) and OpenSSF Scorecard jobs to the reusable security.yaml workflow established in Phase 1. Dependency-Check scans npm and pip lockfiles against the NVD database with caching. Scorecard runs in an isolated workflow due to strict permission requirements. Both upload SARIF to GitHub Security tab with unique categories. All scans are non-blocking.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation decisions delegated to Claude. Use research findings, Phase 1 patterns, and existing CI conventions.

**Dependency-Check integration:**
- Add as a new job in security.yaml (extends Phase 1 pattern)
- Scan both `frontend/package-lock.json` and `backend/uv.lock` (or equivalent pip lockfile)
- NVD database caching via GitHub Actions cache with 24h TTL to avoid rate limiting
- NVD API key passed via repository secret (user must configure `NVD_API_KEY` secret)
- SARIF output with category: `dependency-check`
- HTML report uploaded as artifact for human review (secondary output)
- Job-level permissions: security-events: write, contents: read
- continue-on-error: true (non-blocking)

**Scorecard integration:**
- Isolated workflow (`scorecard.yaml`) — NOT embedded in security.yaml
- Research identified strict Scorecard restrictions: requires its own workflow with specific permissions
- Triggers: pushes to main only (Scorecard doesn't support PR scanning)
- Permissions: contents: read, security-events: write, id-token: write (for publish_results)
- SARIF output with category: `scorecard`
- continue-on-error: true (non-blocking)
- SHA-pinned ossf/scorecard-action (exact SHA to be determined by research)

**NVD API key handling:**
- Document in README that `NVD_API_KEY` secret is required for Dependency-Check
- Scan should still work without key (slower, rate-limited) — graceful degradation
- Key is free: https://nvd.nist.gov/developers/request-an-api-key

**Scan triggers:**
- Dependency-Check: pushes to main (via security.yaml, same as Semgrep)
- Scorecard: pushes to main (via its own scorecard.yaml)
- Both run on nightly schedule as well

**SARIF conventions (extending Phase 1):**
- dependency-check → category: `dependency-check`
- scorecard → category: `scorecard`
- Follows Phase 1 convention of unique categories per tool

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches guided by research.

Key research inputs to follow:
- Scorecard MUST be in its own workflow (strict GitHub restrictions on scorecard-action)
- NVD API key strongly recommended to avoid rate limiting (free, 1-2 day approval)
- OWASP Dependency-Check uses NVD database which needs caching for CI performance
- Scorecard requires id-token: write permission for publish_results feature
- Extend security.yaml from Phase 1 (don't create separate SCA workflow)
- Follow same SHA-pinning and job-level permission patterns from Phase 1

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-sca-repository-health*
*Context gathered: 2026-02-23*
