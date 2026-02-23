# Phase 2: SCA & Repository Health - Research

**Researched:** 2026-02-23
**Domain:** Software Composition Analysis (SCA) and Repository Security Posture
**Confidence:** HIGH

## Summary

Phase 2 adds OWASP Dependency-Check for vulnerability scanning of npm and Python dependencies, plus OpenSSF Scorecard for repository security posture assessment. Both tools integrate with GitHub Security tab via SARIF uploads and follow Phase 1's established patterns.

OWASP Dependency-Check scans package-lock.json (npm) and requirements.txt (Python) against the NVD database. The tool requires NVD database caching (24h TTL) to avoid rate limits, and benefits significantly from an NVD API key (free, strongly recommended). Dependency-Check integrates as a new job in the existing security.yaml workflow.

OpenSSF Scorecard MUST run in an isolated workflow due to strict GitHub API requirements when publishing results. The scorecard-action enforces workflow restrictions (no top-level env vars, no containers, limited approved actions) to maintain API integrity. Scorecard requires id-token: write permission for its publish_results feature.

Both scans are non-blocking (continue-on-error: true) and upload SARIF with unique categories to prevent conflicts in GitHub Security tab.

**Primary recommendation:** Extend security.yaml with Dependency-Check job using owasp/dependency-check Docker image. Create separate scorecard.yaml workflow due to publish_results restrictions. Cache NVD data with datetime-based keys. Document NVD_API_KEY secret requirement in README with graceful degradation if absent.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None - all decisions delegated to Claude.

### Claude's Discretion
All implementation decisions delegated to Claude. Use research findings, Phase 1 patterns, and existing CI conventions.

**Dependency-Check integration:**
- Add as a new job in security.yaml (extends Phase 1 pattern)
- Scan both `frontend/package-lock.json` and `backend/uv.lock` (or equivalent pip lockfile)
- NVD database caching via GitHub Actions cache with 24h TTL to avoid rate limiting
- NVD API key passed via repository secret (user must configure `NVD_API_KEY` secret)
- SARIF output with category: `dependency-check`
- HTML report uploaded as artifact for human review (secondary output)
- Job-level permissions: security-events: write, contents: read
- continue-on-error: true (non-blocking)

