# Research Summary: DevSecOps Security Scanning Integration

**Domain:** CI/CD Security Scanning for Full-Stack Web Applications
**Researched:** 2026-02-23
**Overall confidence:** HIGH

## Executive Summary

The 2026 landscape for open-source security scanning in GitHub Actions provides a mature, free alternative to commercial tools like Veracode. The recommended stack centers on five core tools: Semgrep (SAST), OWASP Dependency-Check (SCA), Trivy (container scanning), OWASP ZAP (DAST), and OpenSSF Scorecard (repository health). All support SARIF output for unified GitHub Security tab integration.

Critical discovery: The deprecated semgrep-action wrapper must be avoided; native Semgrep Docker container integration is now the official approach. SHA pinning of GitHub Actions is essential (only 3.9% of repositories do this correctly), with Dependabot/Renovate automation to maintain pins. OWASP Dependency-Check requires an NVD API key to avoid severe rate limiting. GitHub Advanced Security license is required for SARIF uploads to private repositories.

The integration architecture follows a reusable workflow pattern: security.yaml defines scanning jobs (called by ci.yaml for PRs and nightly.yaml for scheduled scans). Each tool uploads SARIF with unique category identifiers to prevent result collisions. The most critical pitfall is SARIF category conflicts (GitHub changed behavior in July 2025 to reject duplicate categories). Implementation should proceed in phases: SAST foundation first (low complexity, no build dependencies), then SCA, container scanning, and finally DAST (highest complexity, requires running application).

This stack provides comprehensive coverage at zero licensing cost (for public repos), making it a viable Veracode alternative for the Maxwell's Wallet project. The main trade-off is configuration complexity and initial tuning effort (especially for ZAP false positives), but ROI is high given the project's existing mature CI pipeline and DevSecOps readiness.

## Key Findings

**Stack:** Semgrep (native Docker) + OWASP Dependency-Check + Trivy + OWASP ZAP + OpenSSF Scorecard, all outputting SARIF to GitHub Security tab via upload-sarif action with unique categories.

**Architecture:** Reusable security.yaml workflow pattern with job-level permissions (security-events: write), separate workflows for Scorecard due to strict requirements, Docker image scanning post-build pre-push using Trivy.

**Critical pitfall:** SARIF category conflicts cause silent data loss or upload failures (GitHub changed behavior July 2025); must assign unique category to each tool's upload-sarif action.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: SAST Foundation (Semgrep)** - Foundation for code-level vulnerability detection
   - Addresses: Table stakes SAST coverage for TypeScript and Python
   - Avoids: SARIF category conflicts (establish convention before adding more tools)
   - Complexity: Low-Medium (native Docker container, SARIF output built-in)
   - Dependencies: None (standalone analysis)
   - Estimated effort: 1 sprint

2. **Phase 2: SCA Integration (OWASP Dependency-Check)** - Blocks vulnerable dependencies
   - Addresses: Table stakes dependency scanning, complements existing Dependabot alerts
   - Avoids: NVD rate limiting pitfall (implement caching + API key from start)
   - Complexity: Medium (SARIF conversion, caching strategy)
   - Dependencies: NVD API key (free, 1-2 day approval)
   - Estimated effort: 1 sprint

3. **Phase 3: Container Scanning (Trivy)** - Prevents shipping vulnerable Docker images
   - Addresses: Table stakes container security for production deployments
   - Avoids: Docker buildx visibility issues (add --load flag), overlapping SCA alerts (coordinate with Dependency-Check)
   - Complexity: Low-Medium (native SARIF, existing Docker build job)
   - Dependencies: Requires docker job completion (serial dependency)
   - Estimated effort: 0.5 sprint

4. **Phase 4: Repository Health (OpenSSF Scorecard)** - Tracks supply chain security posture
   - Addresses: Differentiator feature (few teams do this), low-effort high-visibility
   - Avoids: Scorecard workflow restrictions (create isolated workflow, not embedded in existing)
   - Complexity: Low (zero config for public repos)
   - Dependencies: None (optional publish_results requires id-token: write permission)
   - Estimated effort: 0.5 sprint

