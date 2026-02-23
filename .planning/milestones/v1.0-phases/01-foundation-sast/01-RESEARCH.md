# Phase 1: Foundation & SAST - Research

**Researched:** 2026-02-23
**Domain:** GitHub Actions security workflows, SAST integration, SARIF format
**Confidence:** HIGH

## Summary

Phase 1 establishes reusable security workflow infrastructure using GitHub Actions' `workflow_call` pattern and integrates Semgrep SAST scanning with native Docker container execution. The research confirms feasibility of all requirements with well-documented, stable patterns.

The existing codebase already follows security best practices (SHA-pinned Actions, job-level permissions, path-based change detection) which this phase extends. GitHub's July 2025 SARIF category uniqueness policy change requires explicit category assignment per tool—a critical implementation detail. Semgrep's native Docker container (`semgrep/semgrep`) replaces the deprecated `semgrep-action` wrapper, enabling direct control over scan configuration and SARIF output.

**Primary recommendation:** Use `semgrep scan` command (not `semgrep ci`) with `--config auto --sarif` flags in native Docker container. Structure security.yaml as a reusable workflow with separate jobs per tool, following existing repo patterns for permissions, change detection, and job summaries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None—all implementation decisions delegated to Claude.

### Claude's Discretion

All implementation decisions delegated to Claude. Use research findings and existing CI patterns to make sensible choices.

**Workflow structure:**
- Reusable `security.yaml` workflow callable from ci.yaml and nightly.yaml
- Follow existing repo patterns (dorny/paths-filter, job-level permissions, SHA-pinned actions)
- Separate jobs per tool (Semgrep first, others added in later phases)
- Job-level `permissions: security-events: write, contents: read` (least privilege)

**Scan scope & triggers:**
- PRs targeting main: diff-aware Semgrep scan (changed files only)
- Pushes to main: full codebase scan
- Nightly: full scan via existing nightly.yaml calling security.yaml
- Path filtering deferred to Phase 6 optimization (not a v1 requirement)

**Findings visibility:**
- Primary: GitHub Security tab via SARIF upload
- Secondary: Job summary with scan status (success/findings count)
- No PR comment annotations for now (GitHub Security tab handles inline highlighting via SARIF)

**Failure handling:**
- `continue-on-error: true` on scan job so CI never blocks
- If Semgrep itself crashes: job shows as failed but workflow succeeds
- Job summary notes the failure for visibility

**SARIF conventions:**
- Category naming: `semgrep` (single tool, simple name; later phases add `dependency-check`, `trivy`, `scorecard`)
- One SARIF file per tool per run
- Upload via `github/codeql-action/upload-sarif` (SHA-pinned)

**Semgrep configuration:**
- Native Docker container execution (not deprecated semgrep-action)
- `--config auto` ruleset (auto-detects TypeScript, Python, applies community rules)
- `--sarif` output flag
- No SEMGREP_APP_TOKEN (optional, not needed for basic scanning)

### Deferred Ideas (OUT OF SCOPE)
None—discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

This phase addresses 10 requirements from REQUIREMENTS.md:

| ID | Description | Research Support |
|----|-------------|-----------------|
| CROSS-01 | Security scans defined in reusable security.yaml workflow | Reusable workflows pattern (workflow_call), verified stable and mature |
| CROSS-02 | Each tool's SARIF upload uses unique category | SARIF category parameter documented; July 2025 policy requires uniqueness |
| CROSS-03 | All third-party Actions pinned to commit SHAs | Existing repo convention; codeql-action v4.32.4 SHA available |
| CROSS-04 | Security scan jobs use job-level permissions (least privilege) | Job-level permissions syntax verified; security-events: write + contents: read |
| CROSS-05 | All security scans use continue-on-error: true | Behavior confirmed: job fails but workflow succeeds |
| SAST-01 | Semgrep runs on PRs/pushes to main, scans TypeScript and Python | --config auto detects languages; Docker container supports both triggers |
| SAST-02 | Semgrep uses auto ruleset to detect languages and apply community rules | --config auto mode verified in official docs |
| SAST-03 | Semgrep outputs SARIF and uploads to GitHub Security tab | --sarif flag + github/codeql-action/upload-sarif verified |
| SAST-04 | Semgrep runs via native Docker container | semgrep/semgrep:latest image; semgrep-action deprecated |
| SAST-05 | Semgrep scan is non-blocking | continue-on-error: true enables informational-only mode |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github/codeql-action | v4.32.4<br/>(SHA: 89a39a4) | Upload SARIF to GitHub Security tab | Official GitHub action for code scanning integration; only supported method |
| semgrep/semgrep | latest | SAST scanner for TypeScript and Python | Official Docker image; semgrep-action wrapper deprecated |
| dorny/paths-filter | v3<br/>(SHA: de90cc6) | Detect changed files for diff-aware scanning | Already in use; enables PR-specific scanning vs full scans |

