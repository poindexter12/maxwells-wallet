# Feature Landscape: DevSecOps CI Scanning Integration

**Domain:** Security scanning integration for GitHub Actions CI pipeline
**Researched:** 2026-02-23

## Table Stakes

Features users expect from a "free Veracode alternative" security scanning suite. Missing any of these = the tooling integration feels incomplete.

| Feature | Why Expected | Complexity | Tool(s) | Notes |
|---------|--------------|------------|---------|-------|
| **SARIF Output Format** | GitHub Security tab integration standard | Low | Semgrep, Trivy, Dep-Check, Scorecard | SARIF 2.1.0 required for code scanning |
| **GitHub Security Tab Upload** | Centralized vulnerability dashboard | Low | All tools | Uses `github/codeql-action/upload-sarif@v3` |
| **Automated CI Scanning** | Security checks on every push/PR | Low | All tools | Standard GitHub Actions integration |
| **SAST Coverage** | Code-level vulnerability detection | Medium | Semgrep | Proprietary code analysis, custom rules |
| **SCA Coverage** | Dependency vulnerability detection | Medium | OWASP Dep-Check | OSS library vulnerabilities, CVE linking |
| **Container Scanning** | Docker image vulnerability detection | Medium | Trivy | Image layer analysis, OS packages |
| **Supply Chain Security** | Repository security best practices | Low | OpenSSF Scorecard | 19 checks covering maintainer practices |
| **DAST Coverage** | Runtime vulnerability detection | Medium | OWASP ZAP | Active scanning of deployed applications |
| **Multi-Format Reports** | Human-readable outputs | Low | All tools | HTML, JSON, SARIF for different audiences |
| **Vulnerability Database Updates** | Current CVE data | Low | Trivy, Dep-Check | Auto-updates via tool execution |
| **Severity Filtering** | Focus on critical issues | Low | All tools | Filter by CRITICAL, HIGH, MEDIUM, LOW |
| **Informational Mode** | Non-blocking scans | Low | All tools | No build gates - reporting only |
| **Incremental/Diff Scanning** | Scan only changed code | Medium | Semgrep | PR-focused, reduces noise |
| **Issue Management** | Track findings over time | Medium | ZAP, GitHub Issues | Auto-create/update/close issues |
| **False Positive Handling** | Suppress known safe findings | Medium | All tools | Rules files, ignore configs |

## Differentiators

Features that set this integration apart from basic security scanning. Not expected by default, but valued when present.

| Feature | Value Proposition | Complexity | Tool(s) | Notes |
|---------|-------------------|------------|---------|-------|
| **Custom SAST Rules** | Domain-specific security patterns | High | Semgrep | Write organization-specific rules |
| **Reachability Analysis** | Prioritize exploitable vulnerabilities | High | N/A | Not available in free tools |
| **SBOM Generation** | Software Bill of Materials | Medium | Trivy | CycloneDX/SPDX format output |
| **Secret Detection** | Credentials in code/config | Medium | Trivy | Detect hardcoded secrets |
| **IaC Scanning** | Infrastructure-as-Code security | Medium | Trivy | Terraform, K8s manifests |
| **License Compliance** | OSS license detection | Medium | Trivy | Track license obligations |
| **Policy as Code** | Automated security policies | High | OPA + custom | Define enforcements as code |
| **Badge Display** | Public security posture | Low | Scorecard | README.md badge with score |
| **API Access to Results** | Programmatic result queries | Medium | Scorecard | REST API for dashboards |
| **Authenticated DAST** | Scan behind login | High | ZAP | Requires auth config |
| **Coverage Metrics** | Track scanning completeness | Medium | Multiple | Aggregate across tools |
| **Trend Analysis** | Vulnerability tracking over time | High | Custom | Historical data processing |
| **Auto-Remediation PRs** | Automated fixes | High | N/A | Requires Dependabot Pro features |
| **Multi-Language Support** | Comprehensive stack coverage | Medium | Semgrep | 30+ languages supported |
| **Performance Optimization** | Fast CI execution | Medium | All tools | Caching, parallel execution |

## Anti-Features

Features to explicitly NOT build or configure at this stage. These would move the project away from "informational scanning" toward "security enforcement."