5. **Phase 5: DAST Integration (OWASP ZAP Baseline)** - Detects runtime vulnerabilities
   - Addresses: Differentiator feature (most teams skip DAST in CI)
   - Avoids: ZAP false positive pitfall (allocate 2-3 sprints for tuning), production scanning mistakes
   - Complexity: High (requires running app, extensive rule tuning)
   - Dependencies: Docker Compose setup in CI, isolated test environment
   - Estimated effort: 2-3 sprints (includes tuning)

6. **Phase 6: Optimization & Tuning** - Performance and noise reduction
   - Addresses: Path filtering for faster CI, false positive suppression, scheduled scan optimization
   - Avoids: continue-on-error blind spots (use severity thresholds instead)
   - Complexity: Medium (workflow logic, organizational policy decisions)
   - Dependencies: Baseline from Phases 1-5 to measure optimization impact
   - Estimated effort: 1-2 sprints (ongoing)

**Phase ordering rationale:**
- SAST first: No build dependencies, works standalone, establishes SARIF upload patterns
- SCA second: Low overhead (scans lockfiles), high impact (80% of vulns from dependencies)
- Container third: Depends on Docker build job, natural extension of existing pipeline
- Scorecard fourth: Easy win (zero config), builds confidence before complex DAST
- DAST last: Requires running app, highest tuning effort, deferred to nightly scans initially
- Optimization continuous: Improves UX incrementally based on real usage patterns

**Research flags for phases:**
- Phase 2 (SCA): Likely needs deeper research on NVD caching strategies and Dependabot coordination
- Phase 5 (DAST): Definitely needs deeper research on ZAP API scanning (no spider) and auth configuration
- Phase 6 (Optimization): May need research on GitHub Actions path filtering performance impact

**Defer to post-MVP:**
- ZAP Full Scan (active attacks, requires owned infrastructure, >30 min runtime)
- Multi-format reporting beyond SARIF (JSON/HTML exports for compliance)
- Custom Semgrep rules (organization-specific security patterns)
- Reachability analysis (not available in free tools)
- Trend analysis dashboards (requires external tooling)

**Out of scope:**
- Commercial SAST/DAST tools (violates "free Veracode alternative" goal)
- Auto-remediation (risky without human review, conflicts with informational mode)
- Production runtime scanning (separate concern from CI scanning)
- Penetration testing integration (manual activity, not CI automation)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official documentation verified for all five tools; current versions confirmed (Trivy 0.34.0 Feb 2026, Scorecard 2.4.3 Sep 2025, ZAP 0.15.0 Oct 2025); Semgrep deprecation of wrapper action verified |
| Features | HIGH | SARIF integration requirements well-documented; GitHub Security tab workflows confirmed; tool capabilities verified via official docs; "free Veracode alternative" goal achievable |
| Architecture | HIGH | Reusable workflow pattern confirmed in official GitHub docs; SARIF category requirements verified from July 2025 changelog; permissions model validated; phasing dependencies mapped |
| Pitfalls | HIGH | Critical pitfalls sourced from official GitHub docs (SARIF conflicts, GHAS licensing, permissions); moderate pitfalls from verified community sources (ZAP false positives, NVD rate limiting); SHA pinning statistics from security research (3.9% adoption) |

## Gaps to Address

**Unresolved during research:**
1. Exact commit SHA for ossf/scorecard-action@v2.4.3 (found v2.4.0 SHA: 62b2cac, but v2.4.3 release page not retrieved; recommend manual verification before pinning)
2. OWASP Dependency-Check @main tag vs SHA pinning (action uses @main, not versioned releases; requires manual SHA lookup from latest commit)
3. ZAP baseline action SARIF output (documentation mentions SARIF support but not in baseline action by default; may require YAML automation framework or post-processing)

**Topics needing phase-specific research later:**
- Phase 2: Dependency-Check caching implementation for GitHub Actions (official cache action integration patterns)
- Phase 5: ZAP API scanning configuration (OpenAPI/Swagger import vs spider for API-only backends)
- Phase 5: ZAP authenticated scanning setup (auth headers, session management for protected endpoints)
- Phase 6: Path filtering strategy for frontend/backend split (existing dorny/paths-filter integration points)
- Phase 6: Severity threshold policies (organizational decision on what blocks PRs vs informs)

