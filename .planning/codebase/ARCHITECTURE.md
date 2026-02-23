# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Full-stack single-page application (SPA) with separate backend API and frontend client.

**Key Characteristics:**
- Backend-for-frontend (BFF) pattern with FastAPI serving a Next.js SPA
- Async-first architecture on backend (Python asyncio)
- Request-response REST API with JSON payloads
- Token-based authentication (JWT) with single-user setup
- Database abstraction layer supporting SQLite (dev) → Postgres (prod) migration

## Layers

**API Layer (Backend):**
- Purpose: REST API handlers, request validation, error handling
- Location: `backend/app/routers/`
- Contains: Route handlers using FastAPI APIRouter pattern
- Depends on: Database layer, authentication utilities, business logic (services, parsers)
- Used by: Frontend client via fetch requests to `/api/v1/*` paths

**Service Layer (Backend):**
- Purpose: Business logic for background operations (scheduling, backups)
- Location: `backend/app/services/`
- Contains: Scheduler service, backup service implementations
- Depends on: ORM models, database session
- Used by: Application lifecycle (startup/shutdown in main.py)

**Parser Layer (Backend):**
- Purpose: File format parsing for transaction imports (CSV, QIF, QFX, OFX)
- Location: `backend/app/parsers/`
- Contains: Base parser class, format-specific implementations in `formats/` subdirectory
- Depends on: ORM models for import session tracking
- Used by: `import_router.py` for preview and confirm operations

**Data Access Layer (Backend):**
- Purpose: ORM models and database connection management
- Location: `backend/app/orm.py`, `backend/app/database.py`
- Contains: SQLAlchemy declarative models, async session factory
- Depends on: SQLAlchemy, Alembic migrations
- Used by: All routers and services

**Middleware Layer (Backend):**
- Purpose: Cross-cutting concerns (demo mode restrictions)
- Location: `backend/app/middleware/`
- Contains: Demo mode enforcement, CORS configuration (in main.py)
- Depends on: FastAPI request/response objects
- Used by: FastAPI application in `main.py`

**Frontend UI Layer:**
- Purpose: User interface components and page layouts
- Location: `frontend/src/components/`, `frontend/src/app/`
- Contains: React components (pages, layouts, shared UI), organized by feature area
- Depends on: Hooks, contexts, API fetching utilities
- Used by: App Router page components

**Context/State Layer (Frontend):**
- Purpose: Client-side state management (authentication, dashboard configuration)
- Location: `frontend/src/contexts/`
- Contains: React Context providers (AuthContext, DashboardContext, DemoModeContext)
- Depends on: API client (fetch), local storage
- Used by: Components via useContext hooks

**Hooks Layer (Frontend):**
- Purpose: Reusable client-side logic and API fetching
- Location: `frontend/src/hooks/`
- Contains: SWR-based data fetching hooks (useWidgetData), utility hooks (useFormat, useApiError)
- Depends on: SWR library, contexts, API endpoints
- Used by: Components for data fetching and business logic

## Data Flow

**Authentication Flow:**

1. User visits `/` → AuthContext checks `/api/v1/auth/status`
2. If not initialized: redirect to `/setup` (create first user)
3. If initialized but not authenticated: redirect to `/login`
4. User submits credentials → `POST /api/v1/auth/setup` or `POST /api/v1/auth/login`
5. Backend returns JWT token + user object
6. Frontend stores token in localStorage + cookie
7. Token included as `Authorization: Bearer <token>` header on subsequent requests
8. `get_current_user()` dependency in routers validates token

**Transaction List Flow:**

1. Frontend page (`transactions/page.tsx`) mounts
2. Component fetches tags from backend (buckets, accounts, occasions)
3. Component builds filter query string with cursor-based pagination
4. `GET /api/v1/transactions?cursor=<encoded_cursor>&limit=50&filters...` called via fetch
5. Backend `transactions.router` validates filters, executes cursor-paginated query
6. Returns `PaginatedTransactions` with `next_cursor`, transaction array, total count
7. Frontend renders list, stores next_cursor for "load more"
8. User filters/sorts → query string updated → fetch new cursor position

**Import Flow:**

1. User uploads CSV file → `POST /api/v1/import/preview` (multipart file upload)
2. Backend `import_router` routes to correct parser based on file content
3. Parser returns preview list with detected format, duplicate count, transaction count
4. Frontend displays preview with action buttons
5. User confirms → `POST /api/v1/import/confirm` with import_session_id
6. Backend executes import, creates Transaction records, returns created transactions
7. Frontend navigates to Transactions page

**State Management:**

