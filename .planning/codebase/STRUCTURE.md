# Codebase Structure

**Analysis Date:** 2026-02-23

## Directory Layout

```
maxwells-wallet/
├── backend/                    # FastAPI Python application
│   ├── app/
│   │   ├── main.py            # FastAPI app initialization, routers, lifespan
│   │   ├── database.py        # SQLAlchemy async engine, session factory
│   │   ├── orm.py             # SQLAlchemy ORM models (all tables)
│   │   ├── models.py          # Compatibility re-exports from orm.py + schemas.py
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── errors.py          # ErrorCode enum, exception classes
│   │   ├── config.py          # Configuration from environment
│   │   ├── version.py         # Version constants and helpers
│   │   ├── csv_parser.py      # CSV parsing utilities (legacy)
│   │   ├── tag_inference.py   # Tag suggestion/inference logic
│   │   ├── routers/           # API route handlers (one per resource)
│   │   │   ├── auth.py        # Authentication (login, setup, status, password)
│   │   │   ├── transactions.py # Transaction CRUD, filtering, tagging
│   │   │   ├── tags.py        # Tag management (create, update, delete, reorder)
│   │   │   ├── tag_rules.py   # Auto-categorization rules
│   │   │   ├── accounts.py    # Account management
│   │   │   ├── budgets.py     # Budget CRUD and tracking
│   │   │   ├── merchants.py   # Merchant alias management
│   │   │   ├── transfers.py   # Transfer detection and linking
│   │   │   ├── recurring.py   # Recurring pattern detection
│   │   │   ├── import_router.py # File import (preview, confirm)
│   │   │   ├── reports.py     # Analytics (monthly summary, trends, anomalies)
│   │   │   ├── dashboard.py   # Dashboard widget configuration
│   │   │   ├── dashboards.py  # Multi-dashboard management
│   │   │   ├── filters.py     # Saved search filters
│   │   │   ├── admin.py       # Administrative operations (export, clear, backup)
│   │   │   ├── settings.py    # App settings (language preferences)
│   │   │   └── test.py        # Test utilities (seeding, clearing)
│   │   ├── services/          # Background services and business logic
│   │   │   ├── scheduler.py   # APScheduler integration for recurring tasks
│   │   │   └── backup.py      # Backup/restore functionality
│   │   ├── parsers/           # Import format parsers
│   │   │   ├── base.py        # BaseParser abstract class
│   │   │   ├── registry.py    # Format-to-parser registry
│   │   │   └── formats/       # Format-specific implementations
│   │   │       ├── csv.py     # CSV parser (Bank of America, Amex, Venmo)
│   │   │       ├── qif.py     # QIF parser
│   │   │       ├── qfx.py     # QFX (OFX 2.x) parser
│   │   │       └── custom.py  # Custom format parser
│   │   ├── utils/             # Utility functions
│   │   │   ├── auth.py        # Password hashing, JWT token creation/verification
│   │   │   ├── hashing.py     # Transaction content hash for deduplication
│   │   │   └── pagination.py  # Cursor encoding/decoding
│   │   ├── middleware/        # FastAPI middleware
│   │   │   └── demo_mode.py   # Demo mode enforcement (blocks destructive ops)
│   │   └── observability/     # Logging and tracing setup
│   │       └── (tracing/logging configuration)
│   ├── alembic/               # Database migrations (Alembic)
│   │   ├── versions/          # Migration scripts
│   │   └── env.py             # Alembic environment config
│   ├── tests/                 # Backend test files
│   ├── pyproject.toml         # Poetry/uv dependencies
│   └── alembic.ini            # Alembic config
├── frontend/                  # Next.js 16 React application
│   ├── src/
│   │   ├── app/               # App Router structure
│   │   │   ├── layout.tsx     # Root layout (not used; (main) and (auth) are siblings)
│   │   │   ├── globals.css    # Global Tailwind styles
│   │   │   ├── (auth)/        # Authentication route group
│   │   │   │   ├── layout.tsx # Auth layout (minimal, no NavBar)
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── setup/page.tsx
│   │   │   └── (main)/        # Protected routes group
│   │   │       ├── layout.tsx # Main layout (with NavBar, ProtectedProviders)
│   │   │       ├── page.tsx   # Dashboard homepage
│   │   │       ├── dashboard/
│   │   │       │   ├── configure/page.tsx
│   │   │       │   └── manage/page.tsx
│   │   │       ├── transactions/page.tsx
│   │   │       ├── budgets/page.tsx
│   │   │       ├── tags/page.tsx
│   │   │       ├── recurring/page.tsx
│   │   │       ├── import/page.tsx
│   │   │       ├── reconcile/page.tsx
│   │   │       ├── organize/page.tsx
│   │   │       ├── tools/page.tsx
│   │   │       └── admin/page.tsx
│   │   ├── components/        # Reusable React components (organized by feature)
│   │   │   ├── admin/         # Admin page components
│   │   │   ├── dashboard/     # Dashboard widget container
│   │   │   ├── transactions/  # Transaction list and detail components
│   │   │   ├── import/        # Import flow components (preview, format mapper)
│   │   │   ├── widgets/       # Dashboard widget implementations (charts, tables)
│   │   │   ├── tools/         # Tool page components (splitting, reconciliation)
│   │   │   ├── format-mapper/ # Custom format configuration UI
│   │   │   ├── AuthGuard.tsx  # Auth redirect wrapper
│   │   │   ├── NavBar.tsx     # Top navigation
│   │   │   ├── ProtectedProviders.tsx # Wraps protected routes with auth check
│   │   │   ├── Providers.tsx  # Client component providers (NextIntlClientProvider)
│   │   │   ├── PageHelp.tsx   # Help tooltips for pages
│   │   │   ├── DemoModeContext.tsx # Demo mode flag provider
│   │   │   └── ...            # Other shared components
│   │   ├── contexts/          # React Context providers
│   │   │   ├── AuthContext.tsx # Authentication state (user, login, logout)
│   │   │   ├── DashboardContext.tsx # Current dashboard config, date range
│   │   │   └── DemoModeContext.tsx # Demo mode flag from backend
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useWidgetData.ts # SWR hooks for dashboard widget data
│   │   │   ├── useFormat.ts    # Currency, percentage, date formatting
│   │   │   ├── useApiError.ts  # Error extraction and translation
│   │   │   ├── useFormatDetection.ts # Detect import file format
│   │   │   ├── useDebouncedValue.ts # Debounce user input
│   │   │   └── ...
│   │   ├── lib/               # Utility functions
│   │   │   ├── format.ts      # Number, currency, date formatting
│   │   │   └── themes.ts      # Theme configuration
│   │   ├── types/             # TypeScript type definitions
│   │   │   └── (type interfaces for domain models)
│   │   ├── messages/          # Translation files (i18n)
│   │   │   ├── en-US.json     # Source language (EDIT THIS)
│   │   │   ├── de-DE.json     # German (Crowdin-managed)
│   │   │   ├── fr-FR.json     # French (Crowdin-managed)
│   │   │   ├── es-ES.json     # Spanish (Crowdin-managed)
│   │   │   ├── ...            # Other locales
│   │   │   └── pseudo.json    # Pseudo-locale for testing
│   │   ├── test/              # Frontend test utilities
│   │   │   ├── mocks/         # Mock API responses, fixtures
│   │   │   └── ...
│   │   ├── test-ids/          # Test ID constants
│   │   │   ├── index.ts       # TEST_IDS and CHAOS_EXCLUDED_IDS objects
│   │   │   └── test-ids.test.ts
│   │   └── i18n.ts            # next-intl configuration
│   ├── e2e/                   # Playwright end-to-end tests
│   │   ├── .auth/             # Cached auth state for tests
│   │   ├── chaos/             # Chaos/monkey testing
│   │   └── *.spec.ts          # E2E test files
│   ├── public/                # Static assets
│   ├── playwright.config.ts   # Playwright configuration
│   ├── next.config.js         # Next.js configuration (API proxy, i18n routing)
│   ├── tsconfig.json          # TypeScript configuration
│   ├── package.json           # npm dependencies, scripts
│   └── vitest.config.ts       # Vitest configuration for unit tests
├── .planning/
│   └── codebase/              # Codebase analysis documents (this directory)
│       ├── ARCHITECTURE.md    # Architecture patterns and layers
│       └── STRUCTURE.md       # This file
├── .claude/                   # Claude AI tooling
│   ├── agents/                # Agent definitions
│   └── skills/                # Skill cards for specialized knowledge
├── docs-site/                 # Documentation website
├── deploy/                    # Deployment/infrastructure code
├── .githooks/                 # Git hooks
├── Makefile                   # Build and development commands
├── CLAUDE.md                  # Project-specific AI instructions
├── README.md                  # Project overview
└── CHANGELOG.md               # Release notes
```

