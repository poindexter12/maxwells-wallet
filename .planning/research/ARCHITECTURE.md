# Architecture Research: DevSecOps CI Integration

**Domain:** DevSecOps scanning tools integration for GitHub Actions
**Researched:** 2026-02-23
**Confidence:** HIGH

## Recommended Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TRIGGER LAYER (Events)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  PR Events    │  Push to Main  │  Schedule (Nightly)  │  Manual Dispatch    │
└────┬──────────┴────────┬───────┴──────────┬───────────┴──────────┬──────────┘
     │                   │                  │                      │
     v                   v                  v                      v
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW ORCHESTRATION LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │   ci.yaml    │  │  security.yaml   │  │  nightly.yaml (enhanced)     │  │
│  │              │  │                  │  │                              │  │
│  │ • Changes    │  │ • CodeQL (SAST)  │  │ • Security Audit            │  │
│  │ • Build      │  │ • Trivy (SCA)    │  │ • Secrets Scanning          │  │
│  │ • Test       │  │ • npm/pip audit  │  │ • Dead Code                 │  │
│  │ • Docker     │  │ • Snyk (opt)     │  │ • Coverage                  │  │
│  └──────┬───────┘  └──────┬───────────┘  └──────┬───────────────────────┘  │
│         │                 │                      │                          │
│         └─────────────────┴──────────────────────┘                          │
│                           │                                                 │
├───────────────────────────┼─────────────────────────────────────────────────┤
│                    JOB DEPENDENCY GRAPH                                     │
├───────────────────────────┼─────────────────────────────────────────────────┤
│                           v                                                 │
│   ┌────────────────────────────────────────────────────────────┐            │
│   │  changes (path filter) → determines which jobs run         │            │
│   └────────┬───────────────────────────────────────────────────┘            │
│            │                                                                │
│            ├──→ frontend ──┐                                                │
│            ├──→ backend  ──┤                                                │
│            │               ├──→ e2e ──┐                                     │
│            │               │          ├──→ docker (build/smoke) ──┐         │
│            │               │          │                            │         │
│            └──→ security ──┘          │                            │         │
│                │                      │                            │         │
│                ├──→ codeql ──────────→│                            │         │
│                ├──→ dependency-scan ─→│                            │         │
│                └──→ trivy (after docker build) ────────────────────┘         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATA FLOW & OUTPUT LAYER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐    │
│  │ SARIF Files     │  │ Artifacts       │  │ GitHub Security Tab      │    │
│  │                 │  │                 │  │                          │    │
│  │ • CodeQL        │──┤ • Reports       │──│ • Code Scanning Alerts   │    │
│  │ • Trivy         │  │ • Coverage      │  │ • Dependabot Alerts      │    │
│  │ • npm audit     │  │ • Test Results  │  │ • Secret Scanning        │    │
│  │ • Snyk          │  └─────────────────┘  └──────────────────────────┘    │
│  │                 │                                                        │
│  │ (category field distinguishes tools)                                    │
│  └─────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Integration Pattern |
|-----------|----------------|---------------------|
| **ci.yaml** | Primary build/test pipeline; runs on PRs + main | Imports security.yaml jobs as dependencies; gates Docker build on security pass |
| **security.yaml** | Reusable workflow defining security scan jobs | Called by ci.yaml (PR/main) and nightly.yaml (scheduled); outputs SARIF artifacts |
| **nightly.yaml** | Extended security checks (deep scans, license, secrets) | Calls security.yaml + additional tools; creates GitHub issues on failure |
| **CodeQL job** | SAST for TypeScript/Python; standalone analysis | Runs in security.yaml; no build dependency; uploads SARIF with category=codeql |
| **Dependency scan jobs** | SCA for npm/pip packages (npm audit, pip-audit, Snyk opt) | Parallel jobs in security.yaml; upload SARIF with category=dependencies-{npm/pip} |
| **Trivy job** | Container image + dependency scanning | Depends on Docker build job; scans locally built image before push; SARIF category=trivy |
| **ZAP job** | DAST scanning of running application | Runs in nightly.yaml only; depends on Docker smoke test; uses ZAP docker image |
| **SARIF upload** | Unified security findings to GitHub Security tab | All security jobs use github/codeql-action/upload-sarif@v3; category field distinguishes tools |

