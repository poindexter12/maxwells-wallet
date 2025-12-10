# CLAUDE.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

**Maxwell's Wallet** - Full-stack personal finance tracker:
- **Frontend**: Next.js 16 + TypeScript (App Router)
- **Backend**: FastAPI + Python (async)
- **Database**: SQLite (dev) with SQLModel ORM (Postgres-ready for prod)
- **Package Management**: npm (frontend), uv (backend)
- **i18n**: next-intl with 8 locales (en-US, en-GB, es, fr, it, pt, de, nl) + pseudo locale for dev/QA

## Repository Structure

```
.waypoint/
  agents/           # Canonical agent definitions
  skills/           # Canonical skill cards (Next.js, FastAPI, Postgres, TS, Python, DB/T-SQL, testing)
.claude/README.md   # Symlink to .waypoint/README.md (shared AI config instructions)
.claude/            # Symlinks to .waypoint for Claude Code
.codex/             # Symlinks to .waypoint for Codex
.cursor/            # Symlinks to .waypoint for Cursor
frontend/         # Next.js app
backend/          # FastAPI app
```

## Available Agent

- **@techlead** (`.claude/agents/techlead.mdc`): Repo-aware technical lead. Reads `CLAUDE.md` and the per-topic skills in `.claude/skills/`, builds a short plan for non-trivial tasks, prefers `make` commands, and enforces the stack-specific skills.
- **@frontend-lead** (`.claude/agents/frontend-lead.mdc`): Leads frontend/UI changes. Applies Next.js and TypeScript skills; prefers `make frontend`/`make dev`.
- **@backend-lead** (`.claude/agents/backend-lead.mdc`): Leads backend/API work. Applies FastAPI, Python, and Postgres skills; prefers `make backend`/`make test-backend`; defaults to read/EXPLAIN posture for DB.
- **@db-lead** (`.claude/agents/db-lead.mdc`): Leads database design/migrations/query review. Applies Postgres and DB-design skills; favors additive, reversible migrations and explicit EXPLAIN-before-write.
- **@testlead** (`.claude/agents/testlead.mdc`): Leads testing strategy/implementation. Applies frontend, backend, and Python testing skills; prefers repo `make` test targets; keeps tests deterministic and isolated.

## Development Commands

**IMPORTANT**: Always prefer `make` commands over running commands directly. The Makefile handles environment setup, paths, and can include additional variables or env files as needed.

### Using Make (Preferred)

From the repository root:
```bash
# First-time setup
make setup               # Install deps + seed database

# Development
make dev                 # Run both backend and frontend in parallel
make backend             # Run backend only
make frontend            # Run frontend only

# Build & Test
make build-frontend      # Build frontend for production
make test-backend        # Run backend tests
make test-all            # Run all tests

# Database
make db-migrate          # Create new migration
make db-upgrade          # Apply migrations
make db-reset            # Reset database

# Linting & Quality
make lint                # Lint all code
make quality             # Run all quality checks
```

Run `make help` to see all available targets.

### Direct Commands (When Necessary)

