#!/usr/bin/env python3
"""
Programmatically fill OpenSSF Best Practices badge criteria.

Usage:
  1. Go to https://www.bestpractices.dev and sign in with GitHub
  2. Create a new project with repo URL: https://github.com/poindexter12/maxwells-wallet
  3. Note the project ID from the URL (e.g., https://www.bestpractices.dev/en/projects/12345)
  4. Open browser DevTools → Application → Cookies → copy the _BadgeApp_session value
  5. Run:
       python3 scripts/openssf-badge-fill.py --project-id 12345 --cookie "YOUR_SESSION_COOKIE"

Based on: https://github.com/coreinfrastructure/best-practices-badge/blob/main/docs/best_practices_modify.py
"""

import argparse
import re
import sys
import time
import urllib.request
import urllib.parse

BASE_URL = "https://www.bestpractices.dev"
REPO_URL = "https://github.com/poindexter12/maxwells-wallet"

# ---------------------------------------------------------------------------
# All criteria answers — see OPENSSF.md for justification URLs
# ---------------------------------------------------------------------------

CRITERIA = {
    # === Basics ===
    "description_good_status": "Met",
    "description_good_justification": "README.md describes software, features, and use cases: " + REPO_URL + "#readme",

    "interact_status": "Met",
    "interact_justification": "README includes installation, issue templates, and discussions: " + REPO_URL + "#installation",

    "contribution_status": "Met",
    "contribution_justification": "CONTRIBUTING.md covers fork/branch/PR workflow: " + REPO_URL + "/blob/main/CONTRIBUTING.md",

    "contribution_requirements_status": "Met",
    "contribution_requirements_justification": "CONTRIBUTING.md specifies code style, testing, coverage requirements: " + REPO_URL + "/blob/main/CONTRIBUTING.md#code-style",

    "floss_license_status": "Met",
    "floss_license_justification": "MIT License: " + REPO_URL + "/blob/main/LICENSE",

    "floss_license_osi_status": "Met",
    "floss_license_osi_justification": "MIT is OSI-approved: https://opensource.org/licenses/MIT",

    "license_location_status": "Met",
    "license_location_justification": "Standard LICENSE file in repo root: " + REPO_URL + "/blob/main/LICENSE",

    "documentation_basics_status": "Met",
    "documentation_basics_justification": "README + docs site: https://docs.maxwellswallet.com",

    "documentation_interface_status": "Met",
    "documentation_interface_justification": "API reference docs: https://docs.maxwellswallet.com/api/overview/",

    "sites_https_status": "Met",
    "sites_https_justification": "GitHub (HTTPS), docs site (HTTPS), ghcr.io (HTTPS)",

    "discussion_status": "Met",
    "discussion_justification": "GitHub Discussions enabled: " + REPO_URL + "/discussions",

    "english_status": "Met",
    "english_justification": "All docs in English; bug reports accepted in English",

    "maintained_status": "Met",
    "maintained_justification": "Active commits within last 30 days: " + REPO_URL + "/commits/main",

    # === Change Control ===
    "repo_public_status": "Met",
    "repo_public_justification": "Public GitHub repo: " + REPO_URL,

    "repo_track_status": "Met",
    "repo_track_justification": "Git tracks changes, authors, timestamps: " + REPO_URL + "/commits/main",

    "repo_interim_status": "Met",
    "repo_interim_justification": "Development on branches merged to main: " + REPO_URL + "/commits/main",

    "repo_distributed_status": "Met",
    "repo_distributed_justification": "Git (distributed VCS)",

    "version_unique_status": "Met",
    "version_unique_justification": "Each release uniquely tagged: " + REPO_URL + "/tags",

    "version_semver_status": "Met",
    "version_semver_justification": "Semantic Versioning (vMAJOR.MINOR.PATCH): " + REPO_URL + "/tags",

    "version_tags_status": "Met",
    "version_tags_justification": "Git tags for every release: " + REPO_URL + "/tags",

    "release_notes_status": "Met",
    "release_notes_justification": "CHANGELOG.md with human-readable notes: " + REPO_URL + "/blob/main/CHANGELOG.md",

    "release_notes_vulns_status": "N/A",
    "release_notes_vulns_justification": "No CVEs assigned to this project to date. Security fixes documented in CHANGELOG.md.",

    # === Reporting ===
    "report_process_status": "Met",
    "report_process_justification": "GitHub Issues with structured templates: " + REPO_URL + "/issues/new/choose",

    "report_tracker_status": "Met",
    "report_tracker_justification": "GitHub Issues: " + REPO_URL + "/issues",

    "report_responses_status": "Met",
    "report_responses_justification": "Issues actively triaged: " + REPO_URL + "/issues?q=is%3Aissue+is%3Aclosed",

    "enhancement_responses_status": "Met",
    "enhancement_responses_justification": "Feature requests via discussions: " + REPO_URL + "/discussions/categories/ideas",

    "report_archive_status": "Met",
    "report_archive_justification": "GitHub Issues searchable and permanent: " + REPO_URL + "/issues?q=is%3Aissue",

    "vulnerability_report_process_status": "Met",
    "vulnerability_report_process_justification": "SECURITY.md: " + REPO_URL + "/blob/main/SECURITY.md",

    "vulnerability_report_private_status": "Met",
    "vulnerability_report_private_justification": "GitHub Security Advisories: " + REPO_URL + "/security/advisories/new",

    "vulnerability_report_response_status": "Met",
    "vulnerability_report_response_justification": "72-hour SLA in SECURITY.md: " + REPO_URL + "/blob/main/SECURITY.md#reporting-a-vulnerability",

    # === Quality ===
    "build_status": "Met",
    "build_justification": "make setup && make dev: " + REPO_URL + "/blob/main/Makefile",

    "build_common_tools_status": "Met",
    "build_common_tools_justification": "npm, uv (pip), make, Docker: " + REPO_URL + "#development",

    "build_floss_tools_status": "Met",
    "build_floss_tools_justification": "All build tools (npm, uv, make, Docker) are FLOSS",

    "test_status": "Met",
    "test_justification": "Vitest (frontend) + pytest (backend): " + REPO_URL + "/blob/main/CONTRIBUTING.md#testing-requirements",

    "test_invocation_status": "Met",
    "test_invocation_justification": "make test-all, npm run test, uv run pytest: " + REPO_URL + "/blob/main/Makefile",

    "test_most_status": "Met",
    "test_most_justification": "80% coverage enforced by Codecov: https://codecov.io/gh/poindexter12/maxwells-wallet",

    "test_continuous_integration_status": "Met",
    "test_continuous_integration_justification": "CI on every push and PR: " + REPO_URL + "/actions/workflows/ci.yaml",

    "test_policy_status": "Met",
    "test_policy_justification": "CONTRIBUTING.md requires tests: " + REPO_URL + "/blob/main/CONTRIBUTING.md#testing-requirements",

    "tests_are_added_status": "Met",
    "tests_are_added_justification": "Recent PR added 35 property-based tests: " + REPO_URL + "/pull/216",

    "tests_documented_added_status": "Met",
    "tests_documented_added_justification": "Testing policy in CONTRIBUTING.md: " + REPO_URL + "/blob/main/CONTRIBUTING.md#testing-requirements",

    "warnings_status": "Met",
    "warnings_justification": "ESLint + Ruff + mypy in CI: " + REPO_URL + "/blob/main/.github/workflows/ci.yaml",

    "warnings_fixed_status": "Met",
    "warnings_fixed_justification": "CI enforces clean lint/type-check: " + REPO_URL + "/actions/workflows/ci.yaml",

    "warnings_strict_status": "Met",
    "warnings_strict_justification": "mypy check_untyped_defs=true: " + REPO_URL + "/blob/main/backend/pyproject.toml",

    # === Security ===
    "know_secure_design_status": "Met",
    "know_secure_design_justification": "5 security tools in CI pipeline: " + REPO_URL + "#security-tools",

    "know_common_errors_status": "Met",
    "know_common_errors_justification": "Semgrep covers OWASP Top 10: " + REPO_URL + "/blob/main/.github/workflows/security.yaml",

    "crypto_published_status": "Met",
    "crypto_published_justification": "bcrypt (password hashing), HS256 JWT: " + REPO_URL + "/blob/main/backend/app/utils/auth.py",

    "crypto_call_status": "Met",
    "crypto_call_justification": "Uses bcrypt and PyJWT libraries: " + REPO_URL + "/blob/main/backend/pyproject.toml",

    "crypto_floss_status": "Met",
    "crypto_floss_justification": "bcrypt and PyJWT are MIT-licensed FLOSS",

    "crypto_keylength_status": "Met",
    "crypto_keylength_justification": "bcrypt default work factor (12 rounds); JWT HS256 with configurable secret",

    "crypto_working_status": "Met",
    "crypto_working_justification": "No broken algorithms (MD4, MD5, DES, RC4) used anywhere in codebase",

    "crypto_weaknesses_status": "Met",
    "crypto_weaknesses_justification": "bcrypt (not SHA-1); no CBC usage",

    "crypto_pfs_status": "N/A",
    "crypto_pfs_justification": "App does not implement TLS directly; reverse proxy handles transport security",

    "crypto_password_storage_status": "Met",
    "crypto_password_storage_justification": "bcrypt with gensalt() (per-user salt, key stretching): " + REPO_URL + "/blob/main/backend/app/utils/auth.py",

    "crypto_random_status": "Met",
    "crypto_random_justification": "bcrypt generates salts via OS CSPRNG internally",

    "delivery_mitm_status": "Met",
    "delivery_mitm_justification": "Docker via ghcr.io (HTTPS); code via GitHub (HTTPS/SSH): " + REPO_URL + "/pkgs/container/maxwells-wallet",

    "delivery_unsigned_status": "Met",
    "delivery_unsigned_justification": "No unsigned hash-only delivery; Docker content trust via registry",

    "vulnerabilities_fixed_60_days_status": "Met",
    "vulnerabilities_fixed_60_days_justification": "Active scanning and patching: " + REPO_URL + "/pulls?q=is%3Apr+label%3Asecurity",

    "vulnerabilities_critical_fixed_status": "Met",
    "vulnerabilities_critical_fixed_justification": "Security PRs merged promptly: " + REPO_URL + "/pulls?q=is%3Apr+label%3Asecurity+is%3Amerged",

    "no_leaked_credentials_status": "Met",
    "no_leaked_credentials_justification": ".gitignore excludes .env*: " + REPO_URL + "/blob/main/.gitignore",

    # === Analysis ===
    "static_analysis_status": "Met",
    "static_analysis_justification": "Semgrep SAST in CI: " + REPO_URL + "/blob/main/.github/workflows/security.yaml",

    "static_analysis_common_vulnerabilities_status": "Met",
    "static_analysis_common_vulnerabilities_justification": "Semgrep --config auto covers OWASP Top 10 and CWE patterns",

    "static_analysis_fixed_status": "Met",
    "static_analysis_fixed_justification": "Findings actively fixed: " + REPO_URL + "/security/code-scanning",

    "static_analysis_often_status": "Met",
    "static_analysis_often_justification": "Semgrep runs on every push and PR: " + REPO_URL + "/actions/workflows/ci.yaml",

    "dynamic_analysis_status": "Met",
    "dynamic_analysis_justification": "OWASP ZAP DAST: " + REPO_URL + "/blob/main/.github/workflows/dast.yaml",

    "dynamic_analysis_unsafe_status": "N/A",
    "dynamic_analysis_unsafe_justification": "Python and TypeScript are memory-safe languages",

    "dynamic_analysis_enable_assertions_status": "Met",
    "dynamic_analysis_enable_assertions_justification": "pytest runs with assertions enabled; property-based tests via hypothesis/fast-check",

    "dynamic_analysis_fixed_status": "Met",
    "dynamic_analysis_fixed_justification": "ZAP findings reviewed; security headers implemented in nginx config",
}