| Anti-Feature | Why Avoid | What to Do Instead | Priority to Add Later |
|--------------|-----------|-------------------|----------------------|
| **Build Gates** | Goal is informational only | Always succeed, upload findings | Phase 3+ (after baseline) |
| **Failure Thresholds** | No CI blocking on vulnerabilities | Report all findings | Phase 3+ |
| **Pull Request Blocking** | Informational first, enforcement later | Comment but don't block | Phase 3+ |
| **Mandatory Fix Enforcement** | Overwhelming for initial adoption | Track and prioritize | Never (policy decision) |
| **Real-Time IDE Scanning** | Out of scope for CI integration | Separate developer tooling | Out of scope |
| **Commercial Tool Integration** | Free alternative is the goal | Use OSS tools only | Out of scope |
| **Custom Dashboards** | GitHub Security tab is sufficient | Use built-in views | Phase 4+ (optional) |
| **Alert Fatigue Management** | Need baseline first | Accept all findings initially | Phase 2 (tuning) |
| **Production Runtime Scanning** | CI-focused, not production monitoring | Separate concern | Out of scope |
| **Penetration Testing Integration** | Manual activity, not CI automation | Separate security process | Out of scope |

## Feature Dependencies

```
SARIF Output → GitHub Security Tab Upload (all tools require SARIF for Security tab)
SAST Coverage → Custom SAST Rules (custom rules require base SAST capability)
Container Scanning → SBOM Generation (SBOM requires container scan capability)
Informational Mode → Issue Management (issue tracking requires non-blocking mode)
Multi-Format Reports → False Positive Handling (need reports to identify false positives)
```

## Tool-Specific Feature Breakdown

### Semgrep (SAST)

**Table Stakes:**
- SARIF output via `--sarif` flag
- Diff-aware scanning (changed files only)
- Multi-language support (30+ languages)
- Default ruleset execution
- GitHub Security tab integration

**Differentiators:**
- Custom rule authoring (YAML-based)
- Cross-file (taint) analysis
- Real-time feedback (if using Semgrep AppSec Platform)
- Rule marketplace access
- High accuracy (low false positive rate)

**Configuration:** Optional `SEMGREP_APP_TOKEN` for enhanced features; minimal config otherwise.

### Trivy (Container/Multi-Scanner)

**Table Stakes:**
- Container image vulnerability scanning
- OS package vulnerability detection
- SARIF output format
- Severity filtering
- GitHub Security tab integration

**Differentiators:**
- Multi-target scanning (container, fs, repo, IaC, K8s)
- Secret detection
- License scanning
- SBOM generation (CycloneDX, SPDX)
- Misconfiguration detection (Terraform, CloudFormation, Dockerfile)
- Fast execution with caching

**Configuration:** Image reference or scan path required; format and severity filters optional.

### OWASP Dependency-Check (SCA)

**Table Stakes:**
- Dependency vulnerability detection
- CVE-NVD database integration
- Multi-format output (SARIF, HTML, JSON, XML)
- Python pip and npm ecosystem support
- GitHub Security tab integration

**Differentiators:**
- Retired dependency detection
- CPE (Common Platform Enumeration) identification
- Automatic database updates (nightly Docker images)
- Extensive ecosystem support (Java, .NET, Ruby, etc.)
- Fail-on-CVSS threshold (optional)

**Configuration:** Project name, scan path, and format required; fail thresholds optional.

### OpenSSF Scorecard (Supply Chain)

**Table Stakes:**
- 19 security checks covering:
  - Branch protection
  - Code review practices
  - Dependency pinning
  - Binary artifacts detection
  - Dangerous workflow patterns
- SARIF output format
- GitHub Security tab integration
- Scheduled scanning

**Differentiators:**
- Public badge for README
- REST API access to results
- Remediation guidance per check
- Industry-standard metrics
- Zero configuration (works on public repos)

**Configuration:** Results file path and format required; publish flag for badge/API optional.

### OWASP ZAP (DAST)

**Table Stakes:**
- Baseline scan (passive + spider)
- Common vulnerability detection (XSS, SQLi, etc.)
- GitHub issue management
- HTML and Markdown reports
- Artifact uploads