### Typical Implementation

**TypeScript/JavaScript SAST:**
- Uses `github/codeql-action/init@v3` with `languages: javascript-typescript`
- Runs `github/codeql-action/autobuild@v3` (or manual npm install)
- Uploads with `github/codeql-action/analyze@v3`

**Python SAST:**
- Uses `github/codeql-action/init@v3` with `languages: python`
- No build step needed (CodeQL supports buildless Python)
- Uploads with `github/codeql-action/analyze@v3`

**npm/pip Dependency Scanning:**
- `npm audit --json` or `uv run pip-audit --format=json`
- Convert JSON to SARIF (use converter or Snyk/Trivy native SARIF output)
- Upload with category distinction

## Recommended Project Structure

### Workflow File Organization

```
.github/workflows/
├── ci.yaml                      # Main CI (existing) - calls security.yaml
├── security.yaml                # NEW: Reusable security workflow
│   ├── Job: codeql-typescript
│   ├── Job: codeql-python
│   ├── Job: npm-audit
│   ├── Job: pip-audit
│   └── Job: trivy-container (optional: only if docker needed)
├── nightly.yaml                 # Enhanced (existing + calls security.yaml)
│   ├── Calls: security.yaml
│   ├── Job: zap-dast
│   ├── Job: gitleaks (secrets)
│   └── Job: license-check
├── nightly-chaos.yaml           # (existing - no changes)
├── nightly-e2e.yaml             # (existing - no changes)
├── nightly-performance.yaml     # (existing - no changes)
├── weekly-endurance.yaml        # (existing - no changes)
└── release.yaml                 # (existing - no changes)
```

### Integration Rationale

**Why separate security.yaml?**
- **Reusability:** Called by both ci.yaml (on PRs) and nightly.yaml (scheduled deep scans)
- **Maintainability:** Security tools grouped together, easier to update/audit
- **Performance:** Can be invoked selectively (e.g., skip on translation-only PRs)

**Why enhance nightly.yaml instead of new workflow?**
- Already has security-audit job (pip-audit); logical extension
- Scheduled trigger exists; avoids workflow file proliferation
- Non-blocking deep scans (ZAP, secrets, license) fit nightly cadence

**Why NOT embed in ci.yaml?**
- ci.yaml is already complex (240+ lines, 7 jobs)
- Security scans have different lifecycle (some too slow for PR feedback loop)
- Reusable workflow pattern allows conditional invocation

## Architectural Patterns

### Pattern 1: Reusable Security Workflow

**What:** Define security jobs in a separate workflow file; call via `workflow_call` trigger

**When to use:** When the same security scans need to run in multiple contexts (PRs, main, nightly, release)

**Trade-offs:**
- **Pro:** DRY principle; single source of truth for security configuration
- **Pro:** Easy to test security workflow in isolation (`workflow_dispatch`)
- **Con:** Adds indirection (debugging requires checking both caller and callee)
- **Con:** Output/artifact passing requires explicit configuration

**Example:**
```yaml
# .github/workflows/security.yaml
name: Security Scanning
on:
  workflow_call:
    inputs:
      run-slow-scans:
        type: boolean
        default: false
    outputs:
      sarif-uploaded:
        value: ${{ jobs.upload-results.outputs.uploaded }}

jobs:
  codeql-typescript:
    # ... CodeQL for TS/JS
  codeql-python:
    # ... CodeQL for Python
  npm-audit:
    # ... npm audit with SARIF conversion
  pip-audit:
    # ... pip-audit with SARIF output

# .github/workflows/ci.yaml (caller)
jobs:
  security:
    uses: ./.github/workflows/security.yaml
    with:
      run-slow-scans: false
    permissions:
      security-events: write
      contents: read
```

### Pattern 2: SARIF Upload with Category Distinction

**What:** Use `category` parameter in upload-sarif action to distinguish multiple security tools

**When to use:** When uploading SARIF from multiple tools analyzing the same commit

**Trade-offs:**
- **Pro:** All findings in unified GitHub Security tab
- **Pro:** Prevents tool results from overwriting each other
- **Pro:** Enables filtering by tool in UI
- **Con:** Requires consistent category naming convention
- **Con:** Must track categories across workflow files

