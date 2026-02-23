# DevSecOps Tooling Integration

## What This Is

An exploratory milestone to build a free, open-source alternative to Veracode's commercial security scanning suite. Integrates SAST, SCA, DAST, and repo health tooling into the Maxwell's Wallet CI pipeline, producing visible but non-blocking security findings. The goal is hands-on evaluation of the open-source security tool ecosystem — learn what's available, what's useful, and what the outputs look like.

## Core Value

Security scanning tools run automatically in CI and produce visible, actionable findings without breaking any builds.

## Requirements

### Validated

- ✓ Dependabot monitors npm, pip, docker, and github-actions ecosystems weekly — existing
- ✓ pip-audit runs nightly against Python dependencies with auto-issue creation — existing
- ✓ GitHub Actions pinned to SHAs for supply chain security — existing
- ✓ CI pipeline with change detection, frontend/backend/e2e/performance/docker jobs — existing
- ✓ Production Dockerfile builds and pushes to GHCR on main — existing
- ✓ SAST scanning via Semgrep on PRs and pushes to main — Phase 1
- ✓ Reusable security.yaml workflow callable from ci.yaml and nightly.yaml — Phase 1
- ✓ SARIF upload to GitHub Security tab with unique category convention — Phase 1

### Active

- [ ] Repo security posture scoring via OpenSSF Scorecard on pushes to main
- [ ] SCA dependency scanning via OWASP Dependency-Check on pushes to main
- [ ] Container image scanning via Trivy against production Dockerfile
- [ ] DAST baseline scanning via OWASP ZAP against ephemeral CI app instance
- [ ] README documentation of added tooling and output interpretation

### Out of Scope

- DefectDojo or any centralized findings dashboard — defer until multiple projects need aggregation
- Rule tuning or false positive suppression — evaluate raw output first
- Build gates or merge blocking on findings — informational only for this milestone
- Mobile or desktop scanning tools — web app only
- Replacing existing Dependabot/pip-audit — additive, not substitutive

## Context

- **Motivation:** Replace Veracode's commercial offering with a free open-source stack. Veracode provides SAST, SCA, DAST, and a findings portal. This milestone covers the first three pillars plus repo health (OpenSSF Scorecard — something Veracode doesn't offer).
- **Existing CI:** Well-structured GitHub Actions with change detection (`dorny/paths-filter`), separate jobs for frontend/backend/e2e/performance/docker, nightly quality checks, and Codecov integration. All Actions already pinned to SHAs.
- **Container images:** Production all-in-one Dockerfile (Node + Python + supervisord) pushes to `ghcr.io` as `:dev` tag on main. Trivy scanning is directly applicable.
- **DAST viability:** The Docker CI job already spins up the app container and runs health checks. ZAP can piggyback on this pattern using an ephemeral Docker Compose environment.
- **SARIF integration:** GitHub's Security tab supports SARIF uploads from multiple tools — Semgrep, Scorecard, and potentially Trivy can all publish there for unified viewing.

## Constraints

- **No build gates:** All findings must be informational only. No workflow should cause PR checks or pushes to fail based on security findings.
- **GitHub Actions only:** All tooling runs within GitHub Actions workflows — no external CI systems.
- **SHA-pinned Actions:** All third-party Actions must be pinned to commit SHAs (existing convention in this repo).
- **Ephemeral DAST:** ZAP scans must use an ephemeral Docker Compose environment spun up in CI — no dependency on persistent infrastructure.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Semgrep `auto` ruleset | Auto-detects languages and applies relevant community rules — good starting point before custom rules | ✓ Shipped Phase 1 |
| Native Semgrep Docker container | Direct control over CLI flags; semgrep-action wrapper deprecated | ✓ Shipped Phase 1 |
| Reusable security.yaml workflow | Single definition called by ci.yaml and nightly.yaml; DRY pattern for adding tools | ✓ Shipped Phase 1 |
| OWASP Dep-Check alongside Dependabot | Different databases (NVD vs GitHub Advisory) catch different vulnerabilities — additive coverage | — Pending |
| Trivy for container scanning | Lightweight, well-maintained, covers OS packages + app dependencies in container images | — Pending |
| ZAP baseline (passive) scan | Passive scan is safe, fast, and doesn't require auth configuration — good first pass | — Pending |
| Cut DefectDojo from milestone | Overhead of standing up Django + Postgres + Celery not justified until multiple projects need aggregation | ✓ Good |

---
*Last updated: 2026-02-23 after Phase 1*
