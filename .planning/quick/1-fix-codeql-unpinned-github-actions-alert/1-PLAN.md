---
type: quick-plan
task: "Fix CodeQL unpinned GitHub Actions alerts — pin jdx/mise-action to SHA"
created: 2026-02-27
---

# Quick Plan: Pin jdx/mise-action to SHA hash

## Context

CodeQL flags `jdx/mise-action@v2` as an unpinned third-party action across 7 workflow files (14 occurrences total). All other third-party actions are already pinned. The fix is to replace `@v2` with `@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2` everywhere.

## Task 1: Pin jdx/mise-action across all workflow files

- **files**: `.github/workflows/ci.yaml`, `.github/workflows/dast.yaml`, `.github/workflows/nightly-chaos.yaml`, `.github/workflows/nightly-e2e.yaml`, `.github/workflows/nightly-performance.yaml`, `.github/workflows/nightly.yaml`, `.github/workflows/weekly-endurance.yaml`
- **action**: Replace every `uses: jdx/mise-action@v2` with `uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2`
- **verify**: `grep -r 'jdx/mise-action@v2' .github/workflows/` should return zero results; `grep -r 'jdx/mise-action@c37c93' .github/workflows/` should return 14 matches
- **done**: All CodeQL "Pinned-Dependencies" and "unpinned-tag" alerts for mise-action resolved
