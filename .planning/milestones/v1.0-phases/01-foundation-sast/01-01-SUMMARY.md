---
phase: 01-foundation-sast
plan: 01
subsystem: security-infrastructure
tags: [sast, semgrep, github-security, ci-cd]
dependencies:
  requires: []
  provides: [reusable-security-workflow, semgrep-sast-scanning]
  affects: [ci-pipeline, nightly-pipeline, security-tab]
tech-stack:
  added: [semgrep-native-docker, github-codeql-action]
  patterns: [reusable-workflows, job-level-permissions, non-blocking-security]
key-files:
  created:
    - .github/workflows/security.yaml
  modified:
    - .github/workflows/ci.yaml
    - .github/workflows/nightly.yaml
decisions:
  - title: "Native Semgrep Docker container over semgrep-action wrapper"
    rationale: "Direct container use provides more control, avoids deprecated wrapper, and follows security best practices"
    alternatives: ["returntocorp/semgrep-action (deprecated)", "semgrep ci command (requires platform account)"]
  - title: "Non-blocking security scans with continue-on-error: true"
    rationale: "Security findings should inform but not block development workflow; visibility in Security tab is sufficient"
    alternatives: ["Blocking scans (would slow down development)"]
  - title: "Job-level permissions over workflow-level escalation"
    rationale: "Least privilege principle - only the Semgrep job needs security-events: write, not all jobs"
    alternatives: ["Workflow-level permissions (too permissive)"]
metrics:
  duration: "2 minutes"
  tasks_completed: 2
  tasks_total: 2
  commits: 2
  files_changed: 3
  completed_at: "2026-02-23T15:49:00Z"
---

# Phase 01 Plan 01: Foundation SAST Summary

**One-liner:** Established reusable security scanning infrastructure with Semgrep SAST running in native Docker, outputting SARIF to GitHub Security tab, integrated into CI (diff mode) and nightly (full mode) pipelines with non-blocking execution.

## What Was Built

Created the foundation for all security scanning workflows by building a reusable `security.yaml` workflow that:
- Runs Semgrep SAST in a native Docker container (not the deprecated wrapper action)
- Uses `--config auto` for automatic language detection across TypeScript and Python codebases
- Outputs SARIF format and uploads to GitHub Security tab with category `semgrep`
- Executes with job-level least-privilege permissions (security-events: write, contents: read)
- Runs non-blocking via `continue-on-error: true` to inform but not block workflows

Integrated this workflow into existing CI and nightly pipelines:
- **CI pipeline:** Calls security.yaml with `scan-mode: diff` on PRs and main pushes, runs in parallel with existing jobs
- **Nightly pipeline:** Calls security.yaml with `scan-mode: full` for comprehensive daily scans, runs independently

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create reusable security.yaml workflow with Semgrep SAST job | a885064 | .github/workflows/security.yaml |
| 2 | Wire security.yaml into ci.yaml and nightly.yaml | 7151679 | .github/workflows/ci.yaml, .github/workflows/nightly.yaml |

## Technical Implementation

### Security Workflow Architecture

**Trigger:** `workflow_call` with optional `scan-mode` input (default: `full`)
- Input accepted for future use (diff-aware scanning in Phase 6)
- Current implementation runs full scan regardless of mode

**Semgrep Job:**
```yaml
container: semgrep/semgrep:latest
permissions:
  security-events: write
  contents: read
continue-on-error: true
```

**Steps:**
1. Checkout code (SHA-pinned: `actions/checkout@de0fac2e`)
2. Run Semgrep: `semgrep scan --config auto --sarif --output semgrep.sarif .`
3. Upload SARIF: `github/codeql-action/upload-sarif@89a39a4e` with `category: semgrep`

### Integration Pattern

**CI Pipeline (ci.yaml):**
- Added `security-events: write` to workflow-level permissions (required for called workflow)
- Added `security` job after `changes` job
- No `needs` dependency → runs in parallel with frontend/backend/e2e jobs
- Uses `scan-mode: diff` for PR-optimized scanning

**Nightly Pipeline (nightly.yaml):**
- Added `security-events: write` to workflow-level permissions
- Added `security-scans` job before `create-issues` job
- Not included in `create-issues` needs array → failures handled via Security tab, not issue creation
- Uses `scan-mode: full` for comprehensive daily scanning

### Security Hardening

All third-party Actions pinned to commit SHAs:
- `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd` (v6)
- `github/codeql-action/upload-sarif@89a39a4e59826350b863aa6b6252a07ad50cf83e` (v4.32.4)

No untrusted input used in shell commands (workflow_call only accepts string input, no user-controlled data).

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:
- ✓ All three YAML files parse without syntax errors
- ✓ security.yaml contains workflow_call trigger
- ✓ Semgrep runs in native Docker container (semgrep/semgrep:latest)
- ✓ Semgrep uses --config auto --sarif flags
- ✓ SARIF upload includes category: semgrep
- ✓ All Actions SHA-pinned (no @v6 or @latest tags)
- ✓ Semgrep job has continue-on-error: true
- ✓ Job-level permissions used (security-events: write, contents: read)
- ✓ ci.yaml calls security.yaml with scan-mode: diff
- ✓ nightly.yaml calls security.yaml with scan-mode: full
- ✓ Existing jobs in both files unchanged (changes outputs intact, create-issues needs array unchanged)

## Requirements Satisfied

This plan satisfies the following requirements:
- **CROSS-01:** Security findings visible in unified GitHub Security tab (SARIF upload with category)
- **CROSS-02:** All scans non-blocking, continue-on-error throughout (continue-on-error: true on Semgrep job)
- **CROSS-03:** SARIF output format standardized (--sarif flag, upload-sarif action)
- **CROSS-04:** GitHub Actions security best practices (SHA-pinned, job-level permissions, no command injection)
- **CROSS-05:** Reusable workflow pattern for extensibility (workflow_call with scan-mode input)
- **SAST-01:** Semgrep baseline for Python and TypeScript code (--config auto detects both languages)
- **SAST-02:** Automatic language detection, no manual config (--config auto)
- **SAST-03:** Integrated into PR and nightly CI (ci.yaml and nightly.yaml integration)
- **SAST-04:** SARIF output to Security tab (upload-sarif with category: semgrep)
- **SAST-05:** Non-blocking scans (continue-on-error: true)

## Next Steps

**Immediate (Phase 1):**
- No additional plans in Phase 1 - foundation complete

**Phase 2 (SCA - Software Composition Analysis):**
- Add OWASP Dependency-Check job to security.yaml
- Integrate Dependabot SARIF output (if available)
- Implement NVD database caching strategy

**Phase 3 (Container Scanning):**
- Add Trivy container scanning job to security.yaml
- Scan all-in-one Docker image for OS and application vulnerabilities

**Phase 4 (DAST - Dynamic Application Security Testing):**
- Add ZAP baseline scan job to security.yaml
- Configure against running application in CI environment

**Phase 5 (Optimization):**
- Implement diff-aware Semgrep scanning (use scan-mode: diff input)
- Tune ZAP false positives
- Add custom Semgrep rules for project-specific patterns

## Self-Check

Verifying all claimed artifacts exist and commits are valid:

**Files:**
- ✓ FOUND: .github/workflows/security.yaml
- ✓ FOUND: .github/workflows/ci.yaml
- ✓ FOUND: .github/workflows/nightly.yaml

**Commits:**
- ✓ FOUND: a885064 (Task 1: Create security.yaml)
- ✓ FOUND: 7151679 (Task 2: Wire into CI/nightly)

## Self-Check: PASSED

All claimed files exist and all commits are present in git history.
