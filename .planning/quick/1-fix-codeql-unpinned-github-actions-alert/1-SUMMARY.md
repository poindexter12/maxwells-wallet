---
type: quick-summary
task: "Fix CodeQL unpinned GitHub Actions alerts — pin jdx/mise-action to SHA"
completed: 2026-02-27
duration: 1
files:
  modified:
    - .github/workflows/ci.yaml
    - .github/workflows/dast.yaml
    - .github/workflows/nightly-chaos.yaml
    - .github/workflows/nightly-e2e.yaml
    - .github/workflows/nightly-performance.yaml
    - .github/workflows/nightly.yaml
    - .github/workflows/weekly-endurance.yaml
commits:
  - hash: 42a0e9c
    message: "chore(quick-1): pin jdx/mise-action to SHA across all workflows"
---

# Quick Task 1: Pin jdx/mise-action to SHA Summary

**One-liner:** Pinned jdx/mise-action to SHA hash c37c93293d6b742fc901e1406b8f764f6fb19dac across all 7 workflow files to resolve CodeQL security alerts.

## What Was Done

Replaced all 14 occurrences of `uses: jdx/mise-action@v2` with `uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2` across the following workflow files:

1. `.github/workflows/ci.yaml` (4 occurrences)
2. `.github/workflows/dast.yaml` (1 occurrence)
3. `.github/workflows/nightly-chaos.yaml` (1 occurrence)
4. `.github/workflows/nightly-e2e.yaml` (1 occurrence)
5. `.github/workflows/nightly-performance.yaml` (1 occurrence)
6. `.github/workflows/nightly.yaml` (5 occurrences)
7. `.github/workflows/weekly-endurance.yaml` (1 occurrence)

## Security Impact

This change addresses CodeQL's "Pinned-Dependencies" and "unpinned-tag" alerts for third-party GitHub Actions. Pinning actions to specific SHA commits ensures:

- **Supply chain security**: Actions cannot be modified without detection
- **Reproducible builds**: Workflows use the exact same action code
- **Protection against tag hijacking**: Semantic version tags (like v2) can be moved to point to different commits

The SHA hash `c37c93293d6b742fc901e1406b8f764f6fb19dac` corresponds to jdx/mise-action v2, maintaining the same functionality while improving security posture.

## Verification

```bash
# Confirmed no unpinned mise-action references remain
grep -r 'jdx/mise-action@v2' .github/workflows/
# Returns: No unpinned mise-action found

# Confirmed 14 pinned references exist
grep -r 'jdx/mise-action@c37c93' .github/workflows/ | wc -l
# Returns: 14
```

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

**Files created/modified:**
- ✅ .github/workflows/ci.yaml (modified)
- ✅ .github/workflows/dast.yaml (modified)
- ✅ .github/workflows/nightly-chaos.yaml (modified)
- ✅ .github/workflows/nightly-e2e.yaml (modified)
- ✅ .github/workflows/nightly-performance.yaml (modified)
- ✅ .github/workflows/nightly.yaml (modified)
- ✅ .github/workflows/weekly-endurance.yaml (modified)

**Commits verified:**
- ✅ 42a0e9c: chore(quick-1): pin jdx/mise-action to SHA across all workflows

All files and commits verified successfully.
