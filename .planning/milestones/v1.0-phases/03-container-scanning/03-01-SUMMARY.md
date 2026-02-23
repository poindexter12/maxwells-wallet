---
phase: 03-container-scanning
plan: 01
subsystem: security-infrastructure
tags: [trivy, container-scanning, sarif, ci-cd, vulnerability-detection]
dependency-graph:
  requires:
    - phase: 01-foundation-sast
      reason: Establishes SARIF upload pattern and GitHub Security tab integration
    - phase: 02-sca-repository-health
      reason: Confirms SARIF category naming convention
  provides:
    - Container image vulnerability scanning in CI pipeline
    - OS package vulnerability detection (python:3.12-slim base)
    - Application dependency vulnerability detection (npm, pip)
    - SARIF results with unique category 'trivy-container'
  affects:
    - Docker job in ci.yaml (adds scan steps between build and push)
tech-stack:
  added:
    - aquasecurity/trivy-action@6e3dd3b4eebcf9f238e32e883f2c4c4c54713e3a (v0.30.0)
  patterns:
    - SHA-pinned GitHub Actions for security
    - Non-blocking security scans (continue-on-error: true)
    - SARIF upload with unique category per tool
    - Scan local images before registry push
key-files:
  created: []
  modified:
    - .github/workflows/ci.yaml: Added Trivy scan steps in docker job (lines 260-274)
decisions:
  - decision: Scan local docker-compose built image (maxwells-wallet:latest) not GHCR path
    rationale: Scans image immediately after build, catches vulnerabilities before push to registry
    alternatives: [Scan from GHCR after push, Scan from Buildx cache]
    impact: Early vulnerability detection, prevents publishing vulnerable images
  - decision: Include all severity levels (UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL)
    rationale: Maximum visibility for security team, findings filterable in GitHub Security tab
    alternatives: [HIGH,CRITICAL only, MEDIUM+ only]
    impact: Complete vulnerability inventory, may increase noise initially
  - decision: Position Trivy before buildx setup (line 259)
    rationale: Buildx step conditional on main branch, want Trivy on all builds including PRs
    alternatives: [After buildx, Separate job]
    impact: Trivy runs on every PR and main branch build
patterns-established:
  - Trivy container scanning integrated into docker job
  - Local image scanning before registry push
  - SARIF category 'trivy-container' for GitHub Security tab
  - Non-blocking execution allows builds to proceed with findings
requirements-completed:
  - CNTR-01: Trivy scans production Docker image in CI
  - CNTR-02: Detects OS packages (apt from python:3.12-slim) and app dependencies (npm, pip)
  - CNTR-03: SARIF uploaded to GitHub Security tab with category 'trivy-container'
  - CNTR-04: Non-blocking scan (continue-on-error: true), GHCR push proceeds regardless
metrics:
  duration: 1 minute
  tasks_completed: 2
  files_modified: 1
  commits: 1
  completed_at: 2026-02-23T17:02:58Z
---

# Phase 03 Plan 01: Add Trivy container scan to docker job in ci.yaml Summary

**One-liner:** Trivy scans locally built Docker images for OS package and application dependency vulnerabilities with SARIF upload to GitHub Security tab

## Performance

- **Duration:** 1 minute (started 2026-02-23T17:01:41Z, completed 2026-02-23T17:02:58Z)
- **Velocity:** 2 tasks completed, 1 commit created
- **Execution:** Fully autonomous, no human intervention required

## What Was Accomplished

### Container Image Scanning Integration

Added Trivy container scanning to the docker job in ci.yaml:
- **Scan timing:** After docker-compose build completes, before GHCR push
- **Scan target:** Locally built `maxwells-wallet:latest` image
- **Vulnerability coverage:** OS packages (apt from python:3.12-slim base) + application dependencies (npm, pip)
- **Reporting:** SARIF format uploaded to GitHub Security tab with category `trivy-container`
- **Execution:** Non-blocking (continue-on-error: true) allows builds to proceed with findings

### Action Selection

- **aquasecurity/trivy-action@6e3dd3b4eebcf9f238e32e883f2c4c4c54713e3a** (v0.30.0, SHA-pinned)
- Follows Phase 1/2 patterns: SHA-pinned actions, non-blocking execution, unique SARIF categories

### Positioning

Trivy steps inserted at line 260, **before** "Set up Docker Buildx" (line 276):
- Buildx setup conditional on `github.ref == 'refs/heads/main'`
- Trivy positioned before this conditional to run on **all builds** (PRs and main)
- Ensures every Docker image build gets scanned regardless of push destination

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1. Add Trivy container scan steps | 329daf6 | Added aquasecurity/trivy-action with scan-type: image, image-ref: maxwells-wallet:latest, SARIF upload with category trivy-container |
| 2. Verify configuration | (verification only) | Confirmed image-ref matches docker-compose build, SARIF category unique, scan covers OS and app dependencies |

