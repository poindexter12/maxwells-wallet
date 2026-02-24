# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- TypeScript/React components: PascalCase (e.g., `DashboardContext.tsx`, `NavBar.tsx`)
- Utility modules: camelCase (e.g., `setup.ts`, `mocks.ts`)
- Test files: Match source name with `.test.tsx` or `.test.ts` suffix (e.g., `DashboardContext.test.tsx`)
- Python modules: snake_case (e.g., `tags.py`, `tag_rules.py`)
- Python classes: PascalCase (e.g., `ErrorCode`, `DateRange`)

**Functions:**
- Async API handlers: descriptive verbs (`list_tags`, `create_dashboard`, `update_tag`)
- React hooks: camelCase with `use` prefix (e.g., `useDashboard`, `useAuth`)
- Helper functions: camelCase with descriptive verb-noun pattern (e.g., `isActive`, `handleLogout`, `linkClass`)
- Python functions: snake_case (e.g., `reset_mocks_dashboards()`, `get_session()`)

**Variables:**
- State variables: camelCase (e.g., `currentDashboard`, `loading`, `error`)
- Event handlers: camelCase with `handle` prefix (e.g., `handleLogout`, `handleChange`)
- Translations: camelCase namespaced with dot notation (e.g., `t('nav.dashboard')`, `tAuth('auth.login')`)
- Constants: UPPER_SNAKE_CASE in Python (e.g., `ERROR_CODE`, `WIDGET_INFO`)

**Types:**
- Interfaces: PascalCase with descriptive suffix (e.g., `DashboardContextType`, `WidgetInfo`, `FilterOption`)
- Enums: PascalCase (Python example: `class DateRangeType(str, Enum)`)
- Union types: Use discriminated unions with explicit branches

## Code Style

**Formatting:**
- No explicit Prettier config; uses ESLint defaults
- Line length: 120 characters (backend, enforced by Ruff)
- Indentation: 2 spaces (TypeScript/React), 4 spaces (Python)
- Semicolons: Required in TypeScript

**Linting:**
- Frontend: ESLint with Next.js config (`frontend/eslint.config.mjs`)
- Backend: Ruff for Python (`backend/pyproject.toml`)
- TypeScript strict mode enabled in `frontend/tsconfig.json`
- ESLint rule relaxations:
  - `@typescript-eslint/no-explicit-any`: warn (not error) for development flexibility
  - `react-hooks/set-state-in-effect`: off (async data fetching in useEffect is standard)
  - `react-hooks/static-components`: warn (acceptable for simple cases)
  - `@typescript-eslint/no-unused-vars`: error but allows `^_` prefix for intentionally unused vars

## Import Organization

**Order (Frontend):**
1. React/Next.js imports (`import Link from 'next/link'`)
2. Standard library imports (`import { createContext } from 'react'`)
3. Third-party UI/utility imports (`import userEvent from '@testing-library/user-event'`)
4. Internal absolute imports with `@/` alias (`import { useDashboard } from '@/contexts/DashboardContext'`)
5. Type-only imports using `import type` when needed

**Path Aliases:**
- Frontend: `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Example: `import { TEST_IDS } from '@/test-ids'`

**Backend (Python):**
- Standard library imports first
- Third-party imports (FastAPI, SQLAlchemy, Pydantic)
- Local imports (app.database, app.orm, app.schemas)
- Explicit imports preferred (no wildcard `*` except in auto-generated files like alembic)

## Error Handling

**Frontend Error Pattern:**
```typescript
try {
  const res = await fetch('/api/v1/endpoint')
  if (!res.ok) throw new Error('Failed to fetch resource')
  const data = await res.json()
  setError(null)
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error')
  return null
}
```

**Pattern Details:**
- Explicitly check `res.ok` and throw descriptive errors
- Extract error message with type guard: `err instanceof Error ? err.message : 'Unknown error'`
- Set error state to null on success
- Return null or false to indicate failure
- Errors are stored in context state and displayed via UI (user sees translated messages)

**Backend Error Pattern:**
```python
from app.errors import not_found, bad_request, ErrorCode

