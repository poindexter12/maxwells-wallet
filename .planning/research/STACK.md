# Technology Stack: DevSecOps Security Scanning

**Project:** Maxwell's Wallet - Security Scanning Integration
**Researched:** 2026-02-23
**Confidence:** HIGH

## Recommended Stack

### SAST (Static Application Security Testing)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Semgrep | Native Docker image | Code analysis for Python & TypeScript | Official Semgrep support via Docker container (semgrep/semgrep). The deprecated semgrep-action wrapper should not be used. Native integration provides better SARIF output and GitHub Code Scanning integration. Free tier includes auto ruleset. |
| github/codeql-action/upload-sarif | v3 (latest major) | Upload SARIF results to GitHub Security | Standard GitHub-native action for uploading SARIF files to Code Scanning dashboard. Required for displaying Semgrep, Trivy, and other SARIF-format results in GitHub's security tab. |

### SCA (Software Composition Analysis)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OWASP Dependency-Check | dependency-check/Dependency-Check_Action@main | Vulnerability scanning for dependencies | OWASP Flagship Project, actively maintained (v12.2.0 as of 2026-01-09). Scans both npm and pip dependencies. Native SARIF output for GitHub integration. Uses nightly-updated vulnerability database from NVD. |

### Container Scanning

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Trivy | aquasecurity/trivy-action@0.34.0 | Container image vulnerability scanning | Industry-standard scanner from Aqua Security. Scans for CVEs, misconfigurations, secrets, and SBOMs. Built-in caching (enabled by default) prevents NVD rate limiting. Native SARIF output. Supports Docker images, filesystems, and IaC configs. Latest version: 0.34.0 (Feb 12, 2026). |

### DAST (Dynamic Application Security Testing)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OWASP ZAP | zaproxy/action-baseline@v0.15.0 | Dynamic web application security testing | Official OWASP action for passive/baseline scanning. Free and open source (Apache 2.0). Version 0.15.0 (Oct 24, 2025) includes node24 runtime. Baseline scan is non-invasive (passive only). Full scan (zaproxy/action-full-scan) available for deeper testing but requires permission to attack target. SARIF output supported. |

### Repository Security Posture

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OpenSSF Scorecard | ossf/scorecard-action@v2.4.3 | Repository security health metrics | Official OpenSSF action. Evaluates supply chain security practices (dependency pinning, branch protection, signed releases, etc.). Free for public repos. Supports SARIF output for GitHub Code Scanning. Version 2.4.3 (Sep 30, 2025) includes improved error annotations and file_mode option. |

## Configuration Recommendations

### SHA Pinning for Security

**CRITICAL:** All third-party GitHub Actions must be pinned to full-length commit SHAs, not tags or version numbers. Tags are mutable and vulnerable to supply chain attacks.

**Format:**
```yaml
- uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332 # v4.1.7
```

**Rationale:** Only 3.9% of repositories pin 100% of their Actions to SHAs. Pinning to commit SHAs is the only immutable way to reference an action. Tags can be moved or deleted if an attacker compromises the action's repository.

**Automation:** Use Dependabot or Renovate to track pinned SHAs and create PRs when actions are updated.

**Recommended SHA pins for current versions:**
- aquasecurity/trivy-action@0.34.0 → SHA: c1824fd (Feb 12, 2026)
- ossf/scorecard-action@v2.4.3 → SHA: 62b2cac (verify current)
- zaproxy/action-baseline@v0.15.0 → SHA: de8ad96 (Oct 24, 2025)

### SARIF Output Configuration

All tools should output to SARIF format and upload to GitHub Code Scanning for unified security dashboard:

**Semgrep:**
```yaml
container:
  image: semgrep/semgrep
run: semgrep ci --sarif > semgrep.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: semgrep.sarif
```

**Trivy:**
```yaml
- uses: aquasecurity/trivy-action@<sha>
  with:
    scan-type: 'image'
    format: 'sarif'
    output: 'trivy-results.sarif'
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: trivy-results.sarif
```

**OWASP Dependency-Check:**
```yaml
- uses: dependency-check/Dependency-Check_Action@main
  with:
    format: 'SARIF'
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: reports/dependency-check-report.sarif
```

**OpenSSF Scorecard:**
```yaml
- uses: ossf/scorecard-action@<sha>
  with:
    results_file: results.sarif
    results_format: sarif
    publish_results: true
```

**OWASP ZAP:**
SARIF support available but not in baseline action by default. Use YAML automation framework or convert from JSON/XML output.

### Required GitHub Permissions

