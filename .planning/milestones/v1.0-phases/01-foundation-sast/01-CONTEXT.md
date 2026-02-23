# Phase 1: Foundation & SAST - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish reusable security workflow infrastructure (`security.yaml`) and integrate Semgrep SAST scanning for TypeScript and Python code. Findings appear in GitHub Security tab on PRs and pushes to main. All scans are non-blocking (informational only). This phase sets the SARIF upload patterns and workflow conventions that Phases 2-5 inherit.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation decisions delegated to Claude. Use research findings and existing CI patterns to make sensible choices.

**Workflow structure:**
- Reusable `security.yaml` workflow callable from ci.yaml and nightly.yaml
- Follow existing repo patterns (dorny/paths-filter, job-level permissions, SHA-pinned actions)
- Separate jobs per tool (Semgrep first, others added in later phases)
- Job-level `permissions: security-events: write, contents: read` (least privilege)

**Scan scope & triggers:**
- PRs targeting main: diff-aware Semgrep scan (changed files only)
- Pushes to main: full codebase scan
- Nightly: full scan via existing nightly.yaml calling security.yaml
- Path filtering deferred to Phase 6 optimization (not a v1 requirement)

**Findings visibility:**
- Primary: GitHub Security tab via SARIF upload
- Secondary: Job summary with scan status (success/findings count)
- No PR comment annotations for now (GitHub Security tab handles inline highlighting via SARIF)

**Failure handling:**
- `continue-on-error: true` on scan job so CI never blocks
- If Semgrep itself crashes: job shows as failed but workflow succeeds
- Job summary notes the failure for visibility

**SARIF conventions:**
- Category naming: `semgrep` (single tool, simple name; later phases add `dependency-check`, `trivy`, `scorecard`)
- One SARIF file per tool per run
- Upload via `github/codeql-action/upload-sarif` (SHA-pinned)

**Semgrep configuration:**
- Native Docker container execution (not deprecated semgrep-action)
- `--config auto` ruleset (auto-detects TypeScript, Python, applies community rules)
- `--sarif` output flag
- No SEMGREP_APP_TOKEN (optional, not needed for basic scanning)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches guided by research.

Key research inputs to follow:
- Use native Semgrep Docker container, NOT deprecated semgrep-action wrapper
- SARIF categories must be unique per tool (July 2025 GitHub policy change)
- SHA-pin all Actions (existing repo convention, only 3.9% of repos do this)
- Reusable workflow pattern recommended by architecture research

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-sast*
*Context gathered: 2026-02-23*