# ---------------------------------------------------------------------------
# HTTP helpers (adapted from best_practices_modify.py)
# ---------------------------------------------------------------------------

def get_tokens(project_id: int, cookie: str) -> tuple[str, str]:
    """Fetch CSRF token and updated session cookie from the project edit page."""
    url = f"{BASE_URL}/en/projects/{project_id}/edit"
    req = urllib.request.Request(url, headers={
        "Cookie": f"_BadgeApp_session={cookie}",
        "User-Agent": "openssf-badge-fill/1.0",
    })
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
        # Extract CSRF token
        match = re.search(r'<meta name="csrf-token" content="([^"]+)"', body)
        if not match:
            print("ERROR: Could not find CSRF token. Is the session cookie valid?", file=sys.stderr)
            sys.exit(1)
        csrf_token = match.group(1)

        # Extract updated session cookie
        set_cookie = resp.headers.get("Set-Cookie", "")
        session_match = re.search(r"_BadgeApp_session=([^;]+)", set_cookie)
        new_cookie = session_match.group(1) if session_match else cookie

        return csrf_token, new_cookie


def patch_project(project_id: int, cookie: str, csrf_token: str, data: dict) -> bool:
    """PATCH criteria data to the project."""
    url = f"{BASE_URL}/en/projects/{project_id}"

    # Convert {"key": "val"} to {"project[key]": "val"} for Rails form submission
    form_data = {f"project[{k}]": v for k, v in data.items()}
    encoded = urllib.parse.urlencode(form_data).encode("utf-8")

    req = urllib.request.Request(url, data=encoded, method="PATCH", headers={
        "Cookie": f"_BadgeApp_session={cookie}",
        "X-CSRF-Token": csrf_token,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "openssf-badge-fill/1.0",
    })

    try:
        with urllib.request.urlopen(req) as resp:
            return 200 <= resp.status < 400
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.reason}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Fill OpenSSF Best Practices badge criteria")
    parser.add_argument("--project-id", required=True, type=int, help="Project ID from bestpractices.dev URL")
    parser.add_argument("--cookie", required=True, help="_BadgeApp_session cookie value")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be sent without sending")
    parser.add_argument("--batch-size", type=int, default=10, help="Fields per PATCH request (default: 10)")
    args = parser.parse_args()

    if args.dry_run:
        print(f"DRY RUN — would update project {args.project_id} with {len(CRITERIA)} fields:")
        for k, v in CRITERIA.items():
            tag = "  [status]" if k.endswith("_status") else "  [justif]"
            print(f"{tag} {k} = {v[:80]}{'...' if len(v) > 80 else ''}")
        return

    print(f"Fetching CSRF token for project {args.project_id}...")
    csrf_token, cookie = get_tokens(args.project_id, args.cookie)
    print("  Got CSRF token")

    # Batch criteria into chunks to avoid oversized requests
    items = list(CRITERIA.items())
    total = len(items)
    sent = 0

    for i in range(0, total, args.batch_size):
        batch = dict(items[i:i + args.batch_size])
        batch_num = (i // args.batch_size) + 1
        total_batches = (total + args.batch_size - 1) // args.batch_size

        print(f"  Sending batch {batch_num}/{total_batches} ({len(batch)} fields)...", end=" ")
        ok = patch_project(args.project_id, cookie, csrf_token, batch)

        if ok:
            sent += len(batch)
            print("OK")
        else:
            print("FAILED")
            print("Stopping. Check your session cookie and project ID.", file=sys.stderr)
            sys.exit(1)

        # Rate limit: 1 req/sec
        if i + args.batch_size < total:
            time.sleep(1)

    print(f"\nDone. Updated {sent}/{total} fields.")
    print(f"Check: {BASE_URL}/en/projects/{args.project_id}")


if __name__ == "__main__":
    main()