**Example:**
```yaml
- name: Upload CodeQL results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: codeql-results.sarif
    category: codeql-typescript

- name: Upload Trivy results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: trivy-results.sarif
    category: trivy-container

- name: Upload npm audit results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: npm-audit.sarif
    category: dependencies-npm
```

### Pattern 3: Conditional Security Execution

**What:** Skip security scans based on change detection (e.g., translation-only PRs)

**When to use:** When security scans are expensive and some changes pose zero security risk

**Trade-offs:**
- **Pro:** Faster PR feedback for low-risk changes
- **Pro:** Reduced CI minutes consumption
- **Con:** Risk of misconfigured filters bypassing scans
- **Con:** Complexity in maintaining filter rules

**Example:**
```yaml
# In ci.yaml changes job
outputs:
  security-relevant: ${{ steps.filter.outputs.security-relevant }}

# In security.yaml or caller
jobs:
  security:
    needs: changes
    if: needs.changes.outputs.security-relevant == 'true' || github.ref == 'refs/heads/main'
    uses: ./.github/workflows/security.yaml
```

### Pattern 4: Docker Image Scanning Post-Build

**What:** Scan Docker images after build but before push to registry

**When to use:** When container images are build artifacts that need vulnerability scanning

**Trade-offs:**
- **Pro:** Prevents vulnerable images from reaching registry
- **Pro:** Fast (scans local image, no pull needed)
- **Pro:** Native SARIF output from Trivy
- **Con:** Requires Docker build in CI (already present in this project)
- **Con:** Scan time adds to Docker job duration

**Example:**
```yaml
jobs:
  docker:
    # ... existing build steps

    - name: Build image (don't push yet)
      uses: docker/build-push-action@v6
      with:
        context: .
        push: false
        load: true  # Load to local Docker daemon
        tags: local/maxwells-wallet:${{ github.sha }}

    - name: Scan with Trivy
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: local/maxwells-wallet:${{ github.sha }}
        format: sarif
        output: trivy-results.sarif
        severity: CRITICAL,HIGH

    - name: Upload Trivy SARIF
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: trivy-results.sarif
        category: trivy-container

    - name: Push to registry (only if scan passes)
      if: success()
      # ... push steps
```

### Pattern 5: ZAP DAST Integration with Running Container

**What:** Run OWASP ZAP against a live Docker container in the CI environment

**When to use:** For DAST scanning that requires a running application instance

**Trade-offs:**
- **Pro:** Detects runtime vulnerabilities (XSS, SQL injection, etc.)
- **Pro:** Tests actual deployed configuration
- **Con:** Slow (full ZAP scan can take 10+ minutes)
- **Con:** Requires network-accessible running app
- **Con:** Best suited for nightly/scheduled runs, not PR feedback

**Example:**
```yaml
jobs:
  zap-dast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      # Start app container
      - name: Start application
        run: |
          docker compose -f docker-compose.dev.yaml up -d
          sleep 15  # Wait for services to initialize

      # Run ZAP scan
      - name: ZAP Full Scan
        uses: zaproxy/action-full-scan@v0.10.0
        with:
          target: http://localhost:3000
          docker_name: owasp/zap2docker-stable
          rules_file_name: .zap/rules.tsv
          cmd_options: -a  # Include alpha vulnerabilities

      # Upload report
      - name: Upload ZAP report
        if: always()
        uses: actions/upload-artifact@v6
        with:
          name: zap-scan-report
          path: report_html.html

      # Cleanup
      - name: Stop application
        if: always()
        run: docker compose -f docker-compose.dev.yaml down -v
```

## Data Flow

### SARIF Upload Flow

```
Security Tool (CodeQL/Trivy/npm audit/Snyk)
    ↓
Generates SARIF file (tool-results.sarif)
    ↓
github/codeql-action/upload-sarif@v3
    ↓ (requires security-events: write permission)
GitHub Code Scanning API
    ↓ (processes fingerprints, deduplicates)
GitHub Security Tab → Code Scanning Alerts
    ↓ (categorized by category parameter)
Viewable in PR Checks + Security Tab
```

### Key Data Flow Rules