**Assumptions requiring validation:**
- Maxwell's Wallet repository is public (SARIF upload free; private requires GHAS license - confirm before planning)
- Docker build job exists and pushes to GHCR (confirmed in project context; verify image tagging strategy for Trivy scanning)
- Backend has OpenAPI/Swagger spec (preferred for ZAP API scanning; if missing, may need spider-based approach)
- Existing Dependabot configuration will be kept (coordinate with OWASP Dependency-Check to avoid duplicate alerts)

**Risk areas flagged for deeper investigation:**
- SARIF file size limits with current codebase size (test with production-scale scan before Phase 1 completion)
- CI minute consumption impact (estimate full suite runtime: Semgrep ~2-5 min, Dependency-Check ~5-10 min, Trivy ~1-2 min, Scorecard ~1 min, ZAP ~10-30 min)
- ZAP false positive volume (allocate dedicated tuning sprint in Phase 5; industry average: 50-200 findings before tuning, target <20 after)

## Recommendations for Implementation

**Before Phase 1:**
1. Verify repository visibility (public vs private) to confirm SARIF upload licensing
2. Request NVD API key (https://nvd.nist.gov/developers/request-an-api-key) — 1-2 day approval process
3. Look up exact commit SHAs for actions before pinning (ossf/scorecard-action@v2.4.3, dependency-check/Dependency-Check_Action@main)
4. Test SARIF upload with minimal example (upload-sarif with dummy SARIF file) to validate permissions

**Phase 1 Critical Success Factors:**
- Establish SARIF category naming convention (document in .github/CONTRIBUTING.md or workflow comments)
- Configure Dependabot/Renovate for SHA-pinned action updates (prevents maintenance burden)
- Set job-level permissions (not workflow-level) for least privilege
- Create reusable security.yaml workflow (don't embed in ci.yaml)

**Phase 2-4 Optimization:**
- Implement NVD database caching with 24h TTL (GitHub Actions cache action)
- Add path filters to skip security scans on translation/documentation-only PRs
- Coordinate Dependabot with OWASP Dependency-Check (disable one or filter alerts)

**Phase 5 DAST Preparation:**
- Allocate 2-3 sprints for ZAP tuning (not just implementation)
- Set up isolated test environment (Docker Compose with test fixtures, not production)
- Start with baseline scan (passive), defer full scan (active attacks) to post-MVP
- Create .zap/rules.tsv for false positive suppressions (version controlled, documented)

**Continuous Monitoring:**
- Track SARIF upload success rate (alert on failures)
- Monitor scan completion times (optimize if >10 min total suite runtime)
- Review Security tab weekly (triage new findings, validate tool coverage)
- Update SHA pins monthly (Dependabot PRs) or when CVEs disclosed in actions

## Success Metrics

**Phase 1 (SAST):** Semgrep findings appear in GitHub Security tab for TypeScript and Python code with category=semgrep-{language}

**Phase 2 (SCA):** Dependency-Check blocks PRs with HIGH/CRITICAL vulnerable dependencies; NVD database updates complete in <5 min

**Phase 3 (Container):** Trivy scans Docker images post-build pre-push; no vulnerable images reach GHCR

**Phase 4 (Repo Health):** OpenSSF Scorecard results publish to scorecard.dev (if public repo) with baseline score; tracking improvement over time

**Phase 5 (DAST):** ZAP baseline scan completes in <15 min with <20 findings (after tuning); no health check false positives

**Phase 6 (Optimization):** Security suite total runtime <15 min for PRs; documentation-only PRs skip scans; <5% false positive rate across all tools

**Overall (Free Veracode Alternative):** All five security dimensions covered (SAST/SCA/container/DAST/repo-health); unified SARIF dashboard in GitHub Security tab; zero licensing costs; comprehensive vulnerability detection before deployment.

---
*Research summary for: DevSecOps CI Security Scanning Integration*
*Researched: 2026-02-23*
*Next steps: Verify repository visibility, request NVD API key, look up missing commit SHAs*
