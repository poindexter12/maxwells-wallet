# Phase 3 Planning Complete

**Phase:** 03-container-scanning
**Planned:** 2026-02-23
**Commit:** 39724cd

## Summary

Created 1 plan for Phase 3: Container Scanning

## Plans Created

| Plan | Objective | Tasks | Wave | Files |
|------|-----------|-------|------|-------|
| 03-01 | Add Trivy container scan to docker job in ci.yaml with SARIF upload | 2 | 1 | .github/workflows/ci.yaml |

## Wave Structure

| Wave | Plans | Autonomous |
|------|-------|------------|
| 1 | 03-01 | yes |

## Plan Details

### 03-01: Add Trivy Container Scan

**Requirements:** CNTR-01, CNTR-02, CNTR-03, CNTR-04

**Tasks:**
1. Add Trivy container scan steps to docker job in ci.yaml
   - Insert Trivy scan after "Build all-in-one image" step
   - Scan image-ref: 'maxwells-wallet:latest' (locally built image)
   - Upload SARIF with category 'trivy-container'
   - Use aquasecurity/trivy-action@6e3dd3b (SHA-pinned)
   - Non-blocking execution (continue-on-error: true)

2. Verify Trivy detects OS and application vulnerabilities
   - Confirm image-ref matches docker-compose service
   - Verify SARIF category uniqueness
   - Validate scan-type: 'image' detects both OS and app deps

**Must-haves (goal-backward verification):**
- Truths:
  - Trivy scans locally built Docker image after build
  - Trivy detects OS packages and application dependencies
  - Findings appear in GitHub Security tab with category 'trivy-container'
  - GHCR push proceeds regardless of findings
- Artifacts:
  - .github/workflows/ci.yaml with Trivy scan steps in docker job
- Key links:
  - docker job → aquasecurity/trivy-action (scan step)
  - docker job → github/codeql-action/upload-sarif (SARIF upload)
  - Trivy → maxwells-wallet:latest (local image)

**Estimated context:** ~30-40% (straightforward integration following Phase 1/2 patterns)

## Integration Strategy

Trivy integrates into existing docker job (NOT security.yaml) because:
- Needs access to locally built Docker image
- Runs after docker-compose build completes
- Logically belongs with Docker build/push operations
- Follows pattern: build → scan → push

## Patterns Applied

Following Phase 1/2 conventions:
- SHA-pinned actions (aquasecurity/trivy-action@6e3dd3b, codeql-action@89a39a4e)
- Job-level permissions (docker job already has packages: write)
- Non-blocking execution (continue-on-error: true)
- Unique SARIF category ('trivy-container')
- Upload on failure (if: always())

## Next Steps

Execute: `/gsd:execute-phase 03`

<sub>`/clear` first - fresh context window</sub>
