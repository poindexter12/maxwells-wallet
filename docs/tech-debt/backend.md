# Backend Architecture & Quality Review

**Date:** 2025-12-05
**Grade:** B+
**Stack:** FastAPI + Python (async) + SQLModel ORM

## Overview

The backend demonstrates solid FastAPI/Python practices with good architecture decisions, but has several important areas for improvement. The codebase is well-organized with clear separation of concerns, comprehensive test coverage, and thoughtful API design.

---

## Top 3 Strengths

### 1. Well-Structured Router Architecture with Proper Dependency Injection

- Clean separation into domain-specific routers (transactions, budgets, tags, etc.)
- Consistent use of `Depends(get_session)` for async SQLAlchemy session management
- Good async patterns throughout with `await session.execute()` and `await session.commit()`
- Files: `/backend/app/main.py` (lines 71-85), all routers follow this pattern

### 2. Thoughtful Domain Modeling and Pydantic Validation

- Well-designed SQLModel base classes with common fields (id, created_at, updated_at)
- Proper Create/Update models for request validation separate from database models
- Comprehensive enum types for domain concepts (ReconciliationStatus, ImportFormatType, DateRangeType, etc.)
- Clean split transaction and budget models with proper constraints
- File: `/backend/app/models.py` (37-564)

### 3. Robust Feature Implementation with Good API Design

- Comprehensive transaction filtering with AND/OR logic for tags and accounts (lines 30-135 in transactions.py)
- Proper pagination with configurable limits (0-500)
- Smart duplicate detection using content hashing instead of naive comparison
- Support for transaction splits with partial allocations
- Dashboard widgets with date range types (MTD, QTD, YTD, rolling windows)
- File: `/backend/app/routers/transactions.py`

---

## Top 3 Concerns

### 1. CRITICAL: Database Echo Flag Enabled in Production

**Severity:** HIGH
**Impact:** Performance & Security

The SQLAlchemy engine has `echo=True` enabled unconditionally, which logs all SQL queries to stdout/logs. This is a debugging flag that should never be production-enabled.

**File:** `/backend/app/database.py:10`

```python
engine = create_async_engine(DATABASE_URL, echo=True)  # SHOULD BE CONDITIONAL
```

**Risk:**
- Performance: Every query is logged, causing I/O overhead
- Security: Sensitive financial data in transaction descriptions may be logged
- Ops: Excessive log noise makes real issues hard to track

**Fix:**
```python
import os
echo = os.getenv("DATABASE_ECHO", "false").lower() == "true"
engine = create_async_engine(DATABASE_URL, echo=echo)
```

---

### 2. ~~Synchronous Deletion in Async Context~~ (FALSE POSITIVE - RESOLVED)

**Status:** NOT AN ISSUE

~~Multiple routers use `await session.delete(obj)` which is not a valid SQLAlchemy async method.~~

**Correction:** Testing confirmed that with SQLAlchemy's `AsyncSession`, the `delete()` method IS async and MUST be awaited. Removing the `await` causes `RuntimeWarning: coroutine 'AsyncSession.delete' was never awaited` and breaks delete functionality. The existing code is correct.

---

### 3. ~~Unvalidated Regex Input in Transaction Search~~ (FIXED)

**Status:** RESOLVED

~~The transaction search endpoint accepts regex patterns but doesn't validate them before passing to the database.~~

**Fix Applied:** Added `validate_regex_pattern()` function in `transactions.py` that:
- Validates regex syntax using `re.compile()` before use
- Enforces max pattern length (200 chars) to prevent ReDoS
- Returns 400 error with descriptive message for invalid patterns
- Added test coverage in `test_advanced_search.py::TestRegexSearchValidation`

---

## Additional Observations

### Input Validation - Moderate Gaps

- Tag rule pattern matching claims to support regex but only does substring matching (lines 25-36 in `/backend/app/routers/tag_rules.py`)
- Merchant alias regex type doesn't handle compilation errors gracefully (lines 31-35 in `/backend/app/routers/merchants.py` has try/catch, which is good, but inconsistent)
- Budget amounts allow negative values (no constraint in `/backend/app/models.py:232`)
- Tag `due_day` accepts 1-31 with no validation for months with fewer days

### Security - CORS Configuration

- **Good:** CORS correctly limited to `http://localhost:3000`
- **Note:** File: `/backend/app/main.py:65` - Safe for single-user local deployment, as documented

### Async Consistency

- All route handlers properly async
- Session management with `async_session` sessionmaker (line 12-14 in database.py)
- No blocking I/O in request paths
- Issue: Some utility functions not async where they should be (e.g., migrations in `init_db()` are synchronous but called from async context)

### N+1 Query Risks

- Most endpoints properly use subqueries instead of loading full relations
- **Good pattern** (transactions.py:110-120): Tag filtering uses subquery instead of joins with loading
- **Potential issue**: Reports endpoints may load transactions then iterate (lines 89-107 in reports.py), but codebase is small enough this isn't critical

### Error Handling

- Comprehensive HTTPException usage (128 occurrences across routers)
- Status codes generally correct (404 for not found, 400 for validation, 201 for creation)
- Minor: Some endpoints return untyped dicts instead of Pydantic models (inconsistent with others)

### Code Quality

- Type hints present on all public functions
- Good documentation strings
- Test suite exists (12+ test files with comprehensive coverage)
- Linting setup in place (ruff, mypy, vulture in pyproject.toml)

---

## Issue Reference Table

| File | Line | Issue | Severity | Status |
|------|------|-------|----------|--------|
| `database.py` | 10 | `echo=True` unconditional | HIGH | FIXED (env-controlled) |
| ~~`transactions.py`~~ | ~~310, 388~~ | ~~`await session.delete()` misuse~~ | ~~MEDIUM~~ | FALSE POSITIVE |
| ~~`transactions.py`~~ | ~~85-93~~ | ~~Unvalidated regex input~~ | ~~MEDIUM~~ | FIXED |
| ~~`import_router.py`~~ | ~~95, 200, etc.~~ | ~~`await session.delete()` misuse~~ | ~~MEDIUM~~ | FALSE POSITIVE |
| ~~`admin.py`~~ | ~~89~~ | ~~`await session.delete()` in loop~~ | ~~MEDIUM~~ | FALSE POSITIVE |
| `merchants.py` | 32 | Regex try/catch only in one place | LOW | Open |
| `tag_rules.py` | 25-36 | Claims regex but only substring match | LOW | Open |
| `models.py` | 232 | Budget amounts not validated | LOW | Open |
| `models.py` | 64 | Tag due_day unconstrained | LOW | Open |

---

## Recommendations

### Immediate (P0)
1. ~~Remove `echo=True` or make it environment-dependent~~ ✅ DONE
2. ~~Fix all `await session.delete()` calls~~ ❌ FALSE POSITIVE (code was correct)
3. ~~Add regex pattern validation before use in search~~ ✅ DONE

### Soon (P1)
1. Add validation constraints to Budget amounts (e.g., `gt=0`)
2. Validate tag due_day (1-31 with month awareness)
3. Standardize error responses (all should use Pydantic models)

### Nice to Have (P2)
1. Consider adding rate limiting for regex search endpoint
2. Add request timeout protection to SQLite REGEXP operations
3. Improve test coverage for edge cases in date range calculations

---

The backend is well-built and production-ready after these fixes. The architecture is sound, patterns are consistent, and the feature set is comprehensive.