Backend (from `backend/` directory):
```bash
uv run uvicorn app.main:app --reload
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

Frontend (from `frontend/` directory):
```bash
pnpm dev
pnpm build
```

## Architecture Notes

**Backend**:
- Async FastAPI with SQLModel/SQLAlchemy
- Database abstraction layer supports SQLite (dev) → Postgres (prod) migration
- Alembic for schema migrations
- Base model pattern with common fields (id, created_at, updated_at)
- CORS configured for localhost:3000

**Frontend**:
- Next.js App Router structure
- API proxy configured in `next.config.js` to route `/api/*` to backend
- Tailwind CSS for styling

**Python Environment**:
- uv replaces both venv + pip
- `.envrc` with direnv for auto-activation
- `.python-version` pins Python 3.11+
- Never use `pip` directly - always `uv pip` or `uv run`

## Typical Workflow

1. Use `make` targets for setup, dev, tests, and migrations (see commands above).
2. Run backend (`uv run uvicorn ...`) and frontend (`pnpm dev`) servers for local development.
3. Iterate by editing code/config directly.

## Release Checklist

When preparing a release (including betas):
1. **Update versions** in both:
   - `frontend/package.json` → `"version": "x.y.z"`
   - `backend/pyproject.toml` → `version = "x.y.z"`
2. **Update CHANGELOG.md** with new section for the version
3. **Update README.md** "What's New" section if significant changes

## Agent Skills and Tooling Guidance

Use this section for quick reference. Canonical skill cards live in `.claude/skills/` (one per topic). If only one agent needs custom rules, add them in `.claude/agents/*.mdc`.

### Next.js (TypeScript, App Router)
- Default to server components; use client components only for event-heavy UI.
- Prefer App Router patterns: layouts, loading/error boundaries, route segments, metadata.
- Data fetching: use `fetch` with `cache`/`revalidate` hints; colocate server actions near forms; avoid `SELECT *` in API routes.
- Styling: keep Tailwind utility-first; avoid inline styles except for dynamic cases.
- Routing: respect dynamic params (`[id]`), avoid nested `page.tsx` data duplication; ensure API proxy paths stay in sync with backend.

### FastAPI (Python, async)
- Keep handlers async end-to-end; avoid blocking calls in request paths.
- Use Pydantic models for request/response; set explicit status codes and error payloads.
- Dependency injection: DB session from a single `get_session` dependency; avoid global sessions.
- Validation: constrain query/path params (max lengths, enums); return typed responses for OpenAPI accuracy.
- Testing: structure tests around routers/services; prefer `make test-backend` to run suites.

### Postgres (production target)
- Default to read/EXPLAIN before write; parameterize queries, never string-concatenate SQL.
- Schema: include PKs, FKs (with indexes), unique constraints, and check constraints where helpful.
- Indexing: add covering or composite indexes for frequent filters/sorts; avoid over-indexing writes.
- Migrations: prefer Alembic with reversible steps; annotate breaking changes; keep zero-downtime in mind.
- Data access: avoid `SELECT *`; fetch only needed columns; consider pagination strategies (keyset over offset for large tables).

### TypeScript
- Use strict mode-friendly patterns; avoid `any`/`as` assertions unless narrowing is impossible.
- Derive types from data (`as const`, `satisfies`); favor discriminated unions for branching logic.
- Keep API types shared in a single module; avoid duplicating request/response shapes between frontend and backend contracts.
- Narrow errors and async responses; wrap server actions and fetchers with typed return envelopes.

### Python
- Type-hint everything (including FastAPI dependency returns); avoid mutable default arguments.
- Prefer dataclasses or Pydantic models for structured data; isolate side effects at module boundaries.
- Logging: use structured logs; avoid `print`.
- Concurrency: ensure awaited DB/HTTP calls; avoid background tasks inside request handlers unless explicitly needed.

### Database Design / T-SQL Skills
- Normalize first (3NF), then denormalize intentionally for reads; document trade-offs.
- Name tables/columns predictably; timestamp columns should be UTC with clear semantics (`created_at`, `updated_at`).
- Default to bigint/uuid PKs; ensure FK cascades are explicit (set null/restrict/cascade).
- Add indexes for foreign keys and common predicates; evaluate partial indexes for sparse data.
- Write migrations to be idempotent and reversible; include comments on rollback steps.

### Testing (E2E + Unit)

#### Test ID Usage (REQUIRED for all tests)
- **Always use `data-testid` attributes** for element selection in tests. Never rely on text content, CSS classes, or DOM structure.
- **This applies to BOTH E2E tests AND unit tests (Vitest/React Testing Library)**
- Reason: Text content changes when translations are added/modified. Test IDs are translation-agnostic.
- All test IDs are centralized in `frontend/src/test-ids.ts` - add new IDs there before using them.

#### Test ID Constants Pattern
```tsx
// In component:
import { TEST_IDS } from '@/test-ids';
<div data-testid={TEST_IDS.IMPORT_RESULT}>...</div>

// In unit test:
import { TEST_IDS } from '@/test-ids';
expect(screen.getByTestId(TEST_IDS.IMPORT_RESULT)).toBeInTheDocument();

// In E2E test:
import { TEST_IDS } from '../src/test-ids';
await page.locator(`[data-testid="${TEST_IDS.IMPORT_RESULT}"]`).click();
```

#### Naming Convention
- Format: `<component>-<element>` (e.g., `filter-search`, `transactions-list`, `help-dismiss`)
- Page containers: `<page>-page` (e.g., `transactions-page`)
- Lists/tables: `<name>-list` (e.g., `transactions-list`)
- Form inputs: `<form>-<field>` (e.g., `filter-search`, `filter-bucket`)
- Buttons: `<action>-button` (e.g., `help-dismiss`, `import-confirm`)
- Values/counts: `<component>-<field>-value` (e.g., `overview-stat-total-transactions-value`)

#### Two Groups of Test IDs
- `TEST_IDS`: Normal elements - safe for chaos testing to interact with
- `CHAOS_EXCLUDED_IDS`: Destructive actions (delete, purge) - chaos tests automatically skip these
- When adding a destructive button (delete, purge, remove), use `CHAOS_EXCLUDED_IDS` not `TEST_IDS`.

#### Test Locations
- E2E tests live in `frontend/e2e/`. Run with `make test-e2e` or `npx playwright test`.
- Unit tests live alongside components as `*.test.tsx`. Run with `make test-frontend` or `npx vitest`.
- See `frontend/e2e/README.md` for detailed E2E testing conventions.

### Chaos Testing (`data-chaos-target`)
- **Use `data-chaos-target` attribute** to mark interactive elements for chaos/monkey testing.
- Unlike `data-testid` (static selectors for specific tests), `data-chaos-target` is for discoverable elements that chaos tests will randomly interact with.
- The chaos test system auto-detects element type: buttons/links get clicked, inputs get filled, selects get options chosen.
- **When to use which attribute:**
  - `data-testid`: When you need to select a specific element in a targeted test
  - `data-chaos-target`: When you want chaos tests to discover and interact with the element
  - Elements can have both attributes if needed
- **Naming convention:** `data-chaos-target="<page>-<element>"` (e.g., `nav-dashboard`, `budget-form-submit`, `import-mode-batch`)
- **Destructive actions:** Use `data-chaos-exclude` attribute instead to prevent chaos tests from clicking destructive buttons
  ```tsx
  // Safe for chaos tests to click
  <button data-chaos-target="budget-new">New Budget</button>

  // Excluded from chaos testing (delete action)
  <button data-chaos-exclude>Delete</button>
  ```
- **Adding chaos targets to new components:**
  1. Add `data-chaos-target="descriptive-name"` to interactive elements (buttons, links, inputs, selects)
  2. For destructive actions, use `data-chaos-exclude` instead
  3. Test locally: `npx playwright test chaos/ --headed` to see chaos tests in action