## Directory Purposes

**backend/app/routers/:**
- Purpose: API endpoint handlers organized by resource
- Contains: FastAPI APIRouter instances with route decorators
- Key files: One file per major resource (transactions.py, tags.py, import_router.py, etc.)
- Pattern: Each router imports dependencies (session, current_user), builds queries, returns Pydantic response models

**backend/app/parsers/:**
- Purpose: Import file format detection and parsing
- Contains: BaseParser abstract class, format-specific implementations
- Key files: `base.py` (parse interface), `registry.py` (format lookup), `formats/*.py` (implementations)
- Extensible: New formats added by creating parser class inheriting BaseParser

**frontend/src/components/:**
- Purpose: Reusable React components organized by feature area
- Contains: Page-specific components (admin/, dashboard/, etc.), shared components (NavBar, PageHelp, etc.)
- Pattern: Feature-first organization; components imported by page.tsx files and other components
- Naming: PascalCase for component files (NavBar.tsx), kebab-case for subdirectories

**frontend/src/app/(main)/ vs (auth)/:**
- Purpose: Route grouping using Next.js layout groups
- (main): Protected routes that require authentication (transactions, budgets, dashboard, etc.)
- (auth): Public routes for setup/login, wrapped with minimal Providers (no auth check)
- Pattern: Each group has its own layout.tsx with different provider wrapping

