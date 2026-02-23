# Roadmap: DevSecOps Tooling Integration

## Overview

This roadmap delivers a free, open-source alternative to Veracode's commercial security scanning suite by integrating five security tools into the Maxwell's Wallet CI pipeline. The journey progresses from foundational patterns (SARIF workflows, cross-cutting infrastructure) through static analysis (SAST, SCA, repository health), container scanning, dynamic analysis (DAST), and finally documentation. Each phase delivers visible but non-blocking security findings to the GitHub Security tab, building toward comprehensive DevSecOps coverage.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & SAST** - Establish SARIF workflows and Semgrep code scanning (completed 2026-02-23)
- [x] **Phase 2: SCA & Repository Health** - Dependency scanning and OpenSSF Scorecard integration (completed 2026-02-23)
- [ ] **Phase 3: Container Scanning** - Trivy image vulnerability detection
- [ ] **Phase 4: DAST** - OWASP ZAP baseline scanning against running application
- [ ] **Phase 5: Documentation** - README updates for tooling and findings interpretation
- [ ] **Phase 6: Formal Verification Sweep** - Create VERIFICATION.md for Phases 2-5 (gap closure)

## Phase Details

### Phase 1: Foundation & SAST
**Goal**: Developers see Semgrep SAST findings in GitHub Security tab on every PR and push to main, with reusable security workflow infrastructure established
**Depends on**: Nothing (first phase)
**Requirements**: CROSS-01, CROSS-02, CROSS-03, CROSS-04, CROSS-05, SAST-01, SAST-02, SAST-03, SAST-04, SAST-05
**Success Criteria** (what must be TRUE):
  1. Reusable security.yaml workflow exists and is callable from ci.yaml and nightly.yaml
  2. Semgrep scans TypeScript and Python code on PRs and pushes to main using native Docker container
  3. Semgrep findings appear in GitHub Security tab with unique category identifier (no SARIF conflicts)
  4. All third-party Actions are pinned to commit SHAs following repo convention
  5. Semgrep scans complete successfully without blocking PR checks (continue-on-error: true)
**Plans:** 1/1 plans complete

Plans:
- [x] 01-01-PLAN.md — Create security.yaml reusable workflow with Semgrep SAST and wire into CI/nightly

### Phase 2: SCA & Repository Health
**Goal**: Developers see dependency vulnerabilities from OWASP Dependency-Check and repository security posture score from OpenSSF Scorecard in GitHub Security tab
**Depends on**: Phase 1
**Requirements**: SCA-01, SCA-02, SCA-03, SCA-04, SCORE-01, SCORE-02, SCORE-03, SCORE-04
**Success Criteria** (what must be TRUE):
  1. OWASP Dependency-Check scans npm and pip lockfiles on pushes to main with NVD database caching
  2. Dependency-Check findings appear in GitHub Security tab with unique category (coordinated with existing Dependabot alerts)
  3. OpenSSF Scorecard runs in isolated workflow on pushes to main
  4. Scorecard results appear in GitHub Security tab showing repository security posture metrics
  5. Both scans complete successfully without blocking builds (non-blocking mode)
**Plans**: 2/2 plans complete

Plans:
- [x] 02-01-PLAN.md — Add OWASP Dependency-Check to security.yaml with NVD caching and dual-language scanning
- [x] 02-02-PLAN.md — Create isolated scorecard.yaml workflow with publish_results compliance

### Phase 3: Container Scanning
**Goal**: Production Docker images are scanned for OS package and application dependency vulnerabilities before push to GHCR
**Depends on**: Phase 2
**Requirements**: CNTR-01, CNTR-02, CNTR-03, CNTR-04
**Success Criteria** (what must be TRUE):
  1. Trivy scans the production Docker image after build completes in the docker CI job
  2. Trivy detects vulnerabilities in both OS packages and application dependencies within the image
  3. Trivy findings appear in GitHub Security tab with unique category identifier
  4. Docker images are pushed to GHCR regardless of Trivy findings (non-blocking scan)
**Plans**: 1 plan

Plans:
- [ ] 03-01-PLAN.md — Add Trivy container scan to docker job in ci.yaml with SARIF upload

### Phase 4: DAST
**Goal**: Running application is scanned for runtime vulnerabilities via OWASP ZAP baseline scan in ephemeral CI environment
**Depends on**: Phase 3
**Requirements**: DAST-01, DAST-02, DAST-03, DAST-04
**Success Criteria** (what must be TRUE):
  1. Docker Compose environment spins up Maxwell's Wallet app in CI with health check validation
  2. OWASP ZAP baseline (passive) scan runs against the ephemeral app instance
  3. ZAP produces HTML and Markdown reports uploaded as CI artifacts for review
  4. ZAP scan completes successfully without blocking workflow (informational only)
**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md — Create dast.yaml workflow with Docker Compose orchestration and ZAP baseline scan

### Phase 5: Documentation
**Goal**: Developers and stakeholders understand what security tooling runs, where to find findings, and how to interpret results
**Depends on**: Phase 4
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. README documents all five security tools (Semgrep, Dependency-Check, Trivy, Scorecard, ZAP) with brief descriptions
  2. README explains how to access and interpret findings in GitHub Security tab
  3. Documentation is accurate and reflects the actual workflow implementations from Phases 1-4
**Plans**: 1 plan

Plans:
- [ ] 05-01-PLAN.md — Add Security Tools section to README documenting all five scanning tools with access instructions

### Phase 6: Formal Verification Sweep
**Goal**: All 28 v1 requirements formally verified with VERIFICATION.md artifacts, closing procedural gaps from milestone audit
**Depends on**: Phase 5
**Requirements**: SCA-01, SCA-02, SCA-03, SCA-04, SCORE-01, SCORE-02, SCORE-03, SCORE-04, CNTR-01, CNTR-02, CNTR-03, CNTR-04, DAST-01, DAST-02, DAST-03, DAST-04, DOCS-01, DOCS-02
**Gap Closure:** Closes procedural gaps from v1 milestone audit (missing VERIFICATION.md for Phases 2–5)
**Success Criteria** (what must be TRUE):
  1. Phase 2 has VERIFICATION.md confirming SCA and Scorecard requirements satisfied
  2. Phase 3 has VERIFICATION.md confirming Container Scanning requirements satisfied
  3. Phase 4 has VERIFICATION.md confirming DAST requirements satisfied
  4. Phase 5 has VERIFICATION.md confirming Documentation requirements satisfied
  5. All 28 v1 requirements have 3-source verification (VERIFICATION.md + SUMMARY + REQUIREMENTS.md)
**Plans**: 0 plans

Plans:
- [ ] 06-01-PLAN.md — Run formal verification for Phases 2–5 and create VERIFICATION.md artifacts

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & SAST | 1/1 | Complete   | 2026-02-23 |
| 2. SCA & Repository Health | 2/2 | Complete | 2026-02-23 |
| 3. Container Scanning | 0/1 | Planning complete | - |
| 4. DAST | 0/1 | Planning complete | - |
| 5. Documentation | 0/1 | Planning complete | - |
| 6. Formal Verification Sweep | 0/1 | Pending | - |