For SARIF upload workflows:
```yaml
permissions:
  security-events: write  # Upload SARIF to Code Scanning
  contents: read          # Checkout repo
  actions: read           # Read workflow context (private repos)
  id-token: write         # OIDC token for scorecard publish_results
```

### Environment Variables & Secrets

**Semgrep:**
- `SEMGREP_APP_TOKEN` (optional): For Semgrep Cloud integration and custom rulesets

**OWASP Dependency-Check:**
- `NVD_API_KEY` (strongly recommended): NVD API key to avoid rate limiting. Free key at nvd.nist.gov/developers/request-an-api-key.

**Trivy:**
- No secrets required. Uses public vulnerability databases.
- Caching enabled by default (recommended to keep enabled).

**OWASP ZAP:**
- `GITHUB_TOKEN`: Provided automatically by GitHub Actions for issue creation.
- Authentication headers if scanning authenticated endpoints.

**OpenSSF Scorecard:**
- `GITHUB_TOKEN`: Provided automatically. Needs `id-token: write` for result publishing.

### Caching Strategies

**Trivy:** Built-in caching enabled by default. Caches vulnerability DB, Java DB, and checks bundle. Do NOT disable unless necessary.

**OWASP Dependency-Check:** Uses nightly-updated Docker image with pre-populated vulnerability database. No separate caching needed.

**Semgrep:** No caching required. Runs stateless analysis.

## Alternatives Considered

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| Semgrep (native Docker) | semgrep-action wrapper | The semgrep-action GitHub Action is officially deprecated. Migrate to native Docker container approach. |
| OWASP Dependency-Check | Snyk Free Tier | Snyk has aggressive upsell, limited scans on free tier. Dependency-Check is OWASP Flagship, fully open source, unlimited scans. |
| Trivy | Clair, Anchore Grype | Trivy has broader scanning (CVEs + misconfigs + secrets + SBOM), better GitHub integration, active development from Aqua Security. Clair is dated. Grype is solid but Trivy has more features. |
| OWASP ZAP Baseline | OWASP ZAP Full Scan | Full scan performs active attacks on target. Requires explicit permission. Use baseline (passive) for CI unless you control the target environment. |
| OpenSSF Scorecard | Manual security audits | Scorecard automates supply chain security checks (dependency pinning, branch protection, SAST/DAST presence, etc.). Manual audits are inconsistent and don't scale. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| semgrep-action (GitHub Action wrapper) | Officially deprecated by Semgrep | Native Semgrep Docker container with semgrep/semgrep image |
| Tag-based action references (e.g., @v1) | Mutable, vulnerable to supply chain attacks | Full-length commit SHA pins with version comment |
| Unpinned action references (e.g., @main) | Breaks reproducibility, auto-updates without review | SHA-pinned actions managed by Dependabot |
| OWASP Dependency-Check without NVD API key | Severe rate limiting, slow database updates | Free NVD API key (nvd.nist.gov/developers/request-an-api-key) |
| Trivy with caching disabled | Causes NVD rate limiting issues | Keep default caching enabled |
| ZAP Full Scan on non-owned targets | Illegal in most jurisdictions, violates ToS | ZAP Baseline (passive scan only) |

## Stack Patterns by Variant

