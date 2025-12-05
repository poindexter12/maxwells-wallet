# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Maxwell's Wallet** - Full-stack personal finance tracker built with FORGE Kit:
- **Frontend**: Next.js 14 + TypeScript (App Router)
- **Backend**: FastAPI + Python (async)
- **Database**: SQLite (dev) with SQLModel ORM (Postgres-ready for prod)
- **Package Management**: pnpm (frontend), uv (backend)

Project scaffolding: Next.js frontend + FastAPI backend with CRUD "items" (title, description, timestamps)

## Repository Structure

```
.claude/
  agents/           # Agent definitions (e.g., techlead.mdc)
  skills/           # Per-topic skill cards (Next.js, FastAPI, Postgres, TS, Python, DB/T-SQL)
dev/forge-kit/    # FORGE Kit submodule (toolkit source)
forge.config.yaml # Project configuration (stack, features, constraints)
frontend/         # Next.js app (when generated)
backend/          # FastAPI app (when generated)
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

## forge.config.yaml

Single source of truth defining:
- Stack: Next.js + FastAPI + SQLite/SQLModel
- Directories: `frontend/` and `backend/`
- Initial features: CRUD items (title, description, timestamps)
- Non-goals: no auth, no deployment pipeline, no multi-tenant
- Runtime commands specified in `constraints` section

Edit this file to change project scope, then run `@forge` to implement changes.

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

1. Modify `forge.config.yaml` to add features or change stack if you want to regenerate scaffolding.
2. Use `make` targets for setup, dev, tests, and migrations (see commands above).
3. Run backend (`uv run uvicorn ...`) and frontend (`pnpm dev`) servers for local development.
4. Iterate by editing code/config directly; regenerate scaffolding only when necessary.

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
