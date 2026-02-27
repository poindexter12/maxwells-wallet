# OpenSSF Best Practices Badge — Evidence & Answers

Reference for filling out the [OpenSSF Best Practices](https://www.bestpractices.dev/) "passing" badge questionnaire.
Each criterion includes the answer and a URL for proof.

Repo: https://github.com/poindexter12/maxwells-wallet

---

## Basics

### Basic Project Website Content

| Criterion | Answer | URL |
|-----------|--------|-----|
| **description_good** — Does the project website describe what the software does? | Met | https://github.com/poindexter12/maxwells-wallet#readme |
| **interact** — Does the website explain how to obtain, provide feedback, and contribute? | Met | https://github.com/poindexter12/maxwells-wallet#installation |
| **contribution** — Does contribution info explain the contribution process? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/CONTRIBUTING.md |
| **contribution_requirements** — Does it include requirements/standards for contributions? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/CONTRIBUTING.md#code-style |

### FLOSS License

| Criterion | Answer | URL |
|-----------|--------|-----|
| **floss_license** — Is software released as FLOSS? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/LICENSE |
| **floss_license_osi** — Is the license OSI-approved? | Met | https://opensource.org/licenses/MIT |
| **license_location** — Is the license in the standard location? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/LICENSE |

### Documentation

| Criterion | Answer | URL |
|-----------|--------|-----|
| **documentation_basics** — Does the project provide basic documentation? | Met | https://docs.maxwellswallet.com |
| **documentation_interface** — Is reference documentation for the external interface provided? | Met | https://docs.maxwellswallet.com/api/overview/ |

### Other

| Criterion | Answer | URL |
|-----------|--------|-----|
| **sites_https** — Do project sites support HTTPS? | Met | https://github.com/poindexter12/maxwells-wallet (GitHub), https://docs.maxwellswallet.com (docs) |
| **discussion** — Is there a searchable discussion mechanism? | Met | https://github.com/poindexter12/maxwells-wallet/discussions |
| **english** — Is documentation in English and are bug reports accepted in English? | Met | https://github.com/poindexter12/maxwells-wallet#readme |
| **maintained** — Is the project actively maintained? | Met | https://github.com/poindexter12/maxwells-wallet/commits/main |

---

## Change Control

### Public Version-Controlled Repository

| Criterion | Answer | URL |
|-----------|--------|-----|
| **repo_public** — Is there a publicly readable version-controlled repo? | Met | https://github.com/poindexter12/maxwells-wallet |
| **repo_track** — Does the repo track changes, authors, and timestamps? | Met | https://github.com/poindexter12/maxwells-wallet/commits/main |
| **repo_interim** — Does the repo include interim versions, not just final releases? | Met | https://github.com/poindexter12/maxwells-wallet/commits/main |
| **repo_distributed** — Is distributed version control used? | Met | Git (https://github.com/poindexter12/maxwells-wallet) |

### Unique Version Numbering

| Criterion | Answer | URL |
|-----------|--------|-----|
| **version_unique** — Does each release have a unique identifier? | Met | https://github.com/poindexter12/maxwells-wallet/tags |
| **version_semver** — Does it use Semantic Versioning? | Met | https://github.com/poindexter12/maxwells-wallet/tags (vMAJOR.MINOR.PATCH) |
| **version_tags** — Are releases identified with git tags? | Met | https://github.com/poindexter12/maxwells-wallet/tags |

### Release Notes

| Criterion | Answer | URL |
|-----------|--------|-----|
| **release_notes** — Are human-readable release notes provided? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/CHANGELOG.md |
| **release_notes_vulns** — Do release notes mention fixed CVE vulnerabilities? | N/A | No CVEs assigned to this project. Security fixes are documented in CHANGELOG.md. |

---

## Reporting

### Bug-Reporting Process

| Criterion | Answer | URL |
|-----------|--------|-----|
| **report_process** — Is there a bug reporting mechanism? | Met | https://github.com/poindexter12/maxwells-wallet/issues/new/choose |
| **report_tracker** — Is an issue tracker used? | Met | https://github.com/poindexter12/maxwells-wallet/issues |
| **report_responses** — Are majority of reports acknowledged within 2-12 months? | Met | https://github.com/poindexter12/maxwells-wallet/issues?q=is%3Aissue+is%3Aclosed |
| **enhancement_responses** — Are 50%+ enhancement requests responded to? | Met | https://github.com/poindexter12/maxwells-wallet/discussions/categories/ideas |
| **report_archive** — Is there a searchable archive of reports? | Met | https://github.com/poindexter12/maxwells-wallet/issues?q=is%3Aissue |

### Vulnerability Report Process

| Criterion | Answer | URL |
|-----------|--------|-----|
| **vulnerability_report_process** — Is the vulnerability reporting process published? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/SECURITY.md |
| **vulnerability_report_private** — Is there a private reporting option? | Met | https://github.com/poindexter12/maxwells-wallet/security/advisories/new |
| **vulnerability_report_response** — Is initial response time ≤14 days? | Met | SECURITY.md specifies 72-hour acknowledgment SLA: https://github.com/poindexter12/maxwells-wallet/blob/main/SECURITY.md#reporting-a-vulnerability |

---

## Quality

### Working Build System

| Criterion | Answer | URL |
|-----------|--------|-----|
| **build** — Does the project provide an automated build from source? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/justfile (`just setup && just dev::dev`) |
| **build_common_tools** — Are common build tools used? | Met | npm, uv, just, mise, Docker — https://github.com/poindexter12/maxwells-wallet#development |
| **build_floss_tools** — Is the project buildable using only FLOSS tools? | Met | All tools (npm, uv, just, mise, Docker) are FLOSS |

### Automated Test Suite

| Criterion | Answer | URL |
|-----------|--------|-----|
| **test** — Is there a FLOSS test suite? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/CONTRIBUTING.md#testing-requirements |
| **test_invocation** — Is the test suite invokable in a standard way? | Met | `just test::all` or `npm run test` / `uv run pytest` — https://github.com/poindexter12/maxwells-wallet/blob/main/justfile |
| **test_most** — Does the suite cover most functionality? | Met | 80% coverage enforced — https://codecov.io/gh/poindexter12/maxwells-wallet |
| **test_continuous_integration** — Is CI implemented? | Met | https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yaml |

### New Functionality Testing

| Criterion | Answer | URL |
|-----------|--------|-----|
| **test_policy** — Is there a policy requiring tests for new functionality? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/CONTRIBUTING.md#testing-requirements |
| **tests_are_added** — Is the policy evidenced in recent changes? | Met | https://github.com/poindexter12/maxwells-wallet/pull/216 (added 35 property-based tests) |
| **tests_documented_added** — Is the test-adding policy in contribution instructions? | Met | https://github.com/poindexter12/maxwells-wallet/blob/main/CONTRIBUTING.md#testing-requirements |

### Warning Flags

| Criterion | Answer | URL |
|-----------|--------|-----|
| **warnings** — Are linting/warning tools enabled? | Met | ESLint + Ruff + mypy in CI — https://github.com/poindexter12/maxwells-wallet/blob/main/.github/workflows/ci.yaml |
| **warnings_fixed** — Are warnings addressed? | Met | CI enforces clean lint/type-check — https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yaml |
| **warnings_strict** — Are warnings configured strictly? | Met | mypy: `check_untyped_defs = true` — https://github.com/poindexter12/maxwells-wallet/blob/main/backend/pyproject.toml |

---

## Security

### Secure Development Knowledge

| Criterion | Answer | URL |
|-----------|--------|-----|
| **know_secure_design** — Do developers understand secure software design? | Met | 5 automated security tools in CI — https://github.com/poindexter12/maxwells-wallet#security-tools |
| **know_common_errors** — Do developers know common vulnerability patterns? | Met | Semgrep covers OWASP Top 10; security headers in nginx — https://github.com/poindexter12/maxwells-wallet/blob/main/.github/workflows/security.yaml |

### Basic Cryptographic Practices

| Criterion | Answer | URL |
|-----------|--------|-----|
| **crypto_published** — Are only published/expert-reviewed crypto protocols used? | Met | bcrypt (password hashing), HS256 JWT (sessions) — https://github.com/poindexter12/maxwells-wallet/blob/main/backend/app/utils/auth.py |
| **crypto_call** — Does it call dedicated crypto libraries (not reimplementing)? | Met | Uses `bcrypt` and `PyJWT` packages — https://github.com/poindexter12/maxwells-wallet/blob/main/backend/pyproject.toml |
| **crypto_floss** — Is all crypto implementable with FLOSS? | Met | bcrypt and PyJWT are both MIT-licensed FLOSS |
| **crypto_keylength** — Do default keylengths meet NIST 2030 requirements? | Met | bcrypt default work factor (12 rounds); JWT HS256 with configurable secret |
| **crypto_working** — Do defaults avoid broken algorithms (MD4, MD5, DES, RC4)? | Met | No broken algorithms used anywhere in the codebase |
| **crypto_weaknesses** — Do defaults avoid weakened algorithms (SHA-1, CBC)? | Met | bcrypt (not SHA-1); no CBC usage |
| **crypto_pfs** — Do key agreement protocols implement PFS? | N/A | App does not implement TLS directly; reverse proxy handles transport security |
| **crypto_password_storage** — Are passwords hashed with per-user salt + key stretching? | Met | bcrypt with `gensalt()` — https://github.com/poindexter12/maxwells-wallet/blob/main/backend/app/utils/auth.py |
| **crypto_random** — Are crypto keys/nonces generated with CSPRNG? | Met | bcrypt generates salts via OS CSPRNG internally |

### Secure Delivery

| Criterion | Answer | URL |
|-----------|--------|-----|
| **delivery_mitm** — Is MITM protection used for delivery? | Met | Docker via ghcr.io (HTTPS); code via GitHub (HTTPS/SSH) — https://github.com/poindexter12/maxwells-wallet/pkgs/container/maxwells-wallet |
| **delivery_unsigned** — Are hashes not retrieved over HTTP without crypto verification? | Met | No unsigned hash-only delivery mechanism |

### Known Vulnerabilities

| Criterion | Answer | URL |
|-----------|--------|-----|
| **vulnerabilities_fixed_60_days** — Are medium+ vulnerabilities patched within 60 days? | Met | Active scanning and patching — https://github.com/poindexter12/maxwells-wallet/pulls?q=is%3Apr+label%3Asecurity |
| **vulnerabilities_critical_fixed** — Are critical vulnerabilities fixed rapidly? | Met | https://github.com/poindexter12/maxwells-wallet/pulls?q=is%3Apr+label%3Asecurity+is%3Amerged |

### Credential Leaks

| Criterion | Answer | URL |
|-----------|--------|-----|
| **no_leaked_credentials** — Does the repo avoid leaking private credentials? | Met | `.gitignore` excludes `.env*` — https://github.com/poindexter12/maxwells-wallet/blob/main/.gitignore |

---

## Analysis

### Static Code Analysis

| Criterion | Answer | URL |
|-----------|--------|-----|
| **static_analysis** — Is static analysis applied before release? | Met | Semgrep SAST in CI — https://github.com/poindexter12/maxwells-wallet/blob/main/.github/workflows/security.yaml |
| **static_analysis_common_vulnerabilities** — Does the tool cover common vulnerabilities? | Met | Semgrep `--config auto` covers OWASP Top 10, CWE patterns |
| **static_analysis_fixed** — Are medium+ findings fixed in a timely way? | Met | https://github.com/poindexter12/maxwells-wallet/security/code-scanning |
| **static_analysis_often** — Is analysis run on every commit or daily? | Met | Semgrep runs on every push and PR — https://github.com/poindexter12/maxwells-wallet/actions/workflows/ci.yaml |

### Dynamic Code Analysis

| Criterion | Answer | URL |
|-----------|--------|-----|
| **dynamic_analysis** — Is dynamic analysis applied before release? | Met | OWASP ZAP DAST — https://github.com/poindexter12/maxwells-wallet/blob/main/.github/workflows/dast.yaml |
| **dynamic_analysis_unsafe** — For memory-unsafe languages, are fuzzers used? | N/A | Python and TypeScript are memory-safe languages |
| **dynamic_analysis_enable_assertions** — Are assertions enabled during testing? | Met | pytest runs with assertions enabled; property-based tests via hypothesis/fast-check |
| **dynamic_analysis_fixed** — Are medium+ dynamic findings fixed? | Met | ZAP findings reviewed; security headers implemented in nginx config |