**Scorecard integration:**
- Isolated workflow (`scorecard.yaml`) — NOT embedded in security.yaml
- Research identified strict Scorecard restrictions: requires its own workflow with specific permissions
- Triggers: pushes to main only (Scorecard doesn't support PR scanning)
- Permissions: contents: read, security-events: write, id-token: write (for publish_results)
- SARIF output with category: `scorecard`
- continue-on-error: true (non-blocking)
- SHA-pinned ossf/scorecard-action (exact SHA to be determined by research)

**NVD API key handling:**
- Document in README that `NVD_API_KEY` secret is required for Dependency-Check
- Scan should still work without key (slower, rate-limited) — graceful degradation
- Key is free: https://nvd.nist.gov/developers/request-an-api-key

**Scan triggers:**
- Dependency-Check: pushes to main (via security.yaml, same as Semgrep)
- Scorecard: pushes to main (via its own scorecard.yaml)
- Both run on nightly schedule as well

**SARIF conventions (extending Phase 1):**
- dependency-check → category: `dependency-check`
- scorecard → category: `scorecard`
- Follows Phase 1 convention of unique categories per tool

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCA-01 | OWASP Dependency-Check scans npm and pip dependencies on pushes to main | Docker image owasp/dependency-check scans package-lock.json (npm) and requirements.txt (Python with --enableExperimental) |
| SCA-02 | Dependency-Check outputs SARIF and uploads to GitHub Security tab with unique category | CLI supports --format SARIF; upload via github/codeql-action/upload-sarif@89a39a4e59826350b863aa6b6252a07ad50cf83e with category: dependency-check |
| SCA-03 | NVD database is cached in CI to avoid rate limiting and reduce scan time | Cache ~/.m2/repository or data directory with datetime-based key (24h TTL); official docs show GitHub Actions cache example |
| SCA-04 | Dependency-Check scan is non-blocking — workflow succeeds regardless of findings | Job-level continue-on-error: true (Phase 1 pattern) |
| SCORE-01 | OpenSSF Scorecard runs on pushes to main in an isolated workflow | ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a (v2.4.3); publish_results enforces strict workflow restrictions requiring isolation |
| SCORE-02 | Scorecard outputs SARIF and uploads to GitHub Security tab with unique category | results_format: sarif; upload via github/codeql-action/upload-sarif with category: scorecard |
| SCORE-03 | Scorecard workflow uses required permissions (contents: read, security-events: write, id-token: write) | Official example shows job-level permissions with id-token: write for publish_results: true |
| SCORE-04 | Scorecard scan is non-blocking — workflow succeeds regardless of score | Job-level continue-on-error: true (Phase 1 pattern) |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| owasp/dependency-check | latest (12.2.0 as of 2026-01) | Docker image for SCA scanning | Official OWASP project; nightly builds include updated NVD database; supports npm and Python analyzers |
| ossf/scorecard-action | v2.4.3 (SHA: 4eaacf0) | GitHub Action for repository security posture | Official OpenSSF project; required for GitHub Security tab integration; enforces API integrity via workflow restrictions |
| github/codeql-action/upload-sarif | v4.32.4 (SHA: 89a39a4e59826350b863aa6b6252a07ad50cf83e) | SARIF upload to GitHub Security | Official GitHub action; already used in Phase 1 for Semgrep; consistent with repo conventions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/cache | v6 (SHA-pinned) | Cache NVD database | Required for Dependency-Check; avoid rate limits; 24h TTL with datetime-based key |
| NVD API key | N/A (free registration) | Accelerate NVD database updates | Strongly recommended; free from nvd.nist.gov; avoid 403 errors; graceful degradation if absent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OWASP Dependency-Check | Snyk, Trivy | Dependency-Check is free and NVD-based (requirement); Snyk is commercial; Trivy focuses on containers (Phase 3) |
| ossf/scorecard-action | Manual scorecard CLI | Action provides GitHub integration, SARIF output, and publish_results API; CLI requires custom scripting |
| Native Docker container | dependency-check/Dependency-Check_Action | GitHub Action wrapper is simpler but less flexible; native Docker follows Phase 1 pattern and allows direct CLI control |

**Installation:**
```bash
# No installation needed - uses Docker images directly in GitHub Actions
# NVD API key registration (free, 1-2 day approval):
# https://nvd.nist.gov/developers/request-an-api-key
```

## Architecture Patterns

### Recommended Workflow Structure
```
.github/workflows/
├── security.yaml        # Reusable workflow (extend with Dependency-Check job)
│   ├── semgrep job     # Existing (Phase 1)
│   └── dependency-check job  # NEW (Phase 2)
├── scorecard.yaml      # NEW isolated workflow (Phase 2)
├── ci.yaml             # Calls security.yaml (existing)
└── nightly.yaml        # Calls security.yaml (existing)
```

### Pattern 1: Dependency-Check Job in Reusable Workflow
**What:** Add dependency-check job to existing security.yaml workflow alongside semgrep
**When to use:** Scanning npm and Python dependencies on pushes to main
**Example:**
```yaml
# Source: Official OWASP Dependency-Check documentation + Phase 1 patterns
jobs:
  dependency-check:
    name: OWASP Dependency-Check
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    continue-on-error: true

    steps:
      - name: Checkout code
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6

      - name: Cache NVD database
        uses: actions/cache@1bd1e32a3bdc45362d1e726936510720a7c30a57 # v4
        with:
          path: ~/.m2/repository/org/owasp
          key: ${{ runner.os }}-nvd-${{ steps.get-date.outputs.datetime }}
          restore-keys: |
            ${{ runner.os }}-nvd-

      - name: Get datetime for cache key
        id: get-date
        run: echo "datetime=$(date -u '+%Y%m%d%H')" >> $GITHUB_OUTPUT

      - name: Run Dependency-Check scan
        run: |
          docker run --rm \
            -v $(pwd):/src \
            -v ~/.m2/repository:/usr/share/dependency-check/data \
            owasp/dependency-check:latest \
            --scan /src/frontend/package-lock.json \
            --scan /src/backend \
            --format SARIF \
            --format HTML \
            --out /src/reports \
            --project "Maxwell's Wallet" \
            --nvdApiKey ${{ secrets.NVD_API_KEY || '' }} \
            --enableExperimental

      - name: Upload SARIF to GitHub Security tab
        uses: github/codeql-action/upload-sarif@89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
        if: always()
        with:
          sarif_file: reports/dependency-check-report.sarif
          category: dependency-check

      - name: Upload HTML report as artifact
        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v4
        if: always()
        with:
          name: dependency-check-report
          path: reports/dependency-check-report.html
          retention-days: 30
```

### Pattern 2: Isolated Scorecard Workflow
**What:** Separate workflow for Scorecard due to publish_results restrictions
**When to use:** Repository security posture scanning on pushes to main
**Example:**
```yaml
# Source: https://github.com/ossf/scorecard/blob/main/.github/workflows/scorecard-analysis.yml
name: OpenSSF Scorecard

on:
  push:
    branches:
      - main
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sundays at 2 AM UTC

permissions: read-all

jobs:
  analysis:
    name: Scorecard Analysis
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      id-token: write
      contents: read
    continue-on-error: true

    steps:
      - name: Checkout code
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
        with:
          persist-credentials: false

      - name: Run OpenSSF Scorecard
        uses: ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a # v2.4.3
        with:
          results_file: results.sarif
          results_format: sarif
          publish_results: true

      - name: Upload SARIF to GitHub Security tab
        uses: github/codeql-action/upload-sarif@89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
        with:
          sarif_file: results.sarif
          category: scorecard

      - name: Upload results artifact
        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v4
        with:
          name: scorecard-results
          path: results.sarif
          retention-days: 5
```

### Pattern 3: NVD Database Caching Strategy
**What:** Cache NVD data directory with datetime-based key (24h TTL)
**When to use:** Every Dependency-Check job to avoid rate limits
**Example:**
```yaml
# Source: https://jeremylong.github.io/DependencyCheck/data/cache-action.html
- name: Get datetime for cache key
  id: get-date
  run: echo "datetime=$(date -u '+%Y%m%d%H')" >> $GITHUB_OUTPUT

- name: Cache NVD database
  uses: actions/cache@1bd1e32a3bdc45362d1e726936510720a7c30a57 # v4
  with:
    path: ~/.m2/repository/org/owasp
    key: ${{ runner.os }}-nvd-${{ steps.get-date.outputs.datetime }}
    restore-keys: |
      ${{ runner.os }}-nvd-
```
**Rationale:** Datetime in cache key ensures NVD data refreshes every hour. NVD database changes independently of project dependencies, so dependency-based cache keys would be stale.

### Anti-Patterns to Avoid
- **Embedding Scorecard in security.yaml:** Violates publish_results restrictions (no top-level env vars, no containers, limited actions). Results in API rejection.
- **Using dependency-check GitHub Action wrapper:** Less control than native Docker; Phase 1 established native container pattern with Semgrep.
- **Omitting --enableExperimental for Python:** Python analyzers (pip) are experimental and disabled by default. Scan will miss backend dependencies.
- **Skipping NVD caching:** Triggers rate limits (403 errors), slows scans significantly. NVD API enforces strict limits even with API key.
- **Using dependency-based cache key for NVD:** NVD database updates independently of project dependencies. Time-based key (24h TTL) is correct approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NVD database updates | Custom NVD API sync script | OWASP Dependency-Check with caching | NVD API rate limits (403 errors), complex parsing, CPE matching logic, ongoing maintenance as NVD schema evolves |
| SARIF generation for CVEs | Custom SARIF formatter from NVD data | Dependency-Check --format SARIF | SARIF 2.1.0 spec compliance, GitHub-specific extensions, proper rule/result mapping, tested integration |
| Repository security checks | Custom GitHub API queries for branch protection, etc. | OpenSSF Scorecard | 19+ security checks (token permissions, pinned dependencies, SAST, branch protection, etc.), scoring algorithm, maintained by OpenSSF |
| Scorecard workflow compliance | Manual workflow validation | ossf/scorecard-action publish_results restrictions | API enforces workflow restrictions; manual validation misses edge cases and breaks when rules change |

**Key insight:** Both tools solve deceptively complex problems. NVD database management involves rate limits, caching strategies, and CPE disambiguation. Scorecard checks require GitHub API knowledge across multiple security domains. These are mature, maintained tools that handle edge cases custom scripts would miss.

## Common Pitfalls

### Pitfall 1: NVD API Rate Limiting (403 Forbidden)
**What goes wrong:** Dependency-Check fails with HTTP 403 errors during NVD database updates, even with valid API key
**Why it happens:** NVD API enforces rate limits (6 requests/30 seconds without key, stricter limits with key across multiple builds). Single API key shared across CI jobs hits limits quickly.
**How to avoid:**
1. Implement caching with 24h TTL (datetime-based key)
2. Configure NVD_API_KEY secret (free registration, 1-2 day approval)
3. Accept graceful degradation if key absent (slower, but works)
4. Monitor for 403 errors and increase cache TTL if needed
**Warning signs:** Job logs show "HTTP 403 Forbidden" when accessing NVD API; scan takes excessively long (>5 minutes)

### Pitfall 2: Scorecard Workflow Restrictions Violated
**What goes wrong:** Scorecard API rejects results; workflow fails with validation error
**Why it happens:** publish_results: true enforces strict rules: no top-level env vars, no containers, no workflow-level write permissions, limited approved actions. Embedding in security.yaml violates multiple restrictions.
**How to avoid:**
1. Use isolated workflow (scorecard.yaml) with ONLY scorecard steps
2. No top-level env or defaults blocks
3. Job-level permissions only (no workflow-level)
4. Only approved actions: checkout, upload-artifact, codeql-action/upload-sarif, scorecard-action
5. Ubuntu runners only (no self-hosted, containers, or services)
**Warning signs:** Scorecard step fails with "workflow validation error"; results don't appear on scorecard.dev; API rejection message in logs

### Pitfall 3: Python Dependencies Not Scanned (Missing --enableExperimental)
**What goes wrong:** Dependency-Check scans frontend (npm) but misses backend (Python) vulnerabilities entirely
**Why it happens:** Python analyzers (pip, Python dist) are experimental and disabled by default. Without --enableExperimental flag, backend dependencies are silently skipped.
**How to avoid:**
1. Always include --enableExperimental flag for Dependency-Check
2. Verify scan includes requirements.txt in backend/ directory
3. Check SARIF output for Python package CVEs (not just npm)
**Warning signs:** Zero Python vulnerabilities reported despite known CVEs in backend dependencies; HTML report shows only npm packages

### Pitfall 4: Wrong Python Dependency Format
**What goes wrong:** Dependency-Check cannot analyze uv.lock files; backend scan finds nothing
**Why it happens:** OWASP Dependency-Check's experimental pip analyzer ONLY supports files named exactly "requirements.txt". It does not support uv.lock, pyproject.toml, poetry.lock, or Pipfile formats.
**How to avoid:**
1. Generate requirements.txt from uv.lock before scanning: `uv pip compile pyproject.toml -o requirements.txt`
2. OR scan requirements.txt if it exists in repo
3. OR use alternative Python SCA tool (uv-secure, Safety, pip-audit) for uv.lock
4. Document limitation in README
**Warning signs:** Scan completes but finds zero Python packages despite backend dependencies existing; log shows "no Python artifacts found"

### Pitfall 5: Stale NVD Cache from Dependency-Based Key
**What goes wrong:** Vulnerabilities discovered yesterday don't appear in scan results today
**Why it happens:** Using dependency file hash in cache key (e.g., hashFiles('**/package-lock.json')) keeps NVD database frozen until dependencies change. NVD updates daily with new CVEs independent of project changes.
**How to avoid:**
1. Use datetime-based cache key with 24h TTL: date -u '+%Y%m%d%H'
2. Fallback restore-keys allow progressive cache reuse
3. Accept cache miss once daily to refresh NVD data
**Warning signs:** Known CVE published recently doesn't appear; scan results identical across multiple days despite NVD updates

### Pitfall 6: Missing SHA Pinning for Actions
**What goes wrong:** Dependency-Check or Scorecard workflows break unexpectedly when action updates
**Why it happens:** Using @v4 or @v2 tags instead of commit SHAs. Action updates can introduce breaking changes or malicious code.
**How to avoid:**
1. Pin all actions to commit SHAs with version comment: @89a39a4e59826350b863aa6b6252a07ad50cf83e # v4.32.4
2. Follows Phase 1 convention (CROSS-03 requirement)
3. Update SHAs deliberately, not automatically
**Warning signs:** Phase 1 CodeQL alerts about unpinned actions; workflow breaks after action maintainer releases new version

## Code Examples

Verified patterns from official sources:

### Dependency-Check Docker Invocation
```bash
# Source: https://hub.docker.com/r/owasp/dependency-check + https://jeremylong.github.io/DependencyCheck/dependency-check-cli/arguments.html
docker run --rm \
  -v $(pwd):/src \
  -v ~/.m2/repository:/usr/share/dependency-check/data \
  owasp/dependency-check:latest \
  --scan /src/frontend/package-lock.json \
  --scan /src/backend \
  --format SARIF \
  --format HTML \
  --out /src/reports \
  --project "Maxwell's Wallet" \
  --nvdApiKey "${NVD_API_KEY}" \
  --enableExperimental
```
**Key flags:**
- `--scan` accepts multiple paths (frontend npm, backend Python)
- `--format SARIF` generates GitHub Security-compatible output
- `--format HTML` creates human-readable report (artifact upload)
- `--nvdApiKey` accelerates updates (optional but strongly recommended)
- `--enableExperimental` enables Python analyzers (REQUIRED for pip)

### Scorecard Action Configuration
```yaml
# Source: https://github.com/ossf/scorecard/blob/main/.github/workflows/scorecard-analysis.yml
- name: Run OpenSSF Scorecard
  uses: ossf/scorecard-action@4eaacf0543bb3f2c246792bd56e8cdeffafb205a # v2.4.3
  with:
    results_file: results.sarif
    results_format: sarif
    publish_results: true
```
**Critical inputs:**
- `results_format: sarif` for GitHub Security tab integration
- `publish_results: true` enables scorecard.dev API and badge (requires id-token: write permission)

### NVD Cache Restore with Fallback
```yaml
# Source: https://jeremylong.github.io/DependencyCheck/data/cache-action.html
- name: Restore NVD database cache
  uses: actions/cache@1bd1e32a3bdc45362d1e726936510720a7c30a57 # v4
  with:
    path: ~/.m2/repository/org/owasp
    key: ${{ runner.os }}-nvd-${{ steps.get-date.outputs.datetime }}
    restore-keys: |
      ${{ runner.os }}-nvd-
```
**Fallback strategy:** Primary key includes datetime (24h TTL). If miss, restore-keys finds most recent cache from any date. Progressive cache reuse speeds subsequent runs.

### Generating requirements.txt from uv.lock
```bash
# Source: Research finding - OWASP Dependency-Check requires requirements.txt format
# uv.lock is not supported by pip analyzer

# Option 1: Generate from pyproject.toml dependencies
uv pip compile pyproject.toml -o backend/requirements.txt

# Option 2: Export from current environment
uv pip freeze > backend/requirements.txt

# Then scan the generated requirements.txt
docker run --rm -v $(pwd):/src owasp/dependency-check:latest \
  --scan /src/backend/requirements.txt \
  --enableExperimental
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NVD Data Feeds (XML) | NVD API 2.0 (JSON) | 2023-12 | Feeds deprecated; API required; rate limits enforced; API key strongly recommended; caching mandatory |
| Dependency-Check Action wrapper | Native Docker container | 2024+ (community shift) | More control over CLI flags; follows Phase 1 pattern; no wrapper maintenance dependency |
| Scorecard without publish_results | publish_results: true | 2022+ (v2.x) | Enables scorecard.dev API, badges, public visibility; enforces strict workflow restrictions |
| Workflow-level permissions | Job-level permissions | 2023+ (security hardening) | Least privilege; Phase 1 established pattern; required for Scorecard compliance |

**Deprecated/outdated:**
- **NVD Data Feeds (XML):** Deprecated December 2023; NVD API 2.0 required; old feeds no longer updated
- **dependency-check/Dependency-Check_Action GitHub Action:** Not deprecated but less flexible than native Docker; Phase 1 pattern uses containers directly
- **Running Scorecard without id-token: write:** Older versions didn't require it; v2.x with publish_results requires OIDC token for API integrity

## Open Questions

1. **Alternative Python SCA Tools for uv.lock**
   - What we know: OWASP Dependency-Check does NOT support uv.lock format (only requirements.txt)
   - What's unclear: Should we add uv-secure or pip-audit as supplemental Python scanner, or generate requirements.txt from uv.lock?
   - Recommendation: Start with generating requirements.txt from uv.lock (uv pip compile). If this proves insufficient (missing transitive deps, accuracy issues), evaluate adding pip-audit or uv-secure in Phase 2 enhancements. Document limitation in README.

2. **Scorecard Category in SARIF Upload**
   - What we know: Official Scorecard example workflow does NOT include category parameter in upload-sarif step
   - What's unclear: Is category automatically set by scorecard-action, or should we add category: scorecard explicitly?
   - Recommendation: Add category: scorecard explicitly to match Phase 1 pattern (Semgrep uses category: semgrep). Test that it doesn't conflict with Scorecard's SARIF generation. Ensures unique categorization in GitHub Security tab.

3. **NVD Cache Path Consistency**
   - What we know: Official docs show caching ~/.m2/repository (Maven convention), but Dependency-Check Docker image may use /usr/share/dependency-check/data
   - What's unclear: What's the correct cache path when using owasp/dependency-check Docker image?
   - Recommendation: Mount both paths to be safe: -v ~/.m2/repository:/usr/share/dependency-check/data. Test cache effectiveness by checking scan duration (should drop from 5+ minutes to <1 minute on cache hit).

## Sources

### Primary (HIGH confidence)
- [OWASP Dependency-Check Official Docs](https://owasp.org/www-project-dependency-check/) - Project overview and capabilities
- [Dependency-Check CLI Arguments](https://jeremylong.github.io/DependencyCheck/dependency-check-cli/arguments.html) - Complete CLI reference including SARIF, NVD API key, data directory
- [Dependency-Check GitHub Actions Caching Guide](https://jeremylong.github.io/DependencyCheck/data/cache-action.html) - Official caching strategy with datetime-based keys
- [Dependency-Check Pip Analyzer](https://dependency-check.github.io/DependencyCheck/analyzers/pip.html) - Python support (requirements.txt only, experimental, requires --enableExperimental)
- [OpenSSF Scorecard Action Repository](https://github.com/ossf/scorecard-action) - Official action with publish_results restrictions
- [Scorecard Official Workflow Example](https://github.com/ossf/scorecard/blob/main/.github/workflows/scorecard-analysis.yml) - Reference implementation showing all required setup
- [GitHub CodeQL Action Releases](https://github.com/github/codeql-action/releases) - Verified v4.32.4 (SHA: 89a39a4e59826350b863aa6b6252a07ad50cf83e)

### Secondary (MEDIUM confidence)
- [OWASP Dependency-Check on Docker Hub](https://hub.docker.com/r/owasp/dependency-check) - Docker image details (verified with official docs)
- [Medium: OWASP Dependency-Check Database Caching](https://medium.com/@magelan09/pretending-to-be-a-devsecops-professional-ci-cd-pipeline-owasp-dependency-check-database-c95bb1ac6f2f) - CI caching strategies (verified with official docs)
- [Medium: NVD API Key 403 Errors](https://medium.com/@ttlnews/owasp-dependencycheck-returns-http-403-forbidden-accessing-nvd-api-using-api-key-dbf3c78eeafc) - Rate limit issues (corroborated by GitHub issues)
- [GitHub Blog: OpenSSF Scorecard V4](https://github.blog/open-source/reducing-security-risk-oss-actions-opensff-scorecards-v4/) - Scorecard features and integration
- [uv-secure GitHub Repository](https://github.com/owenlamont/uv-secure) - Alternative Python SCA tool for uv.lock (not used in Phase 2)
- [Node.js Update to Scorecard v2.4.0](https://github.com/nodejs/node/commit/80dd38dde3) - Verified SHA for scorecard-action v2.4.0

### Tertiary (LOW confidence - flagged for validation)
- [GitHub Issue #6437: Dependency-Check package-lock.json scanning](https://github.com/jeremylong/DependencyCheck/issues/6437) - npm scanning behavior (needs testing to verify current state)
- [GitHub Issue #7159: Experimental Python false positives](https://github.com/jeremylong/DependencyCheck/issues/7159) - Known Python analyzer issues (experimental status documented)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official OWASP and OpenSSF tools verified with current docs (2026-01 and 2024-09 releases)
- Architecture: HIGH - Scorecard restrictions documented in official README; NVD caching pattern from official docs; Phase 1 patterns established
- Pitfalls: HIGH - NVD rate limits, Python experimental status, Scorecard workflow restrictions all verified from official sources and GitHub issues

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days - tools are stable; NVD API and Scorecard restrictions unlikely to change rapidly)

**Key findings to validate during implementation:**
1. Scorecard category parameter behavior (add explicitly or auto-set?)
2. Correct NVD cache path for Docker image (/usr/share/dependency-check/data vs ~/.m2/repository)
3. Effectiveness of generating requirements.txt from uv.lock via `uv pip compile`
4. Actual scan duration with/without NVD cache to verify caching works