**frontend/src/hooks/:**
- Purpose: Reusable client-side logic extracted into hooks
- Contains: SWR-based data fetching (useWidgetData), formatting (useFormat), error handling (useApiError)
- Pattern: Hooks prefixed with "use", return data + loading + error states
- Usage: Called from components to manage state and API communication

**frontend/src/messages/:**
- Purpose: Internationalization (i18n) translation strings
- Contains: JSON files, one per locale
- Key files: `en-US.json` (source—EDIT THIS), others (Crowdin-managed)
- Pattern: Nested objects with dot-notation keys (e.g., `errors.transaction_not_found`)

## Key File Locations

**Entry Points:**

Backend:
- `backend/app/main.py` - FastAPI app creation, router registration, lifespan management

Frontend:
- `frontend/src/app/(main)/layout.tsx` - Protected routes layout with auth/dashboard context
- `frontend/src/app/(auth)/layout.tsx` - Auth routes layout without auth requirements

**Configuration:**

Backend:
- `backend/app/config.py` - Environment-based configuration
- `backend/alembic.ini` - Database migration config
- `backend/pyproject.toml` - Dependencies, version, metadata

Frontend:
- `frontend/next.config.js` - API proxy, i18n routing setup
- `frontend/tsconfig.json` - TypeScript strict mode and path aliases
- `frontend/playwright.config.ts` - E2E test configuration

**Core Logic:**

Backend:
- `backend/app/orm.py` - All SQLAlchemy ORM table definitions
- `backend/app/schemas.py` - Pydantic request/response models (dual-used for validation and serialization)
- `backend/app/errors.py` - ErrorCode enum and exception factory functions

Frontend:
- `frontend/src/contexts/AuthContext.tsx` - Authentication state (global, persists token)
- `frontend/src/contexts/DashboardContext.tsx` - Current dashboard and date range config
- `frontend/src/test-ids/index.ts` - Centralized test IDs for E2E and unit tests

**Testing:**

Backend:
- `backend/tests/` - Pytest test files (mirrors app structure)
- `backend/pyproject.toml` - pytest, pytest-asyncio configuration

Frontend:
- `frontend/e2e/` - Playwright E2E tests
- `frontend/src/**/*.test.tsx` - Co-located Vitest unit tests
- `frontend/vitest.config.ts` - Vitest configuration

