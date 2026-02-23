# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**
- TypeScript 5.9.3 - Frontend web application (App Router, React components)
- Python 3.11+ - Backend API (FastAPI async)

**Secondary:**
- JavaScript - Node.js tooling and configuration
- SQL - Database migrations and queries

## Runtime

**Environment:**
- Node.js 22 (pinned in `.nvmrc`)
- Python 3.11+ (default via project configuration)

**Package Manager:**
- npm (frontend) - Lockfile: `frontend/package-lock.json` (present)
- uv (backend) - Lockfile: `backend/uv.lock` (present)

## Frameworks

**Core:**
- Next.js 16.1.5 - Full-stack React framework (App Router, server/client components)
- FastAPI 0.104.0+ - Async Python web framework
- React 19.2.4 - Frontend UI framework
- SQLAlchemy 2.0.0 (with asyncio) - ORM for Python backend

**Styling:**
- Tailwind CSS 4.1.18 - Utility-first CSS framework
- PostCSS 8.5.6 - CSS preprocessing (autoprefixer)

**State Management & Data:**
- SWR 2.3.8 - Frontend data fetching and caching (Next.js API routes)
- next-intl 4.7.0 - i18n framework (9 locales: en-US, en-GB, es-ES, fr-FR, it-IT, pt-PT, de-DE, nl-NL, pseudo)

**Date & Time:**
- date-fns 4.1.0 - Date utility library
- react-day-picker 9.13.0 - Calendar/date picker component

**Visualization:**
- recharts 3.7.0 - React charting library (used in dashboard widgets)
- @tanstack/react-virtual 3.13.18 - Virtual scrolling for large lists

**Testing:**
- Vitest 4.0.14 - Unit/component test runner (replaces Jest)
- Playwright 1.58.0 - E2E testing framework
- MSW 2.12.4 - Mock Service Worker for API mocking (dev)
- @testing-library/react 16.3.2 - React testing utilities
- @testing-library/jest-dom 6.9.1 - Testing assertions
- jsdom 28.1.0 - Browser environment emulation for tests

**Build/Dev:**
- Alembic 1.12.0 - Database schema migrations (Python)
- ESLint 9.39.2 - JavaScript/TypeScript linting
- TypeScript 5.9.3 - Type checking
- @swc/helpers 0.5.17 - SWC JavaScript compiler helpers

## Key Dependencies

**Critical - Frontend:**
- next 16.1.5 - Web framework (server/client split, routing, API proxy)
- react 19.2.4 - UI library
- tailwindcss 4.1.18 - Styling system
- next-intl 4.7.0 - i18n (9 locale support required)

**Critical - Backend:**
- fastapi 0.104.0+ - API framework (async, automatic OpenAPI docs)
- sqlalchemy[asyncio] 2.0.0 - Async ORM (supports SQLite dev → Postgres prod)
- pydantic 2.0.0 - Data validation and settings
- alembic 1.12.0 - Database versioning

**Authentication & Security:**
- bcrypt 4.0.0 - Password hashing (replaces passlib for direct bcrypt)
- PyJWT 2.8.0 - JWT token creation/verification
- python-multipart 0.0.6 - Multipart form parsing

**Database Access:**
- aiosqlite 0.19.0 - Async SQLite driver (development)
- greenlet 3.0.0 - Coroutine support for async sessions

**Observability:**
- opentelemetry-api 1.24.0 - Tracing instrumentation
- opentelemetry-sdk 1.24.0 - Tracing implementation
- opentelemetry-exporter-otlp 1.24.0 - OTLP exporter
- opentelemetry-instrumentation-fastapi 0.45b0 - FastAPI auto-instrumentation
- opentelemetry-instrumentation-sqlalchemy 0.45b0 - Database query tracing
- prometheus-client 0.19.0 - Metrics collection and export
- structlog 24.1.0 - Structured logging

**HTTP Clients:**
- httpx 0.25.0 - Async HTTP client

**Configuration:**
- python-dotenv 1.0.0 - Environment variable loading
- pydantic-settings 2.0.0 - Settings management via Pydantic

**Scheduling:**
- apscheduler 3.10.0 - Background job scheduling (demo reset, backups)

**Internationalization:**
- @crowdin/cli 4.13.0 - Crowdin integration for translations
- crowdin-context-harvester 0.8.1 - Crowdin context automation
- pseudo-localization 3.1.1 - Pseudo-locale generation for testing

**Version Control:**
- baseline-browser-mapping 2.9.18 - Browser version mappings

## Configuration

**Environment:**
- Backend: Environment variables with `.env` (optional, loaded by python-dotenv)
- Frontend: BACKEND_URL rewrites via `next.config.js`
- Database: DATABASE_URL controls SQLite (dev) or Postgres (production)
- Key env vars:
  - `DATABASE_URL` - Database connection (default: `sqlite+aiosqlite:///./wallet.db`)
  - `BACKEND_URL` - API location for frontend (default: `http://localhost:3001`)
  - `DEMO_MODE` - Restricts destructive operations
  - `SKIP_MIGRATIONS` - Skip Alembic on startup (used in E2E tests)
  - `ENABLE_PSEUDO` - Enable pseudo locale for i18n testing
  - `OTEL_*` - OpenTelemetry configuration (tracing, metrics)

**Build:**
- Frontend: `next.config.js` - API rewrites, standalone output
- Backend: `pyproject.toml` - Hatchling build, uv workspace
- `tsconfig.json` - Strict TypeScript, path aliases (`@/*`)
- `.eslintrc.json` - Next.js core-web-vitals rules
- `vitest.config.ts` - jsdom environment, setupFiles for test mocking
- `playwright.config.ts` - E2E config with auth setup, multi-browser testing
- Makefile - Development and CI commands (e.g., `make dev`, `make test-all`)

## Platform Requirements

**Development:**
- Node.js 22 (or compatible)
- Python 3.11+
- SQLite 3 (bundled, for local development)
- Optional: PostgreSQL 14+ (for production testing)
- Optional: Devcontainer (VS Code, includes all runtime dependencies)

**Production:**
- Node.js 22 (for Next.js server)
- Python 3.11+ (for FastAPI server)
- PostgreSQL 14+ (recommended for data durability)
- OpenTelemetry collector (optional, for OTLP export)
- Prometheus scrape endpoint (optional, at `/metrics`)

---

*Stack analysis: 2026-02-23*
