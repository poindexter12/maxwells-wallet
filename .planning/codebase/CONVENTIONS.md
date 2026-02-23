# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- TypeScript/React: PascalCase for components (`NavBar.tsx`, `ThemeSwitcher.tsx`), camelCase for utilities (`customFormat.ts`, `pagination.ts`)
- Python: snake_case for modules and files (`auth.py`, `csv_parser.py`, `tag_inference.py`)
- Test files: `*.test.tsx`, `*.test.ts` (co-located with source) or `test_*.py` (backend)

**Functions:**
- TypeScript: camelCase (`useAuth()`, `getToken()`, `setTheme()`, `computeTransactionContentHash()`)
- Python: snake_case (`hash_password()`, `verify_password()`, `create_access_token()`, `validate_regex_pattern()`)

**Variables:**
- TypeScript: camelCase for all variables (`isAuthenticated`, `TOKEN_KEY`, `STORAGE_KEY`)
- Python: snake_case (`error_code`, `user_id`, `account_tag_id`, `transaction_content_hash`)
- Constants: UPPER_SNAKE_CASE (`ALGORITHM = "HS256"`, `MAX_REGEX_LENGTH = 200`, `TEST_DATABASE_URL`)

**Types:**
- TypeScript interfaces: PascalCase (`AuthContextType`, `AuthStatus`, `LoginCredentials`, `User`)
- Python Pydantic models: PascalCase (`TransactionCreate`, `TransactionUpdate`, `TransactionResponse`)
- Python Enums: PascalCase (`ErrorCode`, `ReconciliationStatus`, `DateRangeType`, `ImportFormatType`)

## Code Style

**Formatting:**

Frontend:
- Tool: ESLint with Next.js configuration (`eslint-config-next`)
- TypeScript strict mode enabled in `tsconfig.json`
- No explicit Prettier config (Next.js ESLint is primary tool)

Backend:
- Tool: Ruff for linting and formatting
- Line length: 120 characters
- Target Python version: 3.11

**Linting:**

Frontend:
- ESLint with `next/core-web-vitals` preset
- Run with: `npm run lint`

Backend:
- Ruff checks: E (errors), F (pyflakes), W (warnings)
- Ruff ignores: E501 (line length)
- Per-file ignores: F401 in `__init__.py` (re-exports), F403/F401 in `alembic/env.py`
- Run with: `uv run ruff check .`

## Import Organization

**Order (TypeScript):**
1. React and core libraries (`import { createContext, useContext, ... } from 'react'`)
2. Next.js libraries (`import { useRouter, usePathname } from 'next/navigation'`)
3. Third-party libraries (`import { useTranslations } from 'next-intl'`)
4. Absolute imports from `@/` alias (`import { TEST_IDS } from '@/test-ids'`)
5. Relative imports (`./../lib/`, `./components/`)

**Order (Python):**
1. Standard library imports (`from datetime import datetime`, `import asyncio`)
2. Third-party imports (`from fastapi import APIRouter`, `from sqlalchemy import select`)
3. Local app imports (`from app.database import get_session`, `from app.orm import Transaction`)

**Path Aliases:**

TypeScript:
- `@/*` → `./src/*` (configured in `tsconfig.json`)
- Used consistently in all imports: `import { TEST_IDS } from '@/test-ids'`

Python:
- No path aliases - imports use relative or absolute `app.*` paths

## Error Handling

**Backend (Python/FastAPI):**

Use `AppException` with structured error responses from `app/errors.py`:

```python
from app.errors import ErrorCode, not_found, bad_request

# Example: 404 error
raise not_found(ErrorCode.TAG_NOT_FOUND, "Tag not found", tag_id=123)

# Example: 400 error with context
raise bad_request(
    ErrorCode.INVALID_REGEX,
    f"Regex pattern too long (max {MAX_REGEX_LENGTH} characters)",
    max_length=MAX_REGEX_LENGTH,
)
```

Error response structure:
```json
{
  "error_code": "TAG_NOT_FOUND",
  "message": "Optional human-readable message",
  "context": {"tag_id": 123}
}
```

Error codes are defined in `ErrorCode` enum (`TRANSACTION_NOT_FOUND`, `TAG_ALREADY_EXISTS`, `VALIDATION_ERROR`, etc.). Frontend uses `error_code` for i18n translation lookup.

**Frontend (TypeScript/React):**

- Use try/catch for async operations
- Manage error state in contexts: `error: string | null` field, `clearError()` method
- Example in `AuthContext`: `const [error, setError] = useState<string | null>(null)`
- Display backend error codes from API responses for user-facing errors

## Logging