**Differentiators:**
- Authenticated scanning (with config)
- Custom rules file support
- Active scanning mode (more aggressive)
- Internationalization support
- Weekly builds for latest checks

**Configuration:** Target URL required; rules file, auth headers, fail mode optional.

## Output Format Comparison

| Format | Tools Supporting | Primary Use Case | GitHub Integration |
|--------|-----------------|------------------|-------------------|
| **SARIF** | All five | GitHub Security tab | Native (upload-sarif action) |
| **JSON** | All five | Programmatic processing | Manual integration |
| **HTML** | Dep-Check, ZAP | Human review | Artifact downloads |
| **Markdown** | ZAP | Issue descriptions | GitHub Issues |
| **XML** | Dep-Check | Legacy integrations | Manual integration |
| **CycloneDX** | Trivy | SBOM exchange | Manual integration |
| **SPDX** | Trivy | SBOM exchange | Manual integration |

## GitHub Security Tab Requirements

**SARIF Specification:**
- SARIF 2.1.0 JSON schema required
- Max 10 MB per file
- Permissions: `security-events: write`
- Upload via `github/codeql-action/upload-sarif@v3`

**Key SARIF Components:**
- Rules array (reportingDescriptor objects)
- Results array (result objects)
- Source file locations (for inline highlighting)
- Severity mappings (properties.security-severity)

**Best Practices:**
- One SARIF file per tool per run
- Unique category per tool (for filtering)
- Include remediation guidance in messages
- Set appropriate severity levels

## MVP Recommendation

Prioritize for initial implementation:

1. **Semgrep** (SAST) - Table stakes, low config, high value
2. **OWASP Dependency-Check** (SCA) - Table stakes, complements Dependabot
3. **Trivy** (Container) - Required for Docker image scanning
4. **OpenSSF Scorecard** (Supply Chain) - Zero config, immediate value
5. **OWASP ZAP** (DAST) - Defer to Phase 2 (requires running application)

**Defer to Phase 2:**
- ZAP baseline scan (needs deployment target)
- Custom Semgrep rules (need baseline first)
- False positive tuning (need baseline findings)
- Issue automation beyond GitHub Security tab

**Defer to Phase 3+:**
- Build gates and failure thresholds
- Authenticated DAST scanning
- Custom dashboards and reporting
- Trend analysis and metrics

## Integration Patterns

### Standard Workflow Structure

```yaml
name: Security Scan - [Tool Name]

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly

permissions:
  contents: read
  security-events: write  # Required for SARIF upload

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@SHA
      - name: Run [Tool]
        # Tool-specific steps
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@SHA
        with:
          sarif_file: results.sarif
          category: [tool-name]
```

### Timing Recommendations

- **Push/PR:** SAST, SCA (fast, code-focused)
- **Main branch only:** Container scanning (Docker builds)
- **Scheduled:** Scorecard (daily/weekly), full suite (weekly)
- **Manual:** DAST (requires coordination)

## Sources

- [Sample CI configurations | Semgrep](https://semgrep.dev/docs/semgrep-ci/sample-ci-configs)
- [OWASP Dependency-Check | OWASP Foundation](https://owasp.org/www-project-dependency-check/)
- [Dependency Check GitHub Action](https://github.com/marketplace/actions/dependency-check)
- [Trivy container scanning GitHub Actions](https://github.com/aquasecurity/trivy-action)
- [OWASP ZAP baseline scan GitHub Action](https://github.com/zaproxy/action-baseline)
- [OpenSSF Scorecard GitHub Action](https://github.com/ossf/scorecard-action)
- [SARIF support for code scanning - GitHub Docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning)
- [The complete guide to SARIF | Sonar](https://www.sonarsource.com/resources/library/sarif/)
- [DevSecOps Pipeline Best Practices For 2026 | Wiz](https://www.wiz.io/academy/application-security/devsecops-pipeline-best-practices)
- [Top 5 Veracode Alternatives for Application Security Testing (2025 Edition) - OX Security](https://www.ox.security/blog/veracode-alternatives/)
- [SAST vs. SCA in 2026: Which Security Tool Do You Need?](https://www.ox.security/blog/sast-vs-sca-2026/)
- [GitHub Actions security scanning best practices](https://www.stepsecurity.io/blog/github-actions-security-best-practices)