# Raising errors with ErrorCode enum
if not tag:
    raise not_found(ErrorCode.TAG_NOT_FOUND, tag_id=tag_id)

if existing:
    raise bad_request(ErrorCode.TAG_ALREADY_EXISTS, namespace=tag.namespace, value=tag.value)
```

**Pattern Details:**
- Use `ErrorCode` enum for standardized error codes (maps to frontend i18n)
- Error codes follow pattern: `ENTITY_ACTION` or `ENTITY_STATE` (e.g., `TAG_NOT_FOUND`, `TRANSACTION_NOT_LINKED`)
- Helpers: `not_found()`, `bad_request()`, `unauthorized()` return typed HTTPException
- Pass relevant context as kwargs for error detail logging

## Logging

**Framework:**
- Frontend: `console.log`, `console.error` (no structured logging framework)
- Backend: `structlog` for structured logging (`backend/pyproject.toml`)

**Patterns:**
- Frontend: Debug statements in development, avoid in production UI code
- Backend: Structured logs with context (user_id, request_id, etc.) for observability

## Comments

**When to Comment:**
- Complex logic that isn't self-evident
- Non-obvious workarounds or hacks (explain the "why")
- Important test setup or teardown logic
- Integration points with external systems

**JSDoc/TSDoc:**
- Router handlers: Include docstrings explaining endpoint purpose
- Example: `"""List all tags, optionally filtered by namespace"""`
- Utility functions: Document parameters and return values when non-obvious
- Test setup: Document fixture purpose and what state it creates

**Python Docstrings:**
- Module docstrings at top of file (explain module purpose)
- Class docstrings for test classes (e.g., `"""Tags API Tests"""`)
- Function docstrings for complex operations, omit for simple handlers

## Function Design

**Size:**
- Frontend React components: Keep under 200 lines; extract hooks/helpers for complex logic
- Backend route handlers: Keep under 50 lines; extract to service functions
- Test functions: Keep focused on single behavior; use helper functions for setup

**Parameters:**
- Frontend: Avoid passing more than 3-4 props; use context for deeply nested state
- Backend: Use dependency injection for sessions/config; avoid globals
- Python: Type-hint all parameters and return values

**Return Values:**
- Frontend: Return null/false to indicate failure; return data on success
- Backend: Return typed Pydantic models or lists for success; raise exceptions for errors
- Async functions: Always await; return Promise only when intentionally delayed

## Module Design

**Exports:**
- Frontend: Default export for page components (`export default Page`); named exports for utilities
- Backend: Router modules export `router` instance; model modules re-export from orm/schemas
- Python: Explicit re-exports (e.g., `models.py` re-exports from `orm.py`)

**Barrel Files:**
- `backend/app/models.py` re-exports ORM models and Pydantic schemas for backwards compatibility
- Purpose: Simplifies imports during migration from SQLModel → SQLAlchemy
- New code should import directly from `app.orm` and `app.schemas`

**File Organization:**
- Keep related types/interfaces near implementation (e.g., `DashboardContextType` in `DashboardContext.tsx`)
- Separate concerns: `contexts/` for state, `components/` for UI, `types/` for type definitions
- Backend: `routers/` for endpoints, `orm.py` for database models, `schemas.py` for validation schemas

## Async Patterns

**Frontend:**
- React components: Use `useEffect` for side effects, fetch in effect callback
- Context providers: Async operations store results in state; return promises from context methods
- Error handling in async operations: Wrap in try/catch; store error in context state

**Backend:**
- All database operations: Use `async/await` with `AsyncSession`
- All HTTP handlers: Declared `async def`; dependency injection provides `AsyncSession`
- No blocking calls in request path (e.g., no `time.sleep`, use async alternatives)

---

*Convention analysis: 2026-02-24*
