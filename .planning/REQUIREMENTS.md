# Requirements: DevSecOps Tooling Integration

**Defined:** 2026-02-23
**Core Value:** Security scanning tools run automatically in CI and produce visible, actionable findings without breaking any builds.

## v1 Requirements

Requirements for initial milestone. Each maps to roadmap phases.

### SAST (Semgrep)

- [ ] **SAST-01**: Semgrep runs on PRs targeting main and pushes to main, scanning TypeScript and Python code
- [ ] **SAST-02**: Semgrep uses the `auto` ruleset to auto-detect languages and apply community rules
- [ ] **SAST-03**: Semgrep outputs SARIF and uploads to GitHub Security tab with unique category
- [ ] **SAST-04**: Semgrep runs via native Docker container (not deprecated semgrep-action wrapper)
- [ ] **SAST-05**: Semgrep scan is non-blocking — workflow succeeds regardless of findings

### SCA (OWASP Dependency-Check)

- [ ] **SCA-01**: OWASP Dependency-Check scans npm and pip dependencies on pushes to main
- [ ] **SCA-02**: Dependency-Check outputs SARIF and uploads to GitHub Security tab with unique category
- [ ] **SCA-03**: NVD database is cached in CI to avoid rate limiting and reduce scan time
- [ ] **SCA-04**: Dependency-Check scan is non-blocking — workflow succeeds regardless of findings

### Container Scanning (Trivy)

- [ ] **CNTR-01**: Trivy scans the production Docker image after build, before push to GHCR
- [ ] **CNTR-02**: Trivy detects OS package and application dependency vulnerabilities in the image
- [ ] **CNTR-03**: Trivy outputs SARIF and uploads to GitHub Security tab with unique category
- [ ] **CNTR-04**: Trivy scan is non-blocking — workflow succeeds regardless of findings

### Repository Health (OpenSSF Scorecard)

- [ ] **SCORE-01**: OpenSSF Scorecard runs on pushes to main in an isolated workflow
- [ ] **SCORE-02**: Scorecard outputs SARIF and uploads to GitHub Security tab with unique category
- [ ] **SCORE-03**: Scorecard workflow uses required permissions (contents: read, security-events: write, id-token: write)
- [ ] **SCORE-04**: Scorecard scan is non-blocking — workflow succeeds regardless of score

### DAST (OWASP ZAP)

- [ ] **DAST-01**: ZAP baseline (passive) scan runs against an ephemeral Docker Compose app instance in CI
- [ ] **DAST-02**: Docker Compose environment spins up the app with health check before ZAP scan starts
- [ ] **DAST-03**: ZAP produces HTML/Markdown report uploaded as CI artifact
- [ ] **DAST-04**: ZAP scan is non-blocking — workflow succeeds regardless of findings

### Cross-Cutting

- [ ] **CROSS-01**: Security scans are defined in a reusable `security.yaml` workflow callable by ci.yaml and nightly.yaml
- [ ] **CROSS-02**: Each tool's SARIF upload uses a unique category to prevent conflicts (e.g., semgrep, dependency-check, trivy, scorecard)
- [ ] **CROSS-03**: All third-party Actions are pinned to commit SHAs (existing repo convention)
- [ ] **CROSS-04**: Security scan jobs use job-level permissions (least privilege, not workflow-level)
- [ ] **CROSS-05**: All security scans use `continue-on-error: true` to remain informational-only

### Documentation

- [ ] **DOCS-01**: README documents all added security tooling with brief descriptions and output locations
- [ ] **DOCS-02**: README explains how to interpret findings in GitHub Security tab

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### SAST Enhancements

- **SAST-V2-01**: Custom Semgrep rules for Maxwell's Wallet-specific patterns (e.g., JWT handling, SQL injection in ORM)
- **SAST-V2-02**: Cross-file taint analysis via Semgrep Pro features

### SCA Enhancements

- **SCA-V2-01**: Coordinated deduplication between Dependabot and OWASP Dependency-Check alerts
- **SCA-V2-02**: Retired dependency detection and alerting

### Container Enhancements

- **CNTR-V2-01**: SBOM generation in CycloneDX/SPDX format
- **CNTR-V2-02**: Secret detection in Docker image layers
- **CNTR-V2-03**: Dockerfile misconfiguration scanning

### Scorecard Enhancements

- **SCORE-V2-01**: Public Scorecard badge in README
- **SCORE-V2-02**: publish_results for scorecard.dev API visibility

### DAST Enhancements

- **DAST-V2-01**: Authenticated ZAP scanning (with session/JWT configuration)
- **DAST-V2-02**: Active scanning mode for deeper vulnerability detection
- **DAST-V2-03**: False positive tuning via `.zap/rules.tsv` configuration

### Pipeline Enhancements

- **PIPE-V2-01**: Path filtering to skip security scans on translation/docs-only PRs
- **PIPE-V2-02**: Build gates and failure thresholds (graduate from informational to enforcing)
- **PIPE-V2-03**: Severity-based filtering (only surface HIGH/CRITICAL in PR comments)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| DefectDojo findings portal | Overhead of Django + Postgres + Celery not justified until multiple projects need aggregation |
| Rule tuning or false positive suppression | Evaluate raw output first — tuning is v2 after baseline established |
| Build gates or merge blocking | Informational only for this milestone — enforce after team calibrates on findings |
| Mobile or desktop scanning tools | Web app only — CI pipeline targets GitHub Actions |
| Replacing Dependabot or pip-audit | Additive coverage, not substitutive — different databases catch different vulnerabilities |
| Commercial tools | Violates "free Veracode alternative" goal |
| Production runtime scanning | Separate concern from CI scanning |
| Penetration testing integration | Manual activity, not CI automation |
| Auto-remediation PRs | Risky without human review, conflicts with informational mode |
| Custom dashboards | GitHub Security tab is sufficient for this milestone |
| Trend analysis | Requires external tooling and historical data — defer to post-baseline |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| *(populated by roadmapper)* | | |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 (pending roadmap creation)

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after initial definition*
