# DevSecOps Tooling Integration

## What This Is

A free, open-source alternative to Veracode's commercial security scanning suite, integrated into the Maxwell's Wallet CI pipeline. Five security tools (Semgrep SAST, OWASP Dependency-Check SCA, OpenSSF Scorecard, Trivy container scanning, OWASP ZAP DAST) run automatically in GitHub Actions and produce visible, non-blocking findings in the GitHub Security tab.

## Core Value

Security scanning tools run automatically in CI and produce visible, actionable findings without breaking any builds.

## Requirements

### Validated

- ✓ Dependabot monitors npm, pip, docker, and github-actions ecosystems weekly — existing
- ✓ pip-audit runs nightly against Python dependencies with auto-issue creation — existing
- ✓ GitHub Actions pinned to SHAs for supply chain security — existing
- ✓ CI pipeline with change detection, frontend/backend/e2e/performance/docker jobs — existing
- ✓ Production Dockerfile builds and pushes to GHCR on main — existing
- ✓ SAST scanning via Semgrep on PRs and pushes to main — v1.0
- ✓ Reusable security.yaml workflow callable from ci.yaml and nightly.yaml — v1.0
- ✓ SARIF upload to GitHub Security tab with unique category convention — v1.0
- ✓ SCA dependency scanning via OWASP Dependency-Check on pushes to main — v1.0
- ✓ Repo security posture scoring via OpenSSF Scorecard on pushes to main — v1.0
- ✓ Container image scanning via Trivy against production Dockerfile — v1.0
- ✓ DAST baseline scanning via OWASP ZAP against ephemeral CI app instance — v1.0
- ✓ README documentation of added tooling and output interpretation — v1.0
- ✓ Formal verification artifacts with 3-source traceability for all 28 requirements — v1.0

### Active

(None — define with `/gsd:new-milestone`)

### Out of Scope

- DefectDojo or any centralized findings dashboard — defer until multiple projects need aggregation
- Rule tuning or false positive suppression — evaluate raw output first (v2 candidate: DAST-V2-03)
- Build gates or merge blocking on findings — informational only (v2 candidate: PIPE-V2-02)
- Mobile or desktop scanning tools — web app only
- Replacing existing Dependabot/pip-audit — additive, not substitutive
- Authenticated ZAP scanning — requires session/JWT configuration (v2 candidate: DAST-V2-01)
- Active ZAP scanning — deeper detection but slower/riskier (v2 candidate: DAST-V2-02)
- SBOM generation — CycloneDX/SPDX format (v2 candidate: CNTR-V2-01)
- Custom Semgrep rules — project-specific patterns (v2 candidate: SAST-V2-01)

## Context

Shipped v1.0 with 33 files changed across GitHub Actions workflows, README documentation, and planning artifacts.

**Tech stack:** GitHub Actions (reusable workflows), Semgrep (native Docker), OWASP Dependency-Check (Docker + NVD caching), OpenSSF Scorecard (OIDC auth), Trivy (container scanning), OWASP ZAP (baseline passive scan).

**SARIF categories in use:** semgrep, dependency-check, scorecard, trivy-container, zap — all unified in GitHub Security tab.

**Known limitations from v1.0:**
- ZAP false positive volume typically 50-200 findings before tuning
- ZAP scans public pages only (no authenticated routes)
- ZAP targets frontend only (backend API not directly scanned)
- NVD API key recommended but optional (graceful degradation)

## Constraints

- **No build gates:** All findings must be informational only. No workflow should cause PR checks or pushes to fail based on security findings.
- **GitHub Actions only:** All tooling runs within GitHub Actions workflows — no external CI systems.
- **SHA-pinned Actions:** All third-party Actions must be pinned to commit SHAs (existing convention in this repo).
- **Ephemeral DAST:** ZAP scans must use an ephemeral Docker Compose environment spun up in CI — no dependency on persistent infrastructure.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Semgrep `auto` ruleset | Auto-detects languages and applies relevant community rules — good starting point before custom rules | ✓ Shipped v1.0 |
| Native Semgrep Docker container | Direct control over CLI flags; semgrep-action wrapper deprecated | ✓ Shipped v1.0 |
| Reusable security.yaml workflow | Single definition called by ci.yaml and nightly.yaml; DRY pattern for adding tools | ✓ Shipped v1.0 |
| OWASP Dep-Check alongside Dependabot | Different databases (NVD vs GitHub Advisory) catch different vulnerabilities — additive coverage | ✓ Shipped v1.0 |
| NVD database caching (24h TTL) | Avoids rate limiting, reduces scan time; optional API key for faster updates | ✓ Shipped v1.0 |
| Isolated Scorecard workflow | OpenSSF API requires strict validation (no env/defaults blocks); separate workflow simpler than shared | ✓ Shipped v1.0 |
| Trivy for container scanning | Lightweight, well-maintained, covers OS packages + app dependencies in container images | ✓ Shipped v1.0 |
| Trivy before buildx (scans all builds) | Positioned before conditional buildx setup so PRs get scanned too, not just main | ✓ Shipped v1.0 |
| ZAP baseline (passive) scan | Passive scan is safe, fast, and doesn't require auth configuration — good first pass | ✓ Shipped v1.0 |
| ZAP on main only | DAST is slow; running only on main prevents PR pipeline slowdown | ✓ Shipped v1.0 |
| Cut DefectDojo from milestone | Overhead of standing up Django + Postgres + Celery not justified until multiple projects need aggregation | ✓ Good |
| Non-blocking execution (all tools) | Security findings should inform but not block development; visibility in Security tab sufficient | ✓ Shipped v1.0 |
| Job-level permissions | Least privilege — only security jobs get security-events: write, not all jobs | ✓ Shipped v1.0 |
| 3-source verification pattern | VERIFICATION.md + SUMMARY.md + REQUIREMENTS.md provides audit-ready traceability | ✓ Shipped v1.0 |

---
*Last updated: 2026-02-23 after v1.0 milestone*
