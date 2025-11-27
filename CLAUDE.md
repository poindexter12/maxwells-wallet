# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack financial application prototype built with FORGE Kit:
- **Frontend**: Next.js 14 + TypeScript (App Router)
- **Backend**: FastAPI + Python (async)
- **Database**: SQLite (dev) with SQLModel ORM (Postgres-ready for prod)
- **Package Management**: pnpm (frontend), uv (backend)

Project scaffolding: Next.js frontend + FastAPI backend with CRUD "items" (title, description, timestamps)

## Repository Structure

```
.claude/agents/
  forge.mdc       # @forge - prototype builder agent
  anvil.mdc       # @anvil - config generation agent
dev/forge-kit/    # FORGE Kit submodule (toolkit source)
forge.config.yaml # Project configuration (stack, features, constraints)
frontend/         # Next.js app (when generated)
backend/          # FastAPI app (when generated)
```

## Available Agents

### @forge
High-compliance prototyping agent. Reads `forge.config.yaml`, asks 3-7 preflight questions, then builds complete vertical slices (DB → API → UI). Prioritizes action over warnings. Use this to build or extend features.

### @anvil
Config shaping agent. Interactively generates `forge.config.yaml` by asking questions about stack, entities, and features. Use when starting fresh or reshaping the config.

## Development Commands

Backend (from `backend/` directory):
```bash
# Setup
uv venv && source .venv/bin/activate && uv pip install -e .

# Run development server
uv run uvicorn app.main:app --reload

# Database migrations
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

Frontend (from `frontend/` directory):
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
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

1. Modify `forge.config.yaml` to add features or change stack
2. Run `@forge` and provide preflight answers
3. Agent copies scaffolding from `dev/forge-kit/`, replaces template variables, builds features
4. Run backend (`uv run uvicorn ...`) and frontend (`pnpm dev`) servers
5. Iterate by editing config and re-running `@forge`