**Backend (Python):**
- Framework: Structured logging with `structlog`
- Pattern: Import from `app.observability` (observability module handles setup)
- Use `logger.error()`, `logger.warning()`, `logger.info()` with structured context
- Avoid `print()` statements; use structured logging

**Frontend (TypeScript):**
- Use `console.log()` for debug output with clear prefixes: `console.log('[AuthContext] Checking auth status, hasToken:', !!token)`
- Never use `console.log()` in production-facing code paths (use observability if needed)

## Comments

**When to Comment:**

Backend:
- File docstrings: Explain module purpose (e.g., `"""Test configuration and fixtures"""`)
- Function docstrings: Describe what function does, parameters, and return value (NumPy/Google style)
- Complex logic: Explain non-obvious regex patterns, validation rules, or business logic
- Example in `validate_regex_pattern()`: Comments explain ReDoS prevention

Frontend:
- Component docstrings: Explain complex state management or layout decisions
- Inline comments: Explain why (not what) for non-obvious code
- Example: Comments in `ThemeSwitcher.tsx` explain hydration mismatch prevention

**JSDoc/TSDoc:**

TypeScript interfaces use JSDoc:
```typescript
interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isInitialized: boolean
  loading: boolean
  error: string | null
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => void
  setup: (credentials: LoginCredentials) => Promise<boolean>
  checkAuth: () => Promise<void>
  clearError: () => void
}
```

Python uses type hints instead (Pydantic models are self-documenting):
```python
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
```

## Function Design

**Size:**
- Keep functions small and focused (single responsibility)
- Backend examples: `hash_password()`, `verify_password()` are single-purpose utilities
- Frontend hooks: `useAuth()` manages auth state, delegating to utility functions like `checkAuth()`, `login()`

**Parameters:**
- Use named parameters for clarity
- Backend: `def create_access_token(user_id: int) -> str:`
- Avoid long parameter lists; use data classes/interfaces instead
- Example: `TransactionCreate` schema collects multiple fields for transaction creation

**Return Values:**
- Always specify return type annotation
- Backend: Async functions return `Awaitable` types or `Optional[T]`
- Frontend: Hooks return typed values, promises, or JSX elements
- Use discriminated unions for success/error returns (via error handling above)

## Module Design

**Exports:**

TypeScript:
- Named exports for utilities: `export function ThemeSwitcher() { ... }`
- Re-export from index files (barrel patterns):
  - `test-ids/index.ts` re-exports all domain IDs: `export const TEST_IDS = { ...COMMON_IDS, ...DASHBOARD_IDS, ... }`
- Context exports: `export const AuthContext`, `export function AuthProvider`, `export function useAuth()`

Python:
- Single responsibility per module (split large services)
- `__init__.py` imports and re-exports common items (`__all__` list)
- Router modules: `router = APIRouter(prefix="/api/v1/...", tags=["..."])`

**Barrel Files:**

Frontend uses barrel exports for organization:
- `src/test-ids/index.ts` combines: `common.ts`, `dashboard.ts`, `transactions.ts`, `import.ts`, `tools.ts`, `budgets.ts`, `admin.ts`, `widgets.ts`, `auth.ts`, `chaos-excluded.ts`
- `src/contexts/` may export all contexts from index (pattern varies by feature)

## Type Safety

**TypeScript (Strict Mode On):**
- `strict: true` in `tsconfig.json`
- All function parameters and return types must be annotated
- Avoid `any` and `as` type assertions unless narrowing is impossible
- Use `satisfies` operator to validate types without assertions
- Example: `theme: ThemeName` with validation, not `theme: any as ThemeName`

**Python (Type Checking):**
- `mypy` for type checking: `uv run mypy app --ignore-missing-imports`
- All function parameters and returns must be type-hinted
- Pydantic models auto-validate at runtime
- Example: `def hash_password(password: str) -> str:` is non-negotiable

## API Response Patterns

**Backend:**

Successful responses:
```python
# Single resource
class TransactionResponse(BaseResponse):
    id: int
    created_at: datetime
    updated_at: datetime
    amount: float
    # ... other fields

# List with pagination
class PaginatedTransactions(BaseModel):
    items: List[TransactionResponse]
    total: int
    cursor: Optional[str]
```

Errors (see Error Handling section above):
```json
{"error_code": "...", "message": "...", "context": {...}}
```

**Frontend:**

Data fetching uses SWR (Stale-While-Revalidate):
```typescript
import useSWR from 'swr'

const { data, error, isLoading } = useSWR('/api/v1/...')
// Handle error using backend error_code
```

---

*Convention analysis: 2026-02-23*