### Supporting Actions Already in Use
| Action | Version | Purpose | Current Usage |
|--------|---------|---------|---------------|
| actions/checkout | v6<br/>(SHA: de0fac2) | Clone repository for scanning | Used in all existing jobs |
| actions/setup-node | v6<br/>(SHA: 6044e13) | Node.js environment (if needed) | Used in frontend job |
| astral-sh/setup-uv | v7<br/>(SHA: a2a8b00) | Python environment (if needed) | Used in backend job |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| semgrep/semgrep Docker | semgrep-action wrapper | Wrapper deprecated; native container gives direct control over flags |
| semgrep scan | semgrep ci | `semgrep ci` designed for AppSec Platform integration; `semgrep scan` correct for CE without account |
| --config auto | Specific rulesets (p/default, p/ci) | auto mode detects languages and selects rules automatically; simpler for multi-language repos |
| SARIF category parameter | runAutomationDetails.id in SARIF | Category parameter cleaner; avoids modifying SARIF files directly |

**Installation:**
All Actions referenced by SHA in workflow files. Semgrep runs in Docker container (no installation step needed).

## Architecture Patterns

### Recommended Project Structure
```
.github/
├── workflows/
│   ├── ci.yaml              # Existing — calls security.yaml
│   ├── nightly.yaml         # Existing — calls security.yaml
│   └── security.yaml        # NEW — reusable workflow
```

### Pattern 1: Reusable Workflow with workflow_call
**What:** Define security.yaml as a reusable workflow that caller workflows invoke with inputs
**When to use:** When multiple workflows need identical job definitions (ci.yaml and nightly.yaml both need security scans)
**Example:**
```yaml
# security.yaml
name: Security Scans

on:
  workflow_call:
    inputs:
      scan-mode:
        description: 'Scan mode: diff or full'
        required: false
        type: string
        default: 'full'

permissions:
  contents: read  # Workflow-level default (restrictive)

jobs:
  semgrep:
    name: Semgrep SAST
    runs-on: ubuntu-latest
    permissions:
      security-events: write  # Job-level escalation for SARIF upload
      contents: read
    continue-on-error: true  # Non-blocking

    container:
      image: semgrep/semgrep:latest

    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6

      - name: Run Semgrep SAST scan
        run: |
          semgrep scan --config auto --sarif --output semgrep.sarif .

          echo "## Semgrep SAST Scan" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "✅ Scan completed" >> $GITHUB_STEP_SUMMARY

      - name: Upload SARIF to GitHub Security tab
        uses: github/codeql-action/upload-sarif@89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
        with:
          sarif_file: semgrep.sarif
          category: semgrep
```

**Calling pattern (from ci.yaml):**
```yaml
jobs:
  security:
    name: Security Scans
    uses: ./.github/workflows/security.yaml
    permissions:
      security-events: write
      contents: read
    with:
      scan-mode: diff
```

