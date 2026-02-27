---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements: []

must_haves:
  truths:
    - "Zero occurrences of datetime.utcnow() remain in the backend codebase"
    - "All backend tests pass without deprecation warnings for utcnow"
  artifacts:
    - path: "backend/app/routers/*.py"
      provides: "Timezone-aware UTC datetime usage"
      contains: "datetime.now(UTC)"
  key_links: []
---

<objective>
Replace all `datetime.utcnow()` calls with `datetime.now(UTC)` across the backend codebase.

Purpose: Eliminate Python 3.12+ deprecation warnings (636 per test run) and use timezone-aware datetimes.
Output: All 37 remaining occurrences fixed across 15 files. Todo moved to done/.
</objective>

<execution_context>
@/Users/joe/.claude/get-shit-done/workflows/execute-plan.md
@/Users/joe/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/todos/pending/2026-02-27-replace-datetime-utcnow-with-timezone-aware-utc.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace datetime.utcnow() in all router files</name>
  <files>
    backend/app/routers/filters.py
    backend/app/routers/tags.py
    backend/app/routers/transfers.py
    backend/app/routers/recurring.py
    backend/app/routers/budgets.py
    backend/app/routers/dashboards.py
    backend/app/routers/dashboard.py
    backend/app/routers/tag_rules.py
    backend/app/routers/transactions.py
    backend/app/routers/merchants.py
    backend/app/routers/import_router.py
    backend/app/routers/settings.py
    backend/app/routers/admin.py
  </files>
  <action>
For each of the 13 router files listed:

1. Replace every `datetime.utcnow()` with `datetime.now(UTC)`
2. Ensure the file's datetime import includes `UTC`: change `from datetime import datetime` to `from datetime import UTC, datetime` (alphabetical)
3. Special case — `backend/app/routers/settings.py` line 134 uses `__import__("datetime").datetime.utcnow()`. Replace with `datetime.now(UTC)` and add the proper `from datetime import UTC, datetime` import at the top if not already present.

Do NOT touch `backend/app/utils/auth.py` — it was already fixed in commit dfd5995.

Occurrence counts per file (verify all are caught):
- filters.py: 3 (lines 158, 195, 253)
- tags.py: 2 (lines 94, 150)
- transfers.py: 5 (lines 137, 179, 180, 213, 217)
- recurring.py: 1 (line 87)
- budgets.py: 2 (lines 93, 165)
- dashboards.py: 4 (lines 228, 276, 384, 409)
- dashboard.py: 3 (lines 109, 148, 195)
- tag_rules.py: 3 (lines 149, 297, 354)
- transactions.py: 2 (lines 407, 440)
- merchants.py: 2 (lines 126, 195)
- import_router.py: 5 (lines 129, 401, 831, 1282, 1410)
- settings.py: 1 (line 134)
- admin.py: 1 (line 84)
  </action>
  <verify>
    <automated>cd /Users/joe/Code/github.com/poindexter12/maxwells-wallet && grep -r "datetime\.utcnow()" backend/app/routers/ | wc -l | tr -d ' ' | grep -q '^0$' && echo "PASS: zero utcnow in routers" || echo "FAIL: utcnow still present"</automated>
  </verify>
  <done>All 33 occurrences in router files replaced. Each file imports UTC from datetime. Zero grep hits for utcnow in backend/app/routers/.</done>
</task>

<task type="auto">
  <name>Task 2: Replace datetime.utcnow() in scripts and migrations, run tests</name>
  <files>
    backend/scripts/seed.py
    backend/alembic/versions/b3c4d5e6f7g8_add_app_settings_table.py
    backend/alembic/versions/a1b2c3d4e5f6_add_tags_system.py
    backend/alembic/versions/5a841ee04972_add_dashboards_table.py
  </files>
  <action>
1. In each of the 3 alembic migration files and seed.py:
   - Replace `datetime.utcnow()` with `datetime.now(UTC)`
   - Add `UTC` to the datetime import (e.g., `from datetime import datetime, UTC`)

Occurrence counts:
- seed.py: 1 (line 455)
- b3c4d5e6f7g8_add_app_settings_table.py: 1 (line 36)
- a1b2c3d4e5f6_add_tags_system.py: 1 (line 49)
- 5a841ee04972_add_dashboards_table.py: 1 (line 51)

2. Run the full backend test suite to confirm no regressions and verify the utcnow deprecation warnings are gone.

3. Move the todo file:
   - Move `backend/app/routers/` references are done, migrations are done
   - `mv .planning/todos/pending/2026-02-27-replace-datetime-utcnow-with-timezone-aware-utc.md .planning/todos/done/`
  </action>
  <verify>
    <automated>cd /Users/joe/Code/github.com/poindexter12/maxwells-wallet && grep -r "datetime\.utcnow()" backend/ | wc -l | tr -d ' ' | grep -q '^0$' && echo "PASS: zero utcnow in entire backend" || echo "FAIL: utcnow still present"</automated>
  </verify>
  <done>All 37 occurrences across the entire backend are replaced. Backend tests pass. Todo moved to done/.</done>
</task>

</tasks>

<verification>
1. `grep -r "datetime.utcnow()" backend/` returns zero results
2. `grep -r "from datetime import.*UTC" backend/app/routers/` confirms UTC import present in all modified router files
3. `just test::backend` passes with no utcnow deprecation warnings
</verification>

<success_criteria>
- Zero occurrences of `datetime.utcnow()` in the entire backend directory
- All backend tests pass
- Todo file moved from pending/ to done/
</success_criteria>

<output>
After completion, create `.planning/quick/3-replace-datetime-utcnow-with-timezone-aw/3-SUMMARY.md`
</output>