1. **SARIF file limits:**
   - Max 10 MB compressed
   - Max 25,000 results per upload
   - Only top 5,000 displayed in UI (sorted by severity)

2. **Fingerprinting:**
   - GitHub uses `partialFingerprints` to deduplicate across runs
   - Tools should include consistent identifiers (ruleId, location)
   - upload-sarif action auto-generates fingerprints if missing

3. **Category naming convention:**
   - `codeql-{language}` → CodeQL scans (e.g., codeql-python)
   - `dependencies-{ecosystem}` → Dependency scans (e.g., dependencies-npm)
   - `trivy-{target}` → Trivy scans (e.g., trivy-container, trivy-filesystem)
   - `zap-dast` → ZAP dynamic scanning
   - `secrets-{tool}` → Secret scanning (e.g., secrets-gitleaks)

4. **Pull request display:**
   - Alerts shown only if affected lines are in the PR diff
   - Must be in added/modified code (not deleted lines)
   - Requires both `security-events: write` and `contents: read` for private repos

## Permissions Model

### Required Permissions by Job Type

| Job Type | Permissions | Reason |
|----------|-------------|--------|
| **CodeQL** | `security-events: write`, `contents: read` | Write SARIF to Code Scanning API; read source code |
| **Trivy (container)** | `security-events: write`, `contents: read` | Write SARIF; read Dockerfile context |
| **Trivy (filesystem)** | `security-events: write`, `contents: read` | Write SARIF; read dependency manifests |
| **npm/pip audit** | `security-events: write`, `contents: read` | Write SARIF; read package manifests |
| **Snyk** | `security-events: write`, `contents: read` | Write SARIF; read source (requires SNYK_TOKEN secret) |
| **ZAP DAST** | None (artifacts only) | No SARIF upload; writes HTML report to artifacts |
| **Gitleaks** | `security-events: write`, `contents: read` | Write SARIF; scan git history |

### Permissions Best Practices

**Top-level default:**
```yaml
permissions:
  contents: read  # Default for all jobs
```

**Job-level override:**
```yaml
jobs:
  codeql:
    permissions:
      security-events: write  # Explicitly grant for SARIF upload
      contents: read
```

**Reusable workflow:**
```yaml
# Caller must grant permissions; callee inherits
jobs:
  security:
    uses: ./.github/workflows/security.yaml
    permissions:
      security-events: write
      contents: read
```

**Security consideration:** `security-events: write` currently implies `security-events: read`, which exposes existing vulnerability data to the workflow. This is an accepted risk but noted in GitHub security discussions as an area for improvement (as of Feb 2026).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **GitHub Code Scanning** | SARIF upload via codeql-action/upload-sarif | Native GitHub feature; free for public repos; requires Advanced Security for private |
| **Snyk (optional)** | snyk/actions action + SNYK_TOKEN secret | SaaS; free tier available; provides SARIF + auto-fix PRs |
| **Codecov** | codecov-action (already integrated) | Coverage tracking; not security but often grouped in quality workflows |
| **Dependabot** | Native GitHub (dependabot.yml already present) | Automated dependency updates; complements SCA scans |

### Internal Workflow Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **ci.yaml ↔ security.yaml** | workflow_call with inputs/outputs | ci.yaml invokes security.yaml on PR/main; passes run-slow-scans=false |
| **nightly.yaml ↔ security.yaml** | workflow_call with inputs/outputs | nightly.yaml invokes security.yaml with run-slow-scans=true |
| **docker job ↔ trivy job** | Artifact (built image in Docker daemon) | Trivy scans image built in docker job; depends via needs: |
| **e2e job ↔ zap job** | Conceptual (both need running app) | ZAP should run in nightly after smoke test proves app works |

## Build Order Implications

### Suggested Implementation Phases

**Phase 1: SAST Foundation (CodeQL)**
- **Why first:** No build dependencies; works standalone
- **Complexity:** Low (GitHub-native action)
- **Impact:** Detects code-level vulnerabilities (injection, XSS, etc.)
- **Dependencies:** None
- **Recommended structure:** New security.yaml with codeql jobs

