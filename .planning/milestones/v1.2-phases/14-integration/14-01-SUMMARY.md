# Plan 14-01 Summary: Migrate CI Workflows to mise-action + just recipes

**Status:** Complete
**Duration:** ~5 minutes
**Date:** 2026-02-27

## What Changed

Migrated 7 GitHub Actions workflow files from individual tool setup actions (setup-node, setup-uv, setup-python) to `jdx/mise-action@v2`, and replaced inline bash commands with just recipe calls where appropriate.

### Files Modified

| File | Changes |
|------|---------|
| `.github/workflows/ci.yaml` | 5 jobs updated: frontend, backend, e2e, performance, docker. All use mise-action. Just recipes for install, lint, typecheck, dead-code, build, db init/seed, docker build/migrate/seed/up. |
| `.github/workflows/nightly.yaml` | 4 jobs updated: security-audit, dead-code-analysis, code-quality, coverage-check. Removed working-directory defaults, added `cd backend &&` to inline scripts. |
| `.github/workflows/nightly-e2e.yaml` | Replaced setup-node + setup-uv with mise-action. Used just install-backend, just db::init, just db::seed, just install-frontend. |
| `.github/workflows/nightly-chaos.yaml` | Replaced setup-node + setup-uv with mise-action. Used just install-backend, just db::init, just db::seed. Kept retry loops for npm ci and Playwright install (CI-specific). |
| `.github/workflows/nightly-performance.yaml` | Replaced setup-uv with mise-action. Used just install-backend. Kept inline pytest + GITHUB_STEP_SUMMARY. |
| `.github/workflows/weekly-endurance.yaml` | Replaced setup-node + setup-uv with mise-action. Used just install-backend, just db::init, just db::seed, just install-frontend. |
| `.github/workflows/dast.yaml` | Added mise-action. Used just docker::build and just docker::up. Kept health check loop and cleanup as direct commands. |

### Design Decisions

1. **Coverage report format:** Backend CI coverage step uses direct `uv run pytest` with `--cov-report=xml` instead of `just test::coverage` because CI needs XML format for Codecov upload, while the just recipe generates HTML for local dev.

2. **Docker cleanup keeps direct commands:** The `just docker::clean` recipe has a `gum confirm` prompt with `false` default. In CI (non-TTY), the fallback would skip the cleanup. Direct `docker compose down -v` commands are used for CI cleanup/teardown steps.

3. **Playwright steps keep working-directory:** Playwright install and test commands remain with `working-directory: frontend` because they use `npx` which needs to resolve from the frontend `node_modules`.

4. **Frontend tests keep direct command:** `cd frontend && npm run test:run` used instead of a just recipe because the vitest runner doesn't have a corresponding just recipe (the test module focuses on backend pytest).

5. **GITHUB_STEP_SUMMARY preserved inline:** Nightly quality jobs keep inline bash for `$GITHUB_STEP_SUMMARY` formatting -- this is CI-specific output that doesn't belong in just recipes.

6. **Retry loops preserved:** Chaos and endurance workflows keep npm ci and Playwright install retry loops as they are CI-specific resilience patterns for self-hosted runners.

## Verification

- Zero `actions/setup-node` references in migrated workflows
- Zero `astral-sh/setup-uv` references in migrated workflows (security.yaml excluded -- separate reusable workflow)
- Zero `uv python install` references in any workflow
- All 7 target workflows contain `jdx/mise-action@v2` with `install: true`
- 17 `just` recipe invocations in ci.yaml alone