**If you already have CodeQL enabled:**
- Keep CodeQL for additional SAST coverage (especially good for C/C++, Java, C#, Go)
- Add Semgrep for Python and TypeScript (better at framework-specific patterns)
- Rationale: CodeQL and Semgrep have different strengths. CodeQL uses dataflow analysis, Semgrep uses pattern matching. Both complement each other.

**If you're running scheduled scans (nightly/weekly):**
- Use scheduled triggers for Dependency-Check, Trivy, and Scorecard
- Run Semgrep and ZAP on PR + push only
- Rationale: Vulnerability databases update daily. Scheduled scans catch new CVEs. SAST/DAST on PR prevents regressions.

**If you have a multi-language monorepo:**
- Run Semgrep with language-specific rulesets
- Use Trivy for filesystem scanning in addition to container scanning
- Rationale: Trivy can scan git repos directly for secrets and misconfigurations. Semgrep supports multi-language analysis.

**If you're deploying to production:**
- Add Trivy container scanning to Docker build workflow
- Gate deployments on HIGH/CRITICAL findings
- Rationale: Don't ship known vulnerabilities. Trivy exit-code: '1' fails workflow when vulnerabilities detected.

**If you have private repositories:**
- Requires GitHub Advanced Security for Code Scanning (SARIF upload)
- Scorecard requires additional read permissions (issues, pull-requests, checks)
- Rationale: Code Scanning is free for public repos, paid feature for private repos.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| semgrep/semgrep (Docker) | GitHub Actions (any runner) | Requires container runtime. Works on ubuntu-latest (ubuntu-24.04). |
| aquasecurity/trivy-action@0.34.0 | Trivy CLI v0.69.1 | Action version and CLI version aligned. |
| ossf/scorecard-action@v2.4.3 | GitHub Advanced Security (SARIF) | Free for public repos. Private repos need GH Advanced Security license. |
| dependency-check/Dependency-Check_Action@main | Java 11+ (included in Docker image) | Uses nightly Docker image with pre-installed Java and vulnerability DB. |
| zaproxy/action-baseline@v0.15.0 | Node.js 24 | Updated to node24 runtime in v0.15.0. |
| github/codeql-action/upload-sarif@v3 | SARIF 2.1.0 spec | Standard for all security tools outputting SARIF. |

## Installation

### Semgrep (Native Docker)
```yaml
jobs:
  semgrep:
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep
    steps:
      - uses: actions/checkout@<sha>
      - run: semgrep ci --sarif > semgrep.sarif
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}
      - uses: github/codeql-action/upload-sarif@<sha>
        with:
          sarif_file: semgrep.sarif
```

### OWASP Dependency-Check
```yaml
- name: Run OWASP Dependency-Check
  uses: dependency-check/Dependency-Check_Action@main
  env:
    JAVA_HOME: /opt/jdk
    NVD_API_KEY: ${{ secrets.NVD_API_KEY }}
  with:
    format: 'SARIF'
    args: >
      --scan .
      --out reports
```

### Trivy
```yaml
- name: Run Trivy scanner
  uses: aquasecurity/trivy-action@c1824fd # v0.34.0
  with:
    image-ref: 'ghcr.io/${{ github.repository }}:${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### OWASP ZAP Baseline
```yaml
- name: ZAP Baseline Scan
  uses: zaproxy/action-baseline@de8ad96 # v0.15.0
  with:
    target: 'https://staging.example.com'
    rules_file_name: '.zap/rules.tsv'
    allow_issue_writing: false
    fail_action: true
```

### OpenSSF Scorecard
```yaml
- name: Run OpenSSF Scorecard
  uses: ossf/scorecard-action@62b2cac # v2.4.3
  with:
    results_file: results.sarif
    results_format: sarif
    publish_results: true
```

## Sources

**HIGH Confidence (Official Docs & Repositories):**
- [Semgrep Official CI Docs](https://semgrep.dev/docs/semgrep-ci/sample-ci-configs) — SARIF configuration, GitHub Actions integration
- [OpenSSF Scorecard GitHub Action](https://github.com/ossf/scorecard-action) — Official repository, v2.4.3 release info
- [Trivy GitHub Action](https://github.com/aquasecurity/trivy-action) — Official repository, v0.34.0 release info
- [OWASP Dependency-Check Action](https://github.com/dependency-check/Dependency-Check_Action) — Official repository, SARIF support
- [OWASP ZAP Baseline Action](https://github.com/zaproxy/action-baseline) — Official repository, v0.15.0 release info
- [GitHub Actions Security Best Practices](https://docs.github.com/en/actions/reference/security/secure-use) — SHA pinning guidance
- [StepSecurity: Pinning GitHub Actions Guide](https://www.stepsecurity.io/blog/pinning-github-actions-for-enhanced-security-a-complete-guide) — SHA pinning automation

**MEDIUM Confidence (Community Sources):**
- [LinkedIn's SAST Pipeline 2026](https://www.infoq.com/news/2026/02/linkedin-redesigns-sast-pipeline/) — Real-world Semgrep + SARIF usage
- [Dependency-Check SARIF 2026 Guide](https://goregulus.com/cra-basics/owasp-dependency-check/) — SARIF output configuration
- [ZAP SARIF Integration](https://appsecsanta.com/zap) — SARIF format support in ZAP 2026

**Verified Facts:**
- Semgrep semgrep-action is deprecated (confirmed via official GitHub Marketplace page and Semgrep docs)
- SHA pinning adoption: 3.9% of repos pin 100% of actions (source: Wiz research referenced in multiple 2026 articles)
- Trivy v0.34.0 released Feb 12, 2026 (verified via GitHub releases)
- OpenSSF Scorecard v2.4.3 released Sep 30, 2025 (verified via GitHub releases)
- OWASP ZAP v0.15.0 released Oct 24, 2025 (verified via GitHub releases)

---
*Stack research for: DevSecOps CI Security Scanning Integration*
*Researched: 2026-02-23*