**Phase 2: Dependency Scanning (npm audit, pip-audit)**
- **Why second:** Leverages existing package manifests; low overhead
- **Complexity:** Medium (requires SARIF conversion or native SARIF tool)
- **Impact:** Detects vulnerable dependencies
- **Dependencies:** Requires package-lock.json (npm) or uv.lock/requirements.txt (pip)
- **Recommended structure:** Jobs in security.yaml; parallel to CodeQL

**Phase 3: Container Scanning (Trivy)**
- **Why third:** Depends on Docker build job; extends existing pipeline
- **Complexity:** Medium (requires Docker image as input)
- **Impact:** Detects container vulnerabilities (base image CVEs, misconfigurations)
- **Dependencies:** Requires docker job to build image first
- **Recommended structure:** Job in ci.yaml after docker build; before push

**Phase 4: DAST (ZAP)**
- **Why last:** Requires running application; slowest scan type
- **Complexity:** High (needs network-accessible app, rule tuning)
- **Impact:** Detects runtime vulnerabilities (XSS, CSRF, header misconfigs)
- **Dependencies:** Requires working Docker container; best in nightly
- **Recommended structure:** Job in nightly.yaml after smoke test proves app works

**Phase 5 (Optional): Advanced Tooling (Snyk, Gitleaks, License Check)**
- **Why optional:** Adds value but not critical path; may have cost implications
- **Complexity:** Low-Medium (mostly drop-in actions)
- **Impact:** Enhanced SCA (Snyk), secret detection (Gitleaks), license compliance
- **Dependencies:** May require secrets (SNYK_TOKEN); Gitleaks scans git history
- **Recommended structure:** Jobs in nightly.yaml for deep scans

### Dependency Graph for Phased Rollout

```
Phase 1: CodeQL (parallel to existing ci.yaml jobs)
    ↓ (no blocking dependencies)
Phase 2: npm-audit, pip-audit (parallel to Phase 1)
    ↓ (no blocking dependencies)
Phase 3: Trivy (serial dependency: needs→docker job)
    ↓ (blocks registry push if CRITICAL/HIGH found)
Phase 4: ZAP DAST (serial dependency: needs→docker smoke test)
    ↓ (nightly only; non-blocking)
Phase 5: Snyk, Gitleaks, License (parallel; nightly only)
```

## Anti-Patterns

### Anti-Pattern 1: All Security Tools in One Job

**What people do:** Combine CodeQL, Trivy, npm audit in a single job step

**Why it's wrong:**
- Single point of failure (one tool failure blocks all others)
- No parallelization (tools run serially, wasting CI time)
- SARIF uploads overwrite each other without proper category distinction
- Debugging harder (logs intermixed)

**Do this instead:** Separate jobs for each tool; use `needs:` for ordering; rely on GitHub's parallel execution

### Anti-Pattern 2: Running Full Security Suite on Every PR

**What people do:** Configure ZAP full scan, deep CodeQL analysis, and full Trivy scans on every PR commit

**Why it's wrong:**
- Slow PR feedback loop (developers wait 15+ minutes)
- Wasted CI minutes on low-risk changes (e.g., README updates)
- Contributor friction (discourages small PRs)

**Do this instead:**
- **PR scans:** Fast SAST (CodeQL autobuild), quick dependency checks (npm audit), change detection filters
- **Nightly scans:** Deep scans (ZAP, license, secrets, full Trivy)
- **Main branch:** Balanced suite (SAST + dependency + container scan)

### Anti-Pattern 3: Pushing Docker Images Before Vulnerability Scan

**What people do:** Build → Push to registry → Scan from registry

**Why it's wrong:**
- Vulnerable images reach registry (even if scan fails later)
- Slower (pull from registry vs scan local image)
- Cleanup required (delete vulnerable images from registry)

**Do this instead:** Build → Load locally → Scan → Push only if scan passes (Pattern 4 above)

### Anti-Pattern 4: Hard-Coding Security Tokens in Workflow Files

**What people do:** `env: SNYK_TOKEN: sk-1234567890abcdef`

**Why it's wrong:**
- Secret exposure in git history
- No secret rotation capability
- Violates GitHub security best practices

**Do this instead:** Use GitHub Secrets (`${{ secrets.SNYK_TOKEN }}`); rotate regularly; scope secrets to environments if applicable

### Anti-Pattern 5: Ignoring SARIF Category Collisions