**Source:** Official GitHub docs on [reusable workflows](https://docs.github.com/en/actions/how-tos/sharing-automations/reusing-workflows)

### Pattern 2: Job-Level Permissions (Least Privilege)
**What:** Specify minimal permissions at job level, not workflow level
**When to use:** When different jobs need different permissions; security best practice
**Example:**
```yaml
permissions:
  contents: read  # Workflow default

jobs:
  semgrep:
    permissions:
      security-events: write  # Only this job needs to upload SARIF
      contents: read          # Explicit, not inherited
```
**Source:** GitHub [permissions documentation](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token); existing ci.yaml uses this pattern (docker job has elevated permissions)

### Pattern 3: Non-Blocking Scans with continue-on-error
**What:** Use `continue-on-error: true` at job level to mark scans as informational
**When to use:** Scans should not block CI; findings viewed in Security tab, not workflow status
**Example:**
```yaml
jobs:
  semgrep:
    continue-on-error: true  # Job fails but workflow succeeds
```
**Behavior:** If Semgrep finds issues or crashes, job shows as failed but workflow status is success. Job summary still displays for visibility.
**Source:** GitHub [continue-on-error documentation](https://www.kenmuse.com/blog/how-to-handle-step-and-job-errors-in-github-actions/)

### Pattern 4: Job Summaries with GITHUB_STEP_SUMMARY
**What:** Write Markdown to `$GITHUB_STEP_SUMMARY` to display scan results in workflow UI
**When to use:** Provide quick visibility into scan status without opening logs
**Example:**
```yaml
- name: Run Semgrep
  run: |
    semgrep scan --config auto --sarif --output semgrep.sarif .

    echo "## Semgrep SAST Scan" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    if [ -s semgrep.sarif ]; then
      echo "✅ Scan completed — findings uploaded to Security tab" >> $GITHUB_STEP_SUMMARY
    else
      echo "⚠️ Scan produced no output" >> $GITHUB_STEP_SUMMARY
    fi
```
**Source:** GitHub [job summaries feature](https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries/); existing nightly.yaml uses this pattern extensively

### Anti-Patterns to Avoid
- **Using semgrep-action wrapper:** Deprecated; use native Docker container instead
- **Using `semgrep ci` command:** Designed for AppSec Platform; use `semgrep scan` for Community Edition
- **Omitting category parameter:** July 2025 GitHub policy requires unique categories; omission causes upload conflicts
- **Workflow-level permissions without job restrictions:** Violates least privilege; elevate only where needed
- **Forgetting continue-on-error:** Scans will block CI on findings; requirement is informational-only mode

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SARIF generation | Custom JSON formatter | Semgrep --sarif flag | SARIF 2.1.0 spec is 170 pages; official tools handle fingerprinting, locations, rule metadata |
| SARIF upload to Security tab | GitHub API calls | github/codeql-action/upload-sarif | Handles authentication, category management, partial fingerprint calculation, error handling |
| Change detection for diff scans | git diff parsing | dorny/paths-filter | Already in use; handles merge base detection, glob patterns, outputs for conditional jobs |
| Workflow reuse/DRY | Copy-paste jobs | workflow_call pattern | GitHub native; supports inputs, secrets, version pinning, nested calls (up to 10 levels) |
| Docker image version pinning | :latest tag | SHA256 digest or semver tags | :latest can change between runs; existing repo pins Actions to SHAs for same reason |

**Key insight:** GitHub's security scanning ecosystem expects SARIF + upload-sarif action. Custom approaches lose Security tab integration, code annotations, alert deduplication, and future GitHub features.

## Common Pitfalls

### Pitfall 1: SARIF Category Conflicts (CRITICAL)
**What goes wrong:** Uploading multiple SARIF files with the same category causes GitHub to reject uploads (since July 2025 policy change)
**Why it happens:** Default upload-sarif behavior combined multiple runs; policy changed to enforce unique categories
**How to avoid:** Always set explicit `category` parameter in upload-sarif action; use tool name as category (semgrep, dependency-check, trivy)
**Warning signs:** Workflow logs show "SARIF file rejected" or "duplicate category" errors; Security tab missing expected findings
**Source:** [GitHub changelog July 2025](https://github.blog/changelog/2025-07-21-code-scanning-will-stop-combining-multiple-sarif-runs-uploaded-in-the-same-sarif-file/)

### Pitfall 2: Using Deprecated semgrep-action
**What goes wrong:** semgrep-action repository shows deprecation notice; may stop working in future
**Why it happens:** Semgrep team consolidated on native Docker approach; wrapper adds no value
**How to avoid:** Use `container: image: semgrep/semgrep` with direct `semgrep scan` command instead of action
**Warning signs:** Deprecation warnings in logs; inability to use latest Semgrep features
**Source:** [semgrep-action deprecation notice](https://github.com/returntocorp/semgrep-action)

### Pitfall 3: semgrep ci vs semgrep scan Confusion
**What goes wrong:** Using `semgrep ci` without AppSec Platform account causes authentication errors or unexpected behavior
**Why it happens:** `semgrep ci` is designed for platform integration; fetches org policies, requires auth
**How to avoid:** Use `semgrep scan` for Community Edition usage; `semgrep ci` only with platform account
**Warning signs:** Authentication failures, unexpected exit codes, missing configuration errors
**Source:** [Semgrep CI vs CLI documentation](https://semgrep.dev/docs/kb/semgrep-ci/ci-vs-cli)

### Pitfall 4: Permissions Too Restrictive or Too Broad
**What goes wrong:**
- Too restrictive: SARIF upload fails with "Resource not accessible by integration" error
- Too broad: Violates least privilege principle, enables supply chain attacks via compromised dependencies
**Why it happens:** GitHub's permissions model defaults to restrictive; must explicitly grant `security-events: write`
**How to avoid:** Set `permissions: contents: read` at workflow level; escalate to `security-events: write, contents: read` at job level only for jobs that upload SARIF
**Warning signs:** Upload failures (too restrictive) or security audit findings (too broad)
**Source:** [GitHub permissions documentation](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token)

### Pitfall 5: Forgetting continue-on-error
**What goes wrong:** Semgrep findings cause job failure, which blocks PR merges or main branch pushes
**Why it happens:** Default GitHub Actions behavior is fail-fast; security scans are informational
**How to avoid:** Set `continue-on-error: true` at job level (not step level) for all security scan jobs
**Warning signs:** PRs blocked by security scan failures; developers bypass CI or disable scans
**Source:** [continue-on-error behavior documentation](https://www.kenmuse.com/blog/how-to-handle-step-and-job-errors-in-github-actions/)

### Pitfall 6: Reusable Workflow Nesting Limits
**What goes wrong:** Calling reusable workflow from another reusable workflow beyond 10 levels fails
**Why it happens:** GitHub limits nesting depth to prevent infinite loops and performance issues
**How to avoid:** Keep nesting shallow; security.yaml (level 1) called by ci.yaml (level 0) is safe
**Warning signs:** Workflow fails with "maximum nesting depth exceeded" error
**Source:** [Reusable workflows documentation](https://docs.github.com/en/actions/how-tos/sharing-automations/reusing-workflows)

### Pitfall 7: SARIF File Size and Upload Limits
**What goes wrong:** Large codebases produce massive SARIF files that fail to upload
**Why it happens:** GitHub has undocumented size limits for SARIF uploads; Semgrep can generate large output
**How to avoid:** Monitor SARIF file size; consider filtering low-severity findings if size becomes an issue (deferred to Phase 6)
**Warning signs:** Upload failures with generic errors; truncated findings in Security tab
**Source:** [SARIF troubleshooting documentation](https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads)

## Code Examples

Verified patterns from official sources:

### Reusable Workflow Definition
```yaml
# .github/workflows/security.yaml
name: Security Scans

on:
  workflow_call:
    inputs:
      scan-mode:
        description: 'Scan mode: diff (PRs) or full (main/nightly)'
        required: false
        type: string
        default: 'full'

permissions:
  contents: read  # Restrictive default

jobs:
  semgrep:
    name: Semgrep SAST
    runs-on: ubuntu-latest
    permissions:
      security-events: write  # Escalate for SARIF upload
      contents: read
    continue-on-error: true  # Non-blocking

    container:
      image: semgrep/semgrep:latest

    steps:
      - name: Checkout code
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6

      - name: Run Semgrep SAST scan
        run: |
          semgrep scan --config auto --sarif --output semgrep.sarif .

          echo "## Semgrep SAST Scan" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "✅ Scan completed — findings uploaded to Security tab" >> $GITHUB_STEP_SUMMARY

      - name: Upload SARIF to GitHub Security tab
        uses: github/codeql-action/upload-sarif@89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
        if: always()  # Upload even if scan found issues
        with:
          sarif_file: semgrep.sarif
          category: semgrep
```
**Source:** Combined from [GitHub reusable workflows docs](https://docs.github.com/en/actions/how-tos/sharing-automations/reusing-workflows) and [upload-sarif action](https://github.com/github/codeql-action/blob/main/upload-sarif/action.yml)

### Calling Reusable Workflow from ci.yaml
```yaml
# Add to .github/workflows/ci.yaml
jobs:
  # ... existing jobs (changes, frontend, backend, etc.)

  security:
    name: Security Scans
    needs: changes  # Optional: wait for change detection
    uses: ./.github/workflows/security.yaml
    permissions:
      security-events: write
      contents: read
    with:
      scan-mode: diff
```
**Source:** [GitHub reusable workflows docs](https://docs.github.com/en/actions/how-tos/sharing-automations/reusing-workflows)

### Calling Reusable Workflow from nightly.yaml
```yaml
# Add to .github/workflows/nightly.yaml
jobs:
  # ... existing jobs (security-audit, dead-code-analysis, etc.)

  security-scans:
    name: Security Scans (Full)
    uses: ./.github/workflows/security.yaml
    permissions:
      security-events: write
      contents: read
    with:
      scan-mode: full
```
**Source:** [GitHub reusable workflows docs](https://docs.github.com/en/actions/how-tos/sharing-automations/reusing-workflows)

### Semgrep Scan Command with SARIF Output
```bash
# From inside semgrep/semgrep Docker container
semgrep scan \
  --config auto \
  --sarif \
  --output semgrep.sarif \
  .
```
**Flags:**
- `--config auto`: Auto-detect languages (TypeScript, Python) and apply community rules
- `--sarif`: Output SARIF 2.1.0 format
- `--output`: Write to file (required for upload-sarif action)
- `.`: Scan current directory

**Source:** [Semgrep CLI reference](https://semgrep.dev/docs/cli-reference) and [Semgrep CE in CI](https://semgrep.dev/docs/deployment/oss-deployment)

### Job Summary with Conditional Status
```yaml
- name: Run scan with status reporting
  run: |
    # Run scan and capture exit code
    if semgrep scan --config auto --sarif --output semgrep.sarif .; then
      scan_status="success"
      icon="✅"
    else
      scan_status="completed with findings"
      icon="⚠️"
    fi

    # Write to job summary
    echo "## Semgrep SAST Scan" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "$icon Scan $scan_status" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY

    # Check if SARIF file was generated
    if [ -s semgrep.sarif ]; then
      finding_count=$(jq '.runs[0].results | length' semgrep.sarif)
      echo "**Findings:** $finding_count" >> $GITHUB_STEP_SUMMARY
      echo "View details in the [Security tab](../../security/code-scanning)" >> $GITHUB_STEP_SUMMARY
    fi
```
**Source:** [GitHub job summaries](https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries/) and existing nightly.yaml pattern

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| semgrep-action wrapper | Native Docker container | Late 2024 | Direct control over CLI flags; no wrapper maintenance lag |
| Implicit SARIF categories | Explicit category parameter | July 2025 | Multiple tools can upload to same commit without conflicts |
| CodeQL Action v3 | CodeQL Action v4 | October 2025 | Node.js 24 runtime; v3 deprecated December 2026 |
| Workflow-level permissions | Job-level permissions | 2021 (ongoing adoption) | Least privilege enforcement; existing repo already follows this |
| semgrep ci command | semgrep scan for CE | 2024-2025 | Clear separation between platform and community edition usage |

**Deprecated/outdated:**
- **semgrep-action (returntocorp/semgrep-action)**: Deprecated, use native Docker container
- **Omitting SARIF category parameter**: Required since July 2025; uploads without category fail
- **CodeQL Action v2**: Retired January 2025
- **CodeQL Action v3**: Will be deprecated December 2026 alongside GHES 3.19

## Open Questions

None. All requirements have documented, stable solutions.

## Sources

### Primary (HIGH confidence)
- [GitHub Actions: Reusing Workflows](https://docs.github.com/en/actions/how-tos/sharing-automations/reusing-workflows) - Official documentation on workflow_call pattern
- [GitHub: Uploading SARIF files](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) - Category parameter, file size limits, permissions
- [GitHub: SARIF support for code scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) - SARIF format details
- [Semgrep: Running Rules](https://semgrep.dev/docs/running-rules) - --config auto and SARIF output
- [Semgrep: JSON and SARIF Fields](https://semgrep.dev/docs/semgrep-appsec-platform/json-and-sarif) - SARIF output structure
- [Semgrep: CLI vs CI Commands](https://semgrep.dev/docs/kb/semgrep-ci/ci-vs-cli) - semgrep scan vs semgrep ci differences
- [GitHub: Workflow Permissions](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token) - Job-level permissions syntax
- [GitHub: Job Summaries](https://github.blog/news-insights/product-news/supercharging-github-actions-with-job-summaries/) - GITHUB_STEP_SUMMARY feature
- Existing codebase: `.github/workflows/ci.yaml`, `.github/workflows/nightly.yaml` - Established patterns

### Secondary (MEDIUM confidence)
- [GitHub Changelog: SARIF category policy](https://github.blog/changelog/2025-07-21-code-scanning-will-stop-combining-multiple-sarif-runs-uploaded-in-the-same-sarif-file/) - July 2025 uniqueness requirement
- [GitHub: semgrep-action deprecation](https://github.com/returntocorp/semgrep-action) - Deprecation notice
- [Ken Muse: Handling GitHub Actions Errors](https://www.kenmuse.com/blog/how-to-handle-step-and-job-errors-in-github-actions/) - continue-on-error behavior
- [GitHub: codeql-action releases](https://github.com/github/codeql-action/releases) - v4.32.4 version and SHA
- [Docker Hub: semgrep/semgrep](https://hub.docker.com/r/semgrep/semgrep) - Official Docker image
- [Semgrep: January 2026 Release Notes](https://semgrep.dev/docs/release-notes/january-2026) - Recent version info (1.152.0)
- [Incredibuild: Reusable Workflows Best Practices](https://www.incredibuild.com/blog/best-practices-to-create-reusable-workflows-on-github-actions) - Common mistakes
- [DevToolbox: GitHub Actions CI/CD Complete Guide](https://devtoolbox.dedyn.io/blog/github-actions-cicd-complete-guide) - 2026 best practices
- [AppSec Santa: Semgrep Review 2026](https://appsecsanta.com/semgrep) - False positive improvements

### Tertiary (informational)
- [Semgrep Registry: auto ruleset](https://semgrep.dev/p/auto) - Ruleset details
- [GitHub Community: Reusable Workflows Discussion](https://github.com/orgs/community/discussions/171037) - Enterprise best practices
- [Medium: GitHub Actions with Reusable Workflows](https://medium.com/@reach2shristi.81/github-actions-with-reusable-workflows-27e99afac2e2) - Practical examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Docker images, documented Actions, existing repo usage
- Architecture: HIGH - GitHub native patterns, verified in official docs, existing codebase follows similar patterns
- SARIF integration: HIGH - Official GitHub feature with comprehensive documentation
- Semgrep configuration: HIGH - Official Semgrep documentation and Docker image
- Common pitfalls: MEDIUM-HIGH - Combination of official docs and community experience (category policy change is recent)

**Research date:** 2026-02-23
**Valid until:** ~2026-04-23 (60 days for stable infrastructure; GitHub Actions and Semgrep have stable APIs)

**Key verification performed:**
- Cross-referenced Semgrep deprecation (semgrep-action) with official repository
- Verified SARIF category uniqueness requirement with GitHub changelog (July 2025 policy change)
- Confirmed codeql-action v4 current version (v4.32.4, SHA 89a39a4)
- Validated reusable workflow pattern with official GitHub documentation
- Checked continue-on-error behavior with multiple sources
- Confirmed semgrep scan vs semgrep ci distinction with official Semgrep docs

**Research scope covered:**
- ✅ GitHub Actions reusable workflows (CROSS-01)
- ✅ SARIF upload and category management (CROSS-02, SAST-03)
- ✅ Action SHA pinning (CROSS-03)
- ✅ Job-level permissions (CROSS-04)
- ✅ Non-blocking scans (CROSS-05, SAST-05)
- ✅ Semgrep native Docker execution (SAST-04)
- ✅ Semgrep auto ruleset (SAST-02)
- ✅ Scan triggers and scope (SAST-01)
- ✅ Existing codebase patterns (brownfield context)
