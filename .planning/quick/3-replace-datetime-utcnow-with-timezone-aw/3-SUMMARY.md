---
phase: quick-3
plan: 01
subsystem: backend
tags: [python, deprecation, datetime, timezone]
dependency_graph:
  requires: []
  provides:
    - Timezone-aware UTC datetime usage across backend
  affects:
    - backend/app/routers/*.py (13 files)
    - backend/scripts/seed.py
    - backend/alembic/versions/*.py (3 files)
tech_stack:
  added: []
  patterns:
    - datetime.now(UTC) for timezone-aware datetimes
key_files:
  created: []
  modified:
    - backend/app/routers/filters.py
    - backend/app/routers/tags.py
    - backend/app/routers/transfers.py
    - backend/app/routers/recurring.py
    - backend/app/routers/budgets.py
    - backend/app/routers/dashboards.py
    - backend/app/routers/dashboard.py
    - backend/app/routers/tag_rules.py
    - backend/app/routers/transactions.py
    - backend/app/routers/merchants.py
    - backend/app/routers/import_router.py
    - backend/app/routers/settings.py
    - backend/app/routers/admin.py
    - backend/scripts/seed.py
    - backend/alembic/versions/b3c4d5e6f7g8_add_app_settings_table.py
    - backend/alembic/versions/a1b2c3d4e5f6_add_tags_system.py
    - backend/alembic/versions/5a841ee04972_add_dashboards_table.py
decisions: []
metrics:
  duration: 24 minutes
  tasks_completed: 2
  files_modified: 17
  commits: 2
  tests_passed: 1157
  completed_at: "2026-02-27T20:04:22Z"
---

# Quick Task 3: Replace datetime.utcnow() with timezone-aware UTC

**One-liner:** Replaced all 37 occurrences of deprecated `datetime.utcnow()` with `datetime.now(UTC)` across backend routers, scripts, and migrations.

## Objective

Replace all `datetime.utcnow()` calls with `datetime.now(UTC)` across the backend codebase to eliminate Python 3.12+ deprecation warnings (636 per test run) and use timezone-aware datetimes.

## Tasks Completed

### Task 1: Replace datetime.utcnow() in all router files
- **Commit:** 4aa63ef
- **Files modified:** 13 router files
- **Changes:**
  - Replaced 33 occurrences of `datetime.utcnow()` with `datetime.now(UTC)`
  - Updated imports to include UTC: `from datetime import UTC, datetime`
  - Special case in `settings.py`: replaced `__import__("datetime").datetime.utcnow()` with proper import
- **Verification:** ✅ Zero grep hits for `datetime.utcnow()` in `backend/app/routers/`

### Task 2: Replace datetime.utcnow() in scripts and migrations
- **Commit:** 9d6af4c
- **Files modified:** 4 files (seed.py + 3 migrations)
- **Changes:**
  - Replaced 4 occurrences in seed.py and migration files
  - Added UTC to datetime imports in all files
  - Moved todo from pending/ to done/
- **Tests:** ✅ All 1157 backend tests pass
- **Verification:** ✅ Zero grep hits for `datetime.utcnow()` in entire `backend/` directory

## Verification Results

1. ✅ `grep -r "datetime.utcnow()" backend/` returns zero results
2. ✅ All modified files import UTC: `from datetime import UTC, datetime` (alphabetically ordered)
3. ✅ `just test::backend` passes with 1157 tests (zero utcnow warnings)
4. ✅ Todo file moved from pending/ to done/

## Success Criteria Met

- ✅ Zero occurrences of `datetime.utcnow()` in the entire backend directory
- ✅ All backend tests pass (1157 passed, 432 warnings about sqlite3 datetime adapter - unrelated)
- ✅ Todo file moved from pending/ to done/

## Deviations from Plan

None - plan executed exactly as written.

## Impact

- **Before:** 636 deprecation warnings per test run
- **After:** Zero utcnow deprecation warnings
- **Migration path:** All datetimes now use timezone-aware UTC
- **Backward compatibility:** No breaking changes - same timezone (UTC), just explicit

## Files Modified

**Routers (13):**
- filters.py (3 replacements)
- tags.py (2 replacements)
- transfers.py (5 replacements)
- recurring.py (1 replacement)
- budgets.py (2 replacements)
- dashboards.py (4 replacements)
- dashboard.py (3 replacements)
- tag_rules.py (3 replacements)
- transactions.py (2 replacements)
- merchants.py (2 replacements)
- import_router.py (5 replacements)
- settings.py (1 replacement - special case)
- admin.py (1 replacement)

**Scripts & Migrations (4):**
- seed.py (1 replacement)
- b3c4d5e6f7g8_add_app_settings_table.py (1 replacement)
- a1b2c3d4e5f6_add_tags_system.py (1 replacement)
- 5a841ee04972_add_dashboards_table.py (1 replacement)

## Self-Check: PASSED

**Files verified:**
- ✅ All 17 modified files exist
- ✅ All files contain `datetime.now(UTC)` pattern
- ✅ All files have UTC in datetime import

**Commits verified:**
- ✅ Commit 4aa63ef exists
- ✅ Commit 9d6af4c exists

**Tests verified:**
- ✅ 1157 tests pass
- ✅ Zero utcnow deprecation warnings