**What people do:** Upload multiple tools' SARIF without category parameter

**Why it's wrong:**
- Later uploads overwrite earlier ones for the same commit/ref
- GitHub assumes same analysis type; deduplicates incorrectly
- Lose visibility into which tool found which vulnerability

**Do this instead:** Always set `category:` parameter with tool-specific values (e.g., category: trivy-container, category: codeql-python)

### Anti-Pattern 6: Over-Permissioning Workflows

**What people do:** `permissions: write-all` or grant `security-events: write` to all jobs

**Why it's wrong:**
- Violates least privilege principle
- Increases blast radius if workflow is compromised
- Unnecessary for jobs that don't upload SARIF

**Do this instead:**
- Default `permissions: contents: read` at workflow level
- Job-level `permissions: security-events: write` only for SARIF upload jobs
- Use `permissions: {}` (empty) where no permissions needed

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-10 contributors** | Single security.yaml called by ci.yaml; nightly for slow scans; acceptable to run all scans on main branch |
| **10-50 contributors** | Add change detection filters (skip security on docs/translation-only); consider Snyk for auto-fix PRs; ZAP only in nightly |
| **50+ contributors** | Split security.yaml into fast (PR) vs slow (nightly) reusable workflows; use matrix strategy for multi-language/multi-module repos; consider self-hosted runners for Trivy/ZAP |

### Scaling Priorities

1. **First bottleneck (PR feedback time):** Move slow scans (ZAP, deep CodeQL) to nightly; filter translation/docs-only PRs from security scans
2. **Second bottleneck (CI minute consumption):** Implement caching for CodeQL databases; use Trivy's --cache-backend; consider GitHub cache action for npm/pip audit results
3. **Third bottleneck (Alert fatigue):** Tune severity thresholds (CRITICAL/HIGH only on PRs); use SARIF filtering for known false positives; implement issue auto-creation for nightly failures

## Sources

- [How to Run Security Scanning with GitHub Actions](https://oneuptime.com/blog/post/2026-01-25-security-scanning-github-actions/view)
- [Security Architecture | GitHub Agentic Workflows](https://github.github.com/gh-aw/introduction/architecture/)
- [Top 10 GitHub Actions Security Pitfalls](https://arctiq.com/blog/top-10-github-actions-security-pitfalls-the-ultimate-guide-to-bulletproof-workflows)
- [Uploading a SARIF file to GitHub - GitHub Docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github)
- [Uploading SARIF Reports to GitHub | Medium](https://medium.com/snapp-mobile/uploading-sarif-reports-to-github-91a8001e6794)
- [Customizing your advanced setup for code scanning - GitHub Docs](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning)
- [Setting up Trivy in your GitHub Actions](https://thomasthornton.cloud/2025/03/18/setting-up-trivy-in-your-github-actions/)
- [Securing GitHub Actions with Trivy and Cosign](https://www.aquasec.com/blog/trivy-github-actions-security-cicd-pipeline/)
- [Single workflow vs multiple workflows · community · Discussion #25482](https://github.com/orgs/community/discussions/25482)
- [OWASP ZAP with Github Actions](https://blog.nishanthkp.com/docs/devsecops/dast/owasp-zap/zap-github/)
- [Automating DAST with OWASP ZAP in GitHub Actions](https://sahilsikarwar.hashnode.dev/automating-dast-with-owasp-zap-in-github-actions)
- [Aqua Security Trivy Action - GitHub Marketplace](https://github.com/marketplace/actions/aqua-security-trivy)
- [GitHub Actions Security Best Practices Cheat Sheet](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)
- [Separate permission for security-events - Discussion #29710](https://github.com/orgs/community/discussions/29710)
- [GitHub Actions for Snyk - Snyk User Docs](https://docs.snyk.io/integrations/snyk-ci-cd-integrations/github-actions-integration)
- [How to Handle Dependency Vulnerability Scanning](https://oneuptime.com/blog/post/2026-01-24-dependency-vulnerability-scanning/view)
- [How to Implement Dependency Scanning with Snyk](https://oneuptime.com/blog/post/2026-01-25-dependency-scanning-snyk/view)

---
*Architecture research for: DevSecOps CI Integration*
*Researched: 2026-02-23*
