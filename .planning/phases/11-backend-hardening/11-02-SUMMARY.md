---
phase: 11-backend-hardening
plan: 02
subsystem: backend-validation-cors
tags: [validation, pydantic, database, constraints, cors, configuration]
dependency_graph:
  requires: []
  provides: [budget-validation, tag-validation, configurable-cors]
  affects: [budgets, tags, cors-middleware, app-config]
tech_stack:
  added: []
  patterns: [dual-layer-validation, pydantic-field-constraints, db-check-constraints, env-based-config]
key_files:
  created:
    - backend/alembic/versions/1e79b0957e91_add_validation_check_constraints_for_.py
  modified:
    - backend/app/schemas.py
    - backend/app/orm.py
    - backend/app/config.py
    - backend/app/main.py
    - backend/tests/test_budgets.py
key_decisions:
  - decision: Dual-layer validation (Pydantic + DB constraints)
    rationale: Pydantic catches invalid requests early; DB constraints prevent bad data even if bypassing API
    alternatives: [Pydantic-only (rejected - no DB-level protection), DB-only (rejected - poor API error messages)]
  - decision: Use batch operations for SQLite constraint migration
    rationale: SQLite doesn't support ALTER TABLE ADD CONSTRAINT; batch ops recreate tables with constraints
    alternatives: [Skip migration (rejected - leaves existing DBs unprotected)]
  - decision: Add cors_origins_list property to AppSettings
    rationale: Keeps config parsing logic in settings class; returns List[str] for CORSMiddleware
    alternatives: [Parse in main.py (rejected - duplicates config logic)]
  - decision: Rename settings import to app_settings to avoid conflict
    rationale: main.py already imports settings router; app_settings clarifies config vs router
    alternatives: [Rename router (rejected - larger refactor), Use qualified imports (rejected - less readable)]
  - decision: Update budget tests to expect validation errors for zero/negative amounts
    rationale: Requirements specify positive amounts; tests should validate constraints work
    alternatives: [Keep old tests (rejected - contradicts requirements)]
patterns_established:
  - Field-level validation with Pydantic Field(gt=0) and Field(ge=1, le=28)
  - Database check constraints as backup validation layer
  - Environment-based CORS configuration via pydantic-settings
  - Batch operations for SQLite constraint migrations
requirements_completed: [BACK-03, BACK-04, BACK-05]
duration: 4
completed: 2026-02-26T18:54:32Z
---

# Phase 11 Plan 02: Validation Constraints + CORS Config Summary

**One-liner:** Dual-layer validation (Pydantic + DB) for Budget.amount and Tag.due_day with configurable CORS origins via environment variables.

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-26T18:50:18Z
- **Completed:** 2026-02-26T18:54:32Z
- **Tasks completed:** 2/2
- **Files modified:** 5

## Accomplishments

### Task Commits

1. **feat(11-02): add Pydantic validation constraints for Budget and Tag** (eb4d83e)
   - Added Field(gt=0) to BudgetCreate.amount and BudgetUpdate.amount
   - Added Field(None, ge=1, le=28) to TagCreate.due_day and TagUpdate.due_day
   - Imported Field from pydantic in schemas.py

2. **feat(11-02): add database check constraints and configurable CORS** (3762f2b)
   - Added CheckConstraint to Budget model (amount > 0)
   - Added CheckConstraint to Tag model (due_day NULL or 1-28)
   - Created Alembic migration with batch operations for SQLite
   - Added cors_origins setting to AppSettings with cors_origins_list property
   - Updated main.py to use app_settings.cors_origins_list for CORS
   - Fixed tests to expect validation errors for zero/negative budgets

### Files Created

- `backend/alembic/versions/1e79b0957e91_add_validation_check_constraints_for_.py` - Migration adding check constraints

### Files Modified

- `backend/app/schemas.py` - Pydantic Field constraints for Budget and Tag
- `backend/app/orm.py` - Database check constraints for Budget and Tag
- `backend/app/config.py` - CORS origins configuration
- `backend/app/main.py` - Use configurable CORS origins
- `backend/tests/test_budgets.py` - Updated tests to expect validation errors

## Decisions Made

1. **Dual-layer validation (Pydantic + DB)**
   - Pydantic catches invalid requests with clear error messages
   - Database constraints protect against bad data even if API is bypassed

2. **Batch operations for SQLite constraints**
   - SQLite doesn't support ALTER TABLE ADD CONSTRAINT
   - Batch operations recreate tables with constraints

3. **CORS configuration via environment variable**
   - CORS_ORIGINS env var (comma-separated) parsed into List[str]
   - Default: http://localhost:3000
   - Example: CORS_ORIGINS="http://localhost:3000,http://localhost:3001"

4. **Import naming: app_settings to avoid conflict**
   - main.py already imports settings router
   - Renamed config import to app_settings for clarity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SQLite migration error (NotImplementedError)**
- **Found during:** Task 2 - Alembic migration test
- **Issue:** SQLite doesn't support ALTER TABLE ADD CONSTRAINT; direct op.create_check_constraint() failed
- **Fix:** Used batch_alter_table context manager for SQLite compatibility
- **Files modified:** backend/alembic/versions/1e79b0957e91_add_validation_check_constraints_for_.py
- **Commit:** Included in 3762f2b

**2. [Rule 1 - Bug] Fixed test expectations for budget validation**
- **Found during:** Task 2 - Test run
- **Issue:** Tests expected zero/negative budgets to be accepted; contradicts requirements (BACK-03)
- **Fix:** Updated test_zero_budget and test_negative_budget to expect 422 validation errors
- **Files modified:** backend/tests/test_budgets.py
- **Commit:** Included in 3762f2b

**3. [Rule 1 - Bug] Fixed settings import naming conflict**
- **Found during:** Task 2 - Test run
- **Issue:** main.py imports both config.settings and settings router; AttributeError on settings.router
- **Fix:** Renamed config import to app_settings
- **Files modified:** backend/app/main.py
- **Commit:** Included in 3762f2b

## Issues Encountered

None - all issues auto-fixed per deviation rules.

## Next Phase Readiness

**Phase 11 Complete:** All backend hardening requirements satisfied.
- All datetime columns are timezone-aware UTC (BACK-01, BACK-02)
- Budget amount validation enforced (BACK-03)
- Tag due_day validation enforced (BACK-04)
- CORS origins configurable (BACK-05)
- All tests pass (1153/1153)

## Requirements Satisfied

- ✅ **BACK-03:** Budget amount validated via Pydantic Field(gt=0) and DB CheckConstraint
- ✅ **BACK-04:** Tag due_day validated via Pydantic Field(ge=1, le=28) and DB CheckConstraint
- ✅ **BACK-05:** CORS origins configurable via CORS_ORIGINS environment variable

## Self-Check: PASSED

Files created:
```bash
✓ backend/alembic/versions/1e79b0957e91_add_validation_check_constraints_for_.py
```

Commits verified:
```bash
✓ eb4d83e: feat(11-02): add Pydantic validation constraints for Budget and Tag
✓ 3762f2b: feat(11-02): add database check constraints and configurable CORS
```

All backend tests pass: 1153/1153 ✓