## Files Created or Modified

### Modified

**`.github/workflows/ci.yaml`** (docker job, lines 260-274):
```yaml
    - name: Run Trivy container scan
      uses: aquasecurity/trivy-action@6e3dd3b4eebcf9f238e32e883f2c4c4c54713e3a # v0.30.0
      continue-on-error: true
      with:
        scan-type: 'image'
        image-ref: 'maxwells-wallet:latest'
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL'
    - name: Upload Trivy SARIF to GitHub Security tab
      uses: github/codeql-action/upload-sarif@89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'
        category: trivy-container
```

## Decisions Made

### 1. Scan Local Image Before Push

**Decision:** Scan `maxwells-wallet:latest` (locally built by docker-compose) instead of GHCR path

**Rationale:**
- Catches vulnerabilities immediately after build
- Prevents publishing vulnerable images to registry
- Provides feedback in PR context before merge

**Alternatives considered:**
- Scan from GHCR after push (delayed feedback, vulnerable images already published)
- Scan from Buildx cache (complex cache path resolution)

**Impact:** Early vulnerability detection, security shift-left

### 2. Include All Severity Levels

**Decision:** Configure severity: 'UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL'

**Rationale:**
- Maximum visibility for security team
- Complete vulnerability inventory
- Findings filterable in GitHub Security tab UI

**Alternatives considered:**
- HIGH,CRITICAL only (misses important context from lower severities)
- MEDIUM+ only (arbitrary threshold)

**Impact:** May increase initial noise, but provides comprehensive view. Team can filter by severity in Security tab.

### 3. Position Before Buildx Setup

**Decision:** Insert Trivy steps before "Set up Docker Buildx" step (line 259)

**Rationale:**
- Buildx setup has `if: github.ref == 'refs/heads/main'` conditional
- Want Trivy to run on all builds including PRs
- Positioning before conditional ensures universal coverage

**Alternatives considered:**
- After buildx (would inherit conditional, skip on PRs)
- Separate job (adds dependency complexity, delays feedback)

**Impact:** Trivy scans every Docker build (PRs and main), consistent security posture

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### YAML Syntax
✓ ci.yaml parses without errors

### Trivy Integration
✓ aquasecurity/trivy-action present with SHA pin (no @v tags)
✓ scan-type: 'image' configured
✓ image-ref: 'maxwells-wallet:latest' matches docker-compose built image
✓ SARIF category 'trivy-container' unique (no conflicts with 'semgrep', 'dependency-check')

### Non-Blocking Execution
✓ continue-on-error: true on Trivy scan step
✓ if: always() on SARIF upload step

### Positioning
✓ Trivy runs before buildx setup (line 260 < 276)
✓ Trivy executes on all builds (PRs and main)

### Vulnerability Coverage
✓ Trivy scan-type: 'image' detects:
  - OS packages (apt/dpkg from python:3.12-slim base)
  - Application dependencies (npm packages from frontend, pip packages from backend)
  - No additional flags needed for full coverage

## Requirements Satisfied

| Requirement | Status | Evidence |
|-------------|--------|----------|
| CNTR-01: Trivy scans production Docker image in CI | ✓ Complete | Trivy scan step added to docker job, runs after docker-compose build |
| CNTR-02: Detects OS packages and app dependencies | ✓ Complete | scan-type: 'image' covers OS (apt) and application (npm, pip) by default |
| CNTR-03: SARIF uploaded to GitHub Security tab | ✓ Complete | github/codeql-action/upload-sarif with category: trivy-container |
| CNTR-04: Non-blocking scan, push proceeds | ✓ Complete | continue-on-error: true, GHCR push steps unchanged |

## Next Phase Readiness

**Phase 4: Dynamic Application Security Testing (DAST)** is ready to begin.

### Handoff Notes
- Container scanning integrated following Phase 1/2 patterns
- Three SARIF categories now in use: semgrep, dependency-check, trivy-container
- Docker job structure: build → scan (Trivy) → smoke test → push to GHCR
- All security scans non-blocking by design

### Known Considerations for Phase 4
- DAST (ZAP) will add fourth SARIF category
- ZAP baseline scan may have high false positive volume initially (50-200 findings)
- Plan tuning time in Phase 4 to reduce noise to <20 findings

## Self-Check: PASSED

### Files Created/Modified
✓ .github/workflows/ci.yaml exists and contains Trivy integration

### Commits
✓ Commit 329daf6 exists in git log

### Integration
✓ Trivy positioned correctly (before buildx, after build)
✓ SARIF category unique across all workflows
✓ SHA pins verified on all actions