## Naming Conventions

**Files:**

Backend:
- Python modules: `lowercase_with_underscores.py` (transactions.py, import_router.py)
- API routers: `{resource_name}.py` or `{resource_name}_router.py` (e.g., transactions.py, import_router.py)
- Database models: PascalCase class names in orm.py (Transaction, Tag, Budget)
- Pydantic schemas: PascalCase in schemas.py (TransactionResponse, TagCreate)

Frontend:
- Components: PascalCase with .tsx extension (NavBar.tsx, DashboardConfig.tsx)
- Pages: lowercase or PascalCase depending on convention (page.tsx is required by Next.js)
- Hooks: camelCase with "use" prefix (useWidgetData.ts, useFormat.ts)
- Contexts: PascalCase with "Context" suffix (AuthContext.tsx, DashboardContext.tsx)
- Utilities: camelCase (format.ts, themes.ts)
- Test files: Mimic source file name + .test or .spec (NavBar.test.tsx)

**Directories:**

Backend:
- Feature areas: lowercase (routers/, parsers/, services/, utils/, middleware/)
- Format subdirectories: lowercase (parsers/formats/)

Frontend:
- Feature areas: lowercase (components/, hooks/, contexts/, messages/)
- Component subdirectories: lowercase (components/widgets/, components/admin/)
- App routes: lowercase or (groups) for grouping (app/(main)/, app/(auth)/)

## Where to Add New Code

**New Feature:**

Backend:
1. Create new router file in `backend/app/routers/{feature}.py`
2. Define Pydantic schemas in `backend/app/schemas.py` (or import if using existing)
3. Define ORM models in `backend/app/orm.py` if new database tables needed
4. Create database migration: `make db-migrate`
5. Register router in `backend/app/main.py:include_router()`

Frontend:
1. Create page in `frontend/src/app/(main)/{feature}/page.tsx`
2. Create components in `frontend/src/components/{feature}/` as needed
3. Create feature-specific hooks in `frontend/src/hooks/use{Feature}*.ts` if needed
4. Add test IDs to `frontend/src/test-ids/index.ts`
5. Add translations to `frontend/src/messages/en-US.json` (i18n-lead will handle Crowdin)

**New Component/Module:**

Backend:
- Place in appropriate existing directory (routers/, services/, utils/, parsers/)
- Follow naming convention (lowercase_with_underscores.py)
- If utility: add to `backend/app/utils/{name}.py`
- If service: add to `backend/app/services/{name}.py`

Frontend:
- If feature-specific component: create in `frontend/src/components/{feature}/ComponentName.tsx`
- If shared component: create in `frontend/src/components/ComponentName.tsx`
- If custom hook: create in `frontend/src/hooks/use{HookName}.ts`
- If utility function: add to `frontend/src/lib/{area}.ts`

**Utilities:**

Backend:
- Shared functions: `backend/app/utils/` (with logical filenames)
- Example: pagination logic in `utils/pagination.py`, auth helpers in `utils/auth.py`

Frontend:
- Formatting/calculation: `frontend/src/lib/format.ts`
- Custom hooks for reuse: `frontend/src/hooks/use*.ts`
- Context providers for global state: `frontend/src/contexts/*Context.tsx`

## Special Directories

**backend/alembic/versions/:**
- Purpose: Database schema migrations
- Generated: Yes (via `alembic revision --autogenerate`)
- Committed: Yes (version control for schema evolution)
- Naming: Auto-generated timestamps (e.g., `2024_01_15_1234_add_user_table.py`)

**frontend/.next/:**
- Purpose: Next.js build output
- Generated: Yes (via `npm run build`)
- Committed: No (in .gitignore)

**frontend/node_modules/:**
- Purpose: npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)

**backend/.mypy_cache/, .pytest_cache/:**
- Purpose: Type checking and test caching
- Generated: Yes (during development)
- Committed: No (in .gitignore)

**frontend/e2e/.auth/:**
- Purpose: Cached authentication state for E2E tests
- Generated: Yes (first test run stores auth token)
- Committed: No (in .gitignore, but referenced in playwright.config.ts for reuse)

---

*Structure analysis: 2026-02-23*
