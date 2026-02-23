# Domain Pitfalls: DevSecOps CI Scanning Integration

**Domain:** GitHub Actions security scanning integration (SAST/DAST/SCA/repo-health)
**Researched:** 2026-02-23
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Multiple SARIF Uploads with Same Tool/Category

**What goes wrong:**
When multiple scanning tools or matrix builds upload SARIF files with the same `tool` and `category` identifiers, GitHub Code Scanning rejects the upload or overwrites previous results. Starting July 2025, GitHub no longer combines multiple SARIF runs with identical tool/category pairs.

**Why it happens:**
Teams run multiple scanners (Semgrep, Dependency-Check, Trivy) without assigning unique categories. Matrix builds (testing multiple Python versions, for example) generate multiple SARIF files that collide. Default configurations often don't set categories at all.

**Consequences:**
- Upload failures with cryptic errors
- Loss of scan results (second upload replaces first)
- Incomplete security visibility (only one tool's findings appear)
- CI pipelines fail unexpectedly

**Prevention:**
- Set unique `category` parameter for each tool in `upload-sarif` action
- Use `runAutomationDetails.id` in SARIF files to define distinct categories
- For matrix builds, include matrix variable in category name (e.g., `dependency-check-python-3.11`)
- Test with multiple uploads before enabling in production

**Detection:**
- Check for "SARIF upload failed" errors in workflow logs
- Missing findings from expected tools in Security tab
- Workflow annotations about duplicate categories

**Phase to address:**
Phase 1 (Initial integration) - Set up category conventions before first tool deployment

**Sources:**
- [GitHub Docs: SARIF support for code scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) [HIGH confidence - official docs]
- [GitHub Changelog: Code scanning will stop combining multiple SARIF runs](https://github.blog/changelog/2025-07-21-code-scanning-will-stop-combining-multiple-sarif-runs-uploaded-in-the-same-sarif-file/) [HIGH confidence - official announcement]

---

### Pitfall 2: GitHub Advanced Security Required for Private Repos

**What goes wrong:**
SARIF uploads to private or internal repositories fail with "GitHub Code Security must be enabled" errors. Teams assume free GitHub Actions can upload security findings, but Code Scanning for private repos requires GitHub Advanced Security (paid feature).

**Why it happens:**
Documentation emphasizes the upload-sarif action but downplays licensing requirements. Teams test on public repos (works fine) then deploy to private repos (fails). Organizational GitHub Advanced Security may not be enabled for all repos.

**Consequences:**
- Complete scan integration failure in private repos
- Wasted implementation effort
- Security findings only visible in workflow logs, not Security tab
- No centralized vulnerability tracking

**Prevention:**
- Verify GitHub Advanced Security license before planning SARIF integration
- For private repos without GHAS, use alternative outputs:
  - Workflow artifacts for scan reports
  - Issue creation for critical findings
  - External dashboards (Defect Dojo, etc.)
- Test in actual target repository (private/public) during proof-of-concept

**Detection:**
- Error message: "GitHub Code Security or GitHub Advanced Security must be enabled"
- Upload-sarif step fails with 403/422 HTTP errors
- Security tab shows no code scanning results

**Phase to address:**
Phase 0 (Pre-planning) - Confirm licensing requirements before roadmap creation

**Sources:**
- [GitHub Docs: Upload fails because GitHub Code Security is disabled](https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads/ghas-required) [HIGH confidence - official docs]
- [GitHub Docs: Uploading a SARIF file to GitHub](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) [HIGH confidence - official docs]

---

### Pitfall 3: Dependency-Check NVD API Rate Limiting

**What goes wrong:**
OWASP Dependency-Check database updates fail with 403 errors when hitting NVD API rate limits. Multiple concurrent builds using the same API key exhaust quota. Without API key, updates are "extremely slow" (5-10x slower).

**Why it happens:**
Teams use single NVD API key across all workflows. Matrix builds spawn multiple jobs simultaneously, all hitting NVD. Free tier allows ~1.5 req/sec; API key gives ~5-10 req/sec, but still insufficient for high-frequency CI.

**Consequences:**
- Stale vulnerability database (weeks/months old data)
- Missed recent CVEs
- Failed CI jobs (database download timeouts)
- Developers bypass scans with `continue-on-error`

**Prevention:**
- Implement caching strategy: cache NVD database, share across jobs
- Use GitHub Actions cache with daily refresh schedule
- Run Dependency-Check on schedule (nightly) not every PR
- Request NVD API key: https://nvd.nist.gov/developers/request-an-api-key
- Consider rate limits when designing matrix build strategies

**Detection:**
- HTTP 403 "rate limit exceeded" in Dependency-Check logs
- Database update step takes >10 minutes or times out
- Warning: "Updates will be extremely slow" (no API key)
- Scan results show no vulnerabilities for known-vulnerable dependencies

**Phase to address:**
Phase 2 (Dependency scanning) - Address before Dependency-Check deployment

**Sources:**
- [GitHub Issue: Is NVD API very slow for dependency check today?](https://github.com/jeremylong/DependencyCheck/issues/6531) [MEDIUM confidence - community reports]
- [Medium: Why Your Dependency Scans Are Slow (and Incomplete) Without an NVD API Key](https://medium.com/@nagendra.raja/why-your-dependency-scans-are-slow-and-incomplete-without-an-nvd-api-key-54d29cb04c6b) [MEDIUM confidence - technical article]
- [Medium: OWASP dependency-check. Solving problem of slow db downloading](https://medium.com/@magelan09/pretending-to-be-a-devsecops-professional-ci-cd-pipeline-owasp-dependency-check-database-c95bb1ac6f2f) [MEDIUM confidence - technical article]

---

### Pitfall 4: OWASP ZAP DAST False Positives and Stability

**What goes wrong:**
ZAP generates high volumes of false positives requiring manual triage. Scans are non-deterministic (different results across runs). Baseline scans time out on complex applications. Configuration is poorly documented, especially for API-only applications.

**Why it happens:**
ZAP is designed for manual security testing, not automated CI. Baseline scan mode is aggressive with limited tuning. Spider follows all links (including logout, admin panels). Default alerts trigger on security headers, test endpoints, health checks.

**Consequences:**
- Alert fatigue (hundreds of false positives per scan)
- Developers ignore all ZAP findings
- Unpredictable CI runtime (5-30+ minutes)
- Breaking working functionality (ZAP triggers logout, corrupts sessions)

**Prevention:**
- Start with baseline mode, tune extensively before active scans
- Use `.zap/rules.tsv` to document excluded alerts with reasons
- Configure spider depth limits and exclusions
- Filter by severity (CRITICAL/HIGH only initially)
- Use `ignore-unfixed: true` pattern to reduce noise
- Run ZAP on isolated test environment, never production
- For APIs: use OpenAPI/Swagger spec instead of spider

**Detection:**
- Hundreds of findings in first scan
- Same endpoints flagged differently across runs
- ZAP times out on scan completion
- Findings on `/health`, `/metrics`, test fixtures

**Phase to address:**
Phase 5 (DAST integration) - Allow 2-3 sprints for tuning; consider deferring to post-MVP

**Sources:**
- [Medium: Managing False Positives in OWASP Zed Attack Proxy (ZAP)](https://jiarongchew.medium.com/managing-false-positives-in-owasp-zed-attack-proxy-zap-a2581e64c249) [MEDIUM confidence - practitioner guide]
- [ZAP FAQ: How do I handle a False Positive?](https://www.zaproxy.org/faq/how-do-i-handle-a-false-positive/) [HIGH confidence - official docs]
- [PeerSpot: OWASP Zap reviews 2026](https://www.peerspot.com/products/owasp-zap-reviews) [LOW confidence - aggregated reviews]

---

### Pitfall 5: OpenSSF Scorecard Workflow Restrictions

**What goes wrong:**
Scorecard Action fails with "workflow does not meet requirements" when `publish_results: true`. Strict constraints on job permissions, approved actions, runner types create conflicts with existing workflow patterns.

**Why it happens:**
Scorecard enforces workflow purity to ensure dataset integrity. Cannot have top-level environment variables, write permissions, or unapproved actions. Teams copy standard workflow patterns (setup-node, custom actions) that violate requirements.

**Consequences:**
- Cannot publish results to OpenSSF database
- Only local JSON output available
- No trend tracking or public scoring
- Integration with other tools (dependabot, branch protection checks) limited

**Prevention:**
- Create dedicated workflow file for Scorecard (don't add to existing workflows)
- Use minimal job: only checkout, scorecard-action, upload-sarif
- Set permissions explicitly at job level: `id-token: write`, `contents: read`, etc.
- Avoid top-level `env:` or `defaults:` blocks entirely
- Use GitHub's new Repository Rules (not classic Branch Protection) for token compatibility

**Detection:**
- Error: "Workflow does not meet OpenSSF Scorecard requirements"
- Upload fails with authentication/token errors
- Results don't appear on scorecard.dev

**Phase to address:**
Phase 4 (Repository health checks) - Plan isolated workflow from start

**Sources:**
- [GitHub: ossf/scorecard-action](https://github.com/ossf/scorecard-action) [HIGH confidence - official repo]
- [GitHub Blog: Reducing security risk in open source software with GitHub Actions and OpenSSF Scorecards V4](https://github.blog/open-source/reducing-security-risk-oss-actions-opensff-scorecards-v4/) [HIGH confidence - official announcement]

---

### Pitfall 6: continue-on-error Creating Security Blind Spots

**What goes wrong:**
Using `continue-on-error: true` to prevent "noisy" scans from blocking CI creates security blind spots. Attackers exploit this by introducing changes that cause security jobs to error out, bypassing all checks.

**Why it happens:**
Teams frustrated by false positives add `continue-on-error: true` to "fix" failing scans. New CVEs appear daily, breaking dependency scans. DAST scans time out intermittently. Easier to silence than tune.

**Consequences:**
- Security scans fail silently (no one notices)
- Vulnerabilities merge into main branch
- False sense of security ("we have scanning enabled")
- Malicious actors can intentionally break scans to bypass guardrails

**Prevention:**
- Never use `continue-on-error: true` for security scans
- For informational-only mode:
  - Use SARIF upload (findings appear in Security tab, don't block CI)
  - Separate scheduled scans from PR checks
  - Set severity thresholds (fail on CRITICAL, warn on others)
- Fix root cause of noise (tune rules, not silence alerts)
- Monitor scan completion rates (alerting when scans error)

**Detection:**
- Workflow shows "success" but security job errored
- No recent Security tab updates despite active development
- Scan steps show "Continuing despite error" annotations

**Phase to address:**
Phase 1 (Initial integration) - Establish policy before first tool deployment

**Sources:**
- [OneUpTime: How to Run Security Scanning with GitHub Actions](https://oneuptime.com/blog/post/2026-01-25-security-scanning-github-actions/view) [MEDIUM confidence - technical guide]
- [GitHub Actions Security Best Practices Cheat Sheet](https://blog.gitguardian.com/github-actions-security-cheat-sheet/) [MEDIUM confidence - practitioner guide]

---

### Pitfall 7: SARIF File Size Limits and Result Truncation

**What goes wrong:**
Large codebases exceed SARIF upload limits (10MB compressed, 25k results per run). GitHub silently truncates results, prioritizing by severity. Teams miss vulnerabilities in truncated findings.

**Why it happens:**
Running broad rulesets (Semgrep `p/default`, all Trivy checks) on large monorepos. Multiple languages/frameworks multiply findings. No awareness of limits until upload fails or results disappear.

**Consequences:**
- Upload failures (>10MB files rejected)
- Silent data loss (GitHub keeps top 5,000 results, drops rest)
- Inconsistent scans (results vary based on ordering)
- False confidence (scan "passed" but missed issues)

**Prevention:**
- Focus rules on high-confidence, high-severity checks
- Use path filters to exclude test fixtures, vendor code, generated files
- Split scans by directory/language if needed (unique categories)
- Monitor SARIF file sizes in CI logs
- Check for truncation warnings in upload output

**Detection:**
- Upload fails with "file too large" error
- Warning: "only the top 5,000 results will be included"
- Inconsistent findings across identical scans
- Expected vulnerabilities missing from Security tab

**Phase to address:**
Phase 3 (SAST integration) - Test with production-scale codebase before rollout

**Sources:**
- [GitHub Docs: SARIF support for code scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) [HIGH confidence - official docs]

---

## Moderate Pitfalls

### Pitfall 8: Incorrect Token Permissions for SARIF Upload

**What goes wrong:**
SARIF uploads fail with permission errors. Required permissions differ for public vs private repos. Least-privilege configurations break uploads.

**Prevention:**
- Always include `security-events: write` for SARIF uploads
- For private repos, add `contents: read` and `actions: read`
- Set permissions at job level, not workflow level (least privilege)
- Test with actual repository visibility (public/private) during development

**Sources:**
- [GitHub Docs: Uploading a SARIF file to GitHub](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) [HIGH confidence]

---

### Pitfall 9: Semgrep Dependabot/Bot PRs Causing Permission Errors

**What goes wrong:**
Semgrep scans fail on Dependabot PRs with permission errors. Default configuration excludes Dependabot, but teams may have other bots (Renovate, custom automation) triggering same issue.

**Prevention:**
- Verify default Semgrep configuration excludes Dependabot PRs
- Add exclusions for organizational bots (Renovate, custom tools)
- If using merge queues, add `merge_group` trigger (otherwise blocks queue)
- For diff-aware scanning in merge queues, explicitly configure (not automatic)

**Sources:**
- [Semgrep Docs: Sample CI configurations](https://semgrep.dev/docs/semgrep-ci/sample-ci-configs) [HIGH confidence]
- [AppSec Guide: Continuous integration with Semgrep](https://appsec.guide/docs/static-analysis/semgrep/continuous-integration/) [MEDIUM confidence]

---

### Pitfall 10: Trivy Image Visibility in buildx

**What goes wrong:**
Trivy can't find Docker images when using `docker buildx` because buildx doesn't export to local cache by default.

**Prevention:**
- Add `--load` flag to `docker buildx build` commands
- Verify image exists with `docker images` before Trivy scan
- Use Trivy's direct image reference if pushing to registry first

**Sources:**
- [Medium: How to Add a Security Scan with Trivy in GitHub Actions](https://medium.com/@vincenthartmann/how-to-add-a-security-scan-with-trivy-in-github-actions-8f16642aa82b) [MEDIUM confidence]

---

### Pitfall 11: SHA Pinning Maintenance Burden

**What goes wrong:**
Pinning Actions to SHAs improves security but creates maintenance burden. Dependabot doesn't alert on vulnerabilities in SHA-pinned actions. Manual updates required.

**Prevention:**
- Use Dependabot or Renovate to auto-update SHA pins
- Renovate preset `helpers:pinGitHubActionDigestsToSemver` maintains human-readable comments
- Accept slightly higher risk for low-privilege actions (consider tag pinning)
- Prioritize SHA pinning for security-critical actions (upload-sarif, checkout with token)

**Sources:**
- [StepSecurity: Pinning GitHub Actions for Enhanced Security](https://www.stepsecurity.io/blog/pinning-github-actions-for-enhanced-security-a-complete-guide) [MEDIUM confidence]
- [Why you should pin your GitHub Actions by commit-hash](https://blog.rafaelgss.dev/why-you-should-pin-actions-by-commit-hash) [MEDIUM confidence]

---

### Pitfall 12: Overlapping Alerts from Multiple Tools

**What goes wrong:**
Dependabot, Trivy, and Dependency-Check all flag the same vulnerable dependencies. Alert fatigue from duplicate findings across tools. Unclear which tool to trust.

**Prevention:**
- Choose one primary SCA tool for dependency scanning
- Use Dependabot for automated PRs, disable alerts if using Trivy/Dependency-Check
- Or: Use Dependabot alerts + disable other SCA tools' alerting (informational only)
- Document "source of truth" for each vulnerability class

**Sources:**
- [Tips for Handling Dependabot, CodeQL, and Secret Scanning Alerts](https://josh-ops.com/posts/security-alerts/) [MEDIUM confidence]
- [Best GitHub Security Tools for Secure Repositories](https://www.aikido.dev/blog/top-github-security-tools) [LOW confidence]

---

## Minor Pitfalls

### Pitfall 13: Path Filter Confusion (Workflow vs Code Scanning)

**What goes wrong:**
Teams confuse `on.<push|pull_request>.paths` (workflow triggers) with code scanning `paths`/`paths-ignore` (analysis scope). Setting workflow paths doesn't exclude files from scanning.

**Prevention:**
- Use workflow `paths` to control when job runs (e.g., only on backend changes)
- Use code scanning config `paths-ignore` to exclude files from analysis (test fixtures, etc.)
- Document both in workflow comments for clarity

**Sources:**
- [GitHub Docs: Customizing your advanced setup for code scanning](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning) [HIGH confidence]

---

### Pitfall 14: Secret Scanning Path Exclusion Limit

**What goes wrong:**
Secret scanning only processes first 1,000 directories in `paths-ignore`. Large monorepos with >1,000 excluded paths silently scan excluded directories.

**Prevention:**
- Keep secret scanning exclusions under 1,000 entries
- Use broad patterns (`test/**`) instead of listing individual directories
- Monitor Secret Scanning alerts for unexpected paths

**Sources:**
- [GitHub Docs: Excluding folders and files from secret scanning](https://docs.github.com/en/code-security/secret-scanning/using-advanced-secret-scanning-and-push-protection-features/excluding-folders-and-files-from-secret-scanning) [HIGH confidence]

---

### Pitfall 15: Scheduling Scans Without Change Detection

**What goes wrong:**
Running all scans on every PR change wastes CI time. DAST scans on documentation changes. Dependency scans when only README updated.

**Prevention:**
- Use path filters (`dorny/paths-filter`) to conditionally run scans
- SAST: only when code changes
- Dependency scans: only when lockfiles change
- DAST: only when backend/API changes
- Schedule full scans (nightly/weekly) as backup

**Sources:**
- [Project context: existing change detection setup] [HIGH confidence - from project]

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Broad SAST rulesets (e.g., Semgrep `p/default`) | Fast initial setup, comprehensive coverage | SARIF size limits, slow scans, alert fatigue | Acceptable for Phase 1 POC; must tune before production |
| Single workflow file for all tools | Simpler maintenance, fewer files | SARIF category conflicts, harder debugging, Scorecard incompatibility | Never acceptable when including Scorecard |
| `continue-on-error: true` for flaky scans | Unblocks CI immediately | Silent failures, security blind spots | Never acceptable for production |
| No path filtering | Simpler configuration | Wasted CI time, slow feedback | Acceptable initially; optimize in Phase 6 |
| Manual SARIF category management | No tooling dependencies | Error-prone, scales poorly | Acceptable for <5 tools; automate beyond that |
| Using free NVD tier (no API key) | No signup required | 5-10x slower scans, CI timeouts | Never acceptable for PR checks; OK for nightly scans |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Semgrep | Running on Dependabot PRs without exclusions | Exclude Dependabot/bot PRs via workflow conditions |
| Dependency-Check | Downloading NVD database on every run | Cache database with daily refresh schedule |
| Trivy | Scanning before image exists in buildx | Add `--load` to buildx or scan post-push |
| ZAP | Spider crawling entire app including logout | Configure context with URL exclusions |
| Scorecard | Adding to existing multi-tool workflow | Create isolated workflow with minimal steps |
| SARIF Upload | Using same category for multiple tools | Set unique category per tool/matrix combination |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running DAST on every PR | 10-30 min scan times, developer complaints | Schedule DAST nightly, run on PR only for API changes | >5 min total CI time |
| No Dependency-Check caching | 5-15 min database download per run | Cache NVD database with 24h TTL | Every run without cache |
| Broad Semgrep rules on monorepo | >10MB SARIF files, truncated results | Path filters, focused rulesets, split by language | >500k LOC codebase |
| Uploading 20+ SARIF runs | Upload timeouts, GitHub rate limits | Combine related findings, use single category per tool | >10 simultaneous uploads |
| Running all scans without path filters | Wasted CI on non-code changes | Conditional execution based on changed files | Repo with >50 PRs/week |

---

## Security Mistakes

Beyond general GitHub Actions security, DevSecOps integration-specific issues:

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using `continue-on-error: true` on security jobs | Silent bypass of security checks | Use SARIF informational mode instead |
| Storing NVD API key in repository secrets | Key exposure in forked PR workflows | Use environment secrets with approval gates |
| Running DAST against production | Data corruption, service disruption | Dedicated test environment with isolated data |
| Publishing Scorecard results without review | Exposing security posture before remediation | Start with local results, publish after baseline improvement |
| Overly permissive workflow tokens | Compromised action = repo takeover | Least privilege: job-level permissions, minimal scopes |

---

## "Looks Done But Isn't" Checklist

- [ ] **SARIF Uploads:** Often missing unique categories — verify multiple tools upload successfully
- [ ] **Path Filtering:** Often missing test fixtures exclusions — verify scans skip non-production code
- [ ] **Informational Mode:** Often missing severity thresholds — verify CRITICAL findings fail, others inform
- [ ] **Cache Strategy:** Often missing NVD database caching — verify Dependency-Check doesn't re-download daily
- [ ] **ZAP Tuning:** Often missing false positive suppressions — verify <20 findings per scan after tuning
- [ ] **Token Permissions:** Often missing `security-events: write` — verify SARIF uploads succeed in private repos
- [ ] **Change Detection:** Often missing conditional execution — verify scans only run when relevant files change
- [ ] **Alert Deduplication:** Often missing tool coordination — verify Dependabot disabled if using Trivy for SCA

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SARIF category conflicts | LOW | Add unique category to each upload-sarif step, redeploy |
| Missing GHAS license | HIGH | Purchase GHAS or switch to artifact-based reporting |
| NVD rate limiting | LOW | Request API key (1-2 days), add caching (1-2 hours) |
| ZAP false positives | MEDIUM | 2-3 sprint tuning cycle with `.zap/rules.tsv` |
| Scorecard workflow violations | MEDIUM | Create new isolated workflow (4-8 hours) |
| continue-on-error blind spots | MEDIUM | Remove continue-on-error, fix root causes (1-2 weeks) |
| SARIF size overruns | MEDIUM | Add path filters, narrow rulesets (1-2 days) |
| Token permission errors | LOW | Update workflow permissions block (30 min) |
| Overlapping SCA tools | LOW | Disable Dependabot alerts or Trivy/Dep-Check (decision + 1 hour) |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SARIF category conflicts | Phase 1 (Foundation) | Multiple tools upload to Security tab successfully |
| GHAS licensing | Phase 0 (Pre-planning) | SARIF upload succeeds in target private repo |
| NVD rate limiting | Phase 2 (Dependency scanning) | Dependency-Check completes in <5 min with fresh data |
| ZAP false positives | Phase 5 (DAST) | <20 findings per scan, no health check alerts |
| Scorecard restrictions | Phase 4 (Repo health) | Results publish to scorecard.dev |
| continue-on-error blind spots | Phase 1 (Foundation) | All security jobs show explicit pass/fail (no silent errors) |
| SARIF size limits | Phase 3 (SAST) | Upload succeeds with <5MB SARIF, no truncation warnings |
| Token permissions | Phase 1 (Foundation) | Test upload with least-privilege token succeeds |
| Overlapping SCA tools | Phase 2 (Dependency scanning) | Single source of truth documented, duplicate alerts suppressed |
| Path filter confusion | Phase 6 (Optimization) | Scans skip on doc-only changes, run on code changes |
| SHA pinning maintenance | Phase 1 (Foundation) | Dependabot/Renovate updates pinned SHAs automatically |
| Trivy buildx visibility | Phase 2 (Container scanning) | Trivy finds and scans built image successfully |

---

## Sources

### High Confidence (Official Documentation)
- [GitHub Docs: SARIF support for code scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning)
- [GitHub Docs: Uploading a SARIF file to GitHub](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github)
- [GitHub Docs: Troubleshooting SARIF uploads](https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads)
- [GitHub Docs: Upload fails because GitHub Code Security is disabled](https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads/ghas-required)
- [GitHub Changelog: Code scanning will stop combining multiple SARIF runs](https://github.blog/changelog/2025-07-21-code-scanning-will-stop-combining-multiple-sarif-runs-uploaded-in-the-same-sarif-file/)
- [GitHub: ossf/scorecard-action](https://github.com/ossf/scorecard-action)
- [GitHub Blog: Reducing security risk with OpenSSF Scorecards V4](https://github.blog/open-source/reducing-security-risk-oss-actions-opensff-scorecards-v4/)
- [GitHub Docs: Customizing your advanced setup for code scanning](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning)
- [GitHub Docs: Excluding folders and files from secret scanning](https://docs.github.com/en/code-security/secret-scanning/using-advanced-secret-scanning-and-push-protection-features/excluding-folders-and-files-from-secret-scanning)
- [ZAP FAQ: How do I handle a False Positive?](https://www.zaproxy.org/faq/how-do-i-handle-a-false-positive/)

### Medium Confidence (Technical Articles & Community Guides)
- [Medium: Shift Left in Practice: SAST, DAST, and SCA with GitHub Actions](https://medium.com/@mjmarc.common/shift-left-in-practice-sast-dast-and-sca-with-github-actions-cb5539f31d04)
- [Semgrep Docs: Sample CI configurations](https://semgrep.dev/docs/semgrep-ci/sample-ci-configs)
- [AppSec Guide: Continuous integration with Semgrep](https://appsec.guide/docs/static-analysis/semgrep/continuous-integration/)
- [Medium: Managing False Positives in OWASP Zed Attack Proxy](https://jiarongchew.medium.com/managing-false-positives-in-owasp-zed-attack-proxy-zap-a2581e64c249)
- [Medium: Why Your Dependency Scans Are Slow Without an NVD API Key](https://medium.com/@nagendra.raja/why-your-dependency-scans-are-slow-and-incomplete-without-an-nvd-api-key-54d29cb04c6b)
- [Medium: OWASP dependency-check. Solving problem of slow db downloading](https://medium.com/@magelan09/pretending-to-be-a-devsecops-professional-ci-cd-pipeline-owasp-dependency-check-database-c95bb1ac6f2f)
- [Medium: How to Add a Security Scan with Trivy in GitHub Actions](https://medium.com/@vincenthartmann/how-to-add-a-security-scan-with-trivy-in-github-actions-8f16642aa82b)
- [OneUpTime: How to Run Security Scanning with GitHub Actions](https://oneuptime.com/blog/post/2026-01-25-security-scanning-github-actions/view)
- [GitHub Actions Security Best Practices Cheat Sheet](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)
- [StepSecurity: Pinning GitHub Actions for Enhanced Security](https://www.stepsecurity.io/blog/pinning-github-actions-for-enhanced-security-a-complete-guide)
- [Why you should pin your GitHub Actions by commit-hash](https://blog.rafaelgss.dev/why-you-should-pin-actions-by-commit-hash)
- [Tips for Handling Dependabot, CodeQL, and Secret Scanning Alerts](https://josh-ops.com/posts/security-alerts/)

### Low Confidence (Aggregated Reviews & Single Sources)
- [PeerSpot: OWASP Zap reviews 2026](https://www.peerspot.com/products/owasp-zap-reviews)
- [Best GitHub Security Tools for Secure Repositories](https://www.aikido.dev/blog/top-github-security-tools)

---

*Pitfalls research for: DevSecOps CI Scanning Integration*
*Researched: 2026-02-23*
*Confidence: HIGH (official docs + verified community patterns)*