- **Authentication:** AuthContext (global, persists to localStorage)
- **Dashboard Configuration:** DashboardContext (reads/writes dashboard settings API)
- **Widget Data:** SWR hooks with URL-based caching (refetch on param changes)
- **Demo Mode:** DemoModeContext (flag from backend, disables destructive operations)

## Key Abstractions

**Error Handling (Backend):**
- Purpose: Standardized error responses with i18n-friendly error codes
- Files: `backend/app/errors.py`, `backend/app/routers/*.py`
- Pattern: Raise `AppException` subclasses (bad_request, not_found, conflict, unauthorized) with `ErrorCode` enum
- Example: `raise bad_request(ErrorCode.TAG_ALREADY_EXISTS, "Tag namespace:value already exists")`
- Frontend maps error codes to translated messages via i18n

**Tag System (Full-Stack):**
- Purpose: Flexible categorization with namespaces (bucket, account, occasion, merchant)
- ORM: `backend/app/orm.py:Tag` with namespace + value + description
- Join Table: `TransactionTag` for many-to-many relationships
- Routers: `/api/v1/tags/{id}/*`, `/api/v1/tag-rules` for automation
- Frontend: Components accept tag objects, display as `namespace:value` pairs

**Filter/Query Building (Backend):**
- Purpose: Reusable query construction for complex transaction filtering
- Files: `backend/app/routers/transactions.py:build_transaction_filter_query()`
- Supports: Account filter (via FK), date ranges, search (text + regex), amount ranges, tags, transfer status
- Pattern: Builds SQLAlchemy WHERE clauses, shared between list and count endpoints

**Pagination (Backend):**
- Purpose: Cursor-based pagination for large result sets
- Files: `backend/app/utils/pagination.py`
- Pattern: Encode/decode cursor from transaction ID + sort position
- Benefits: Handles insertions/deletions without offset issues

**Import Format Registry (Backend):**
- Purpose: Dynamic parser lookup and registration
- Files: `backend/app/parsers/registry.py`
- Pattern: Format enum → parser class mapping
- Extensible: New formats added by creating parser class + registering in registry

## Entry Points

**Backend Main:**
- Location: `backend/app/main.py`
- Triggers: Application startup (uvicorn)
- Responsibilities: Create FastAPI app, attach routers, setup middleware, initialize database, start scheduler

**Frontend Root Layout:**
- Location: `frontend/src/app/(main)/layout.tsx`
- Triggers: Any request to protected routes
- Responsibilities: Wrap children with ProtectedProviders (AuthProvider, DashboardProvider), render NavBar, apply theme

**Frontend Auth Layout:**
- Location: `frontend/src/app/(auth)/layout.tsx`
- Triggers: Requests to `/setup`, `/login`
- Responsibilities: Render minimal layout without NavBar, apply Providers (no auth check)

**Frontend Transactions Page:**
- Location: `frontend/src/app/(main)/transactions/page.tsx`
- Triggers: User navigates to `/transactions`
- Responsibilities: Fetch tags, build transaction queries with cursor pagination, render virtual list

## Error Handling

**Strategy:** Explicit error codes + standardized HTTP responses

**Patterns:**

Backend:
```python
# In routers, raise typed exceptions
if not transaction:
    raise not_found(ErrorCode.TRANSACTION_NOT_FOUND, f"Transaction {id} not found")

if tag.namespace in protected_namespaces:
    raise bad_request(ErrorCode.TAG_INVALID_FORMAT, "Cannot modify reserved namespace")

# FastAPI exception handlers convert to JSON responses
# Response: {"error_code": "TRANSACTION_NOT_FOUND", "detail": "...", "status_code": 404}
```

Frontend:
```typescript
// Hooks map error codes to translations
const { data, error } = useSWR(url, fetcher)
if (error?.response?.data?.error_code === 'TRANSACTION_NOT_FOUND') {
  return <p>{t('errors.transaction_not_found')}</p>
}
```

## Cross-Cutting Concerns

**Logging:**
- Backend: Structured logging via observability module (`backend/app/observability/`)
- Frontend: Console.log with context prefixes (e.g., `[AuthContext]`, `[TransactionsPage]`)

**Validation:**
- Backend: Pydantic models in schemas.py + custom validators in routers
- Frontend: TypeScript types + HTML5 input constraints (date, number, required)

**Authentication:**
- Backend: JWT token in Authorization header, verified in `get_current_user()` dependency
- Frontend: Token stored in localStorage, included in all fetch requests
- Middleware: Demo mode blocks destructive operations regardless of token

**Internationalization:**
- Backend: Error codes returned in responses, no i18n in backend
- Frontend: next-intl provider wraps app, components use useTranslations() hook for all user-visible text

---

*Architecture analysis: 2026-02-23*
