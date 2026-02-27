# Plan 15-02 Summary

**Plan:** Sweep all remaining docs, agents, skills for just migration
**Status:** Complete
**Duration:** ~8 minutes
**Commits:** 1

## What Changed

### Agent MDC Files (5 files)
- `techlead.mdc`: `make` targets → `just` recipes
- `backend-lead.mdc`: `make backend`/`make test-backend` → `just dev::backend`/`just test::backend`
- `frontend-lead.mdc`: `make frontend`/`make dev` → `just dev::frontend`/`just dev::dev`
- `testlead.mdc`: `make test-backend`/`make test-all` → `just test::backend`/`just test::all`
- `i18n-lead.mdc`: All `make translate-*` → `just i18n::*`, "Make Targets" → "Just Recipes"

### Skill MDC Files (2 files)
- `fastapi.mdc`: `make test-backend` → `just test::backend`
- `testing-backend.mdc`: `make test-backend` → `just test::backend`

### Root Documentation (3 files)
- `CONTRIBUTING.md`: setup/lint/test commands updated, mise prerequisite added
- `OPENSSF.md`: build/test criterion references updated from Makefile to justfile
- `docs/MAKEFILE.md`: Full rewrite as "Just Recipes Reference" (was "Makefile Commands")

### docs/ Directory (4 files)
- `docs/i18n-workflow.md`: All make commands → just recipes, file references updated
- `docs/installation.md`: Dev setup section rewritten with mise prerequisite + just recipes
- `docs/requirements/README.md`: Makefile guide reference updated
- `docs/requirements/TECHNICAL_SPECIFICATIONS.md`: Build System and dev workflow updated

### docs-site/ Directory (5 files)
- `docs-site/index.md`: Quick Start section updated
- `docs-site/getting-started/quickstart.md`: make → just throughout
- `docs-site/getting-started/development.md`: Prerequisites + commands rewritten
- `docs-site/developer/architecture.md`: Project structure and test commands
- `docs-site/developer/database.md`: Seeding and reset commands
- `docs-site/developer/testing.md`: All test commands, data anonymization commands

### Other Files (5 files)
- `frontend/e2e/README.md`: `make test-e2e` → `just test::e2e`
- `frontend/src/messages/CLAUDE.md`: Translation commands updated
- `backend/README.md`: `make backend`/`make test-backend` → just equivalents
- `data/CLAUDE.md`: Root-level data-* commands → `just utils::data-*`
- `.claude/scratchpad/sqlalchemy-migration-plan.md`: `make test-backend` → `just test::backend`

### docs/tech-debt/ (1 file)
- `testing.md`: E2E prerequisite reference updated

## Excluded from Scope (intentional)
- `.planning/` — Historical records, not user-facing
- `CHANGELOG.md` — Historical entries
- `deploy/swag-test/README.md` — References local Makefile in deploy sub-project (separate concern)
- `data/Makefile` — Separate sub-project Makefile (just recipes delegate to it)

## DOC-03 Grep Audit Results

```
git grep -in '`make ' -- '*.md' '*.mdc' (excluding .planning, CHANGELOG, deploy, Makefile, make/)
→ zero results (exit code 1 = no matches)

git grep -n '^make ' -- '*.md' '*.mdc' (same exclusions)
→ zero results
```

## Requirements Satisfied

- **DOC-03**: Grep audit confirms zero make command references in active documentation
- All agent and skill files reference only just recipes
- All docs-site pages use just commands
- All contributing/onboarding docs reference mise + just
