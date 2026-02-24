# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Dashboard Page Component Size:**
- **Files:** `frontend/src/app/page.tsx` (1,168 lines), `frontend/src/app/(main)/transactions/page.tsx` (1,323 lines)
- **Issue:** Pages far exceed recommended size; page.tsx contains 9 inline widget renderers and 18+ state management hooks in a single component
- **Impact:** Difficult to test, debug, maintain; changes to widgets carry risk of unintended side effects; hard to reason about data flow
- **Fix approach:** Extract each widget renderer to dedicated client components (`SummaryWidget.tsx`, `TrendsWidget.tsx`, etc.); this would reduce main page to ~300 lines (80% reduction); benefits: enable component-level testing, improve reusability, clarify state ownership
- **Priority:** High

**Type Safety Gaps in Dashboard Page:**
- **Files:** `frontend/src/app/page.tsx` (lines 48-56), `frontend/src/app/(main)/import/page.tsx`, `frontend/src/app/(main)/transactions/page.tsx`
- **Issue:** Multiple `useState<any>(null)` declarations; widget functions accept `customData?: any`; API response shapes assumed without validation
- **Impact:** TypeScript provides no compile-time safety for widget data access; typos in response properties caught only at runtime; inconsistent error patterns
- **Fix approach:** Define TypeScript interfaces for all API response shapes; create `dashboard-types.ts` module with reusable types; remove all bare `any` type declarations; add response validation layer
- **Priority:** Medium

**Silent Error Handling in Frontend:**
- **Files:** `frontend/src/app/page.tsx` (lines 78-88, 90-100), `frontend/src/app/(main)/import/page.tsx` (lines 78-87), `frontend/src/app/(main)/transactions/page.tsx` (widespread)
- **Issue:** API errors caught and logged to console only; no visible user feedback, retry buttons, or fallback states; users see blank UI when backend unavailable
- **Impact:** Poor UX; users have no indication of failure; no way to recover from temporary network issues
- **Fix approach:** Create error boundary component; replace `console.error()` with toast/alert notifications; add explicit retry buttons for failed API calls; show loading skeletons; validate `res.ok` before parsing JSON
- **Priority:** High

**Limited Input Validation on Budget Amounts:**
- **Files:** `backend/app/orm.py` (line 232), `backend/app/schemas.py`
- **Issue:** Budget amounts allow negative values; no constraint in ORM model
- **Impact:** Data consistency; negative budgets are nonsensical
- **Fix approach:** Add Pydantic constraint `Field(..., gt=0)` to budget amount fields in `schemas.py`; add database check constraint in migration
- **Priority:** Low

**Tag Due Day Validation Unconstrained:**
- **Files:** `backend/app/orm.py` (line 64), `backend/app/routers/tag_rules.py`
- **Issue:** `due_day` field accepts 1-31 with no validation for months with fewer days (e.g., February 30)
- **Impact:** Users can set invalid due dates like "month 2, day 30"
- **Fix approach:** Add validation in `TagRuleCreate` schema to enforce 1-28 range (or add month-aware logic); document the limitation in API docs
- **Priority:** Low

---

## Known Bugs

**Dashboard Tab Switching Crashes:**
- **Symptom:** Tab switching with interleaved user actions causes undefined behavior or crashes
- **Files:** `frontend/e2e/chaos/chaos-dashboard.spec.ts` (line 56); `frontend/e2e/dashboard-tabs.spec.ts`
- **Trigger:** Chaos tests discovered this when performing rapid tab switching with simultaneous other interactions
- **Workaround:** Avoid rapid tab switching during data-heavy operations; chaos test is skipped pending fix
- **Fix approach:** Investigate state management in dashboard context when tabs change; ensure no stale closures over old state; add proper cleanup in useEffect dependencies
- **Priority:** High (found by chaos testing; indicates underlying state bug)

**i18n Translation Coverage Incomplete:**
- **Symptom:** Pseudo-locale testing reveals many UI strings still hardcoded in English
- **Files:** `frontend/e2e/i18n.spec.ts` (line 92); NavBar, pages, many components not translated
- **Trigger:** Test suite skipped because only widget components have i18n support
- **Impact:** Translation keys missing for: NavBar items, page titles, modal buttons, help text
- **Fix approach:** Complete translation pass across all pages and components; enable i18n test suite; add CI check to prevent untranslated strings in future PRs
- **Priority:** Medium (non-blocking for English-only users, but breaks non-English support)

---

## Security Considerations

**CORS Configuration Localhost-Only:**
- **Current state:** CORS allows only `http://localhost:3000` in `backend/app/main.py` (line 96)
- **Mitigation:** Safe for single-user local deployment as documented; appropriate for dev environment
- **Future concern:** When migrating to production (SaaS), CORS allowlist must be updated to production frontend domain; add environment-based configuration
- **Recommendation:** Make CORS origins environment-variable controlled; create `CORS_ORIGINS` config read from env at startup
- **Files:** `backend/app/main.py:94-100`

**SQLite vs Postgres Timezone Handling:**
- **Issue:** Datetime fields in ORM are timezone-naive; SQLite doesn't enforce timezones, but Postgres will fail or produce confusing results
- **Files:** `backend/app/orm.py` (lines 40-44), all models with datetime fields
- **Future concern:** Migration to Postgres will expose incorrect timezone assumptions
- **Recommendation:** Make all datetimes UTC-aware now using `datetime.now(timezone.utc)` and `DateTime(timezone=True)` in SQLAlchemy; add alembic migration to convert existing data
- **Priority:** High (before Postgres migration)

**Regex Pattern Attack Surface:**
- **Current state:** Regex search validation added in `backend/app/routers/transactions.py`; patterns validated for syntax errors and length limits
- **Mitigation:** Validated before use; max 200 chars enforced; invalid patterns return 400 error
- **Residual risk:** SQLite REGEXP operations still potentially slow with complex patterns; no per-query timeout
- **Recommendation:** Consider rate limiting regex search endpoint; monitor slow query logs; add request timeout protection
- **Files:** `backend/app/routers/transactions.py` (lines 85-93)

---

## Performance Bottlenecks

**Dashboard Widget Data Fetching:**
- **Problem:** Main page makes 8+ sequential API calls to populate widgets (summary, trends, anomalies, merchants, etc.)
- **Files:** `frontend/src/app/page.tsx` (lines 78-200)
- **Cause:** No request deduplication or caching; each useEffect fetches independently; no parallel requests
- **Impact:** Dashboard takes 5-8 seconds to fully load on typical connection (sequential 500-1000ms per call)
- **Improvement path:** Implement SWR or React Query for automatic caching/deduplication; parallelize independent requests; add request memoization at `lib/api.ts` layer
- **Priority:** Medium

**Report Endpoints N+1 Query Risk:**
- **Problem:** Reports endpoints may load transactions then iterate to compute aggregates
- **Files:** `backend/app/routers/reports.py` (lines 89-107)
- **Cause:** Subquery optimization exists for most queries but reports layer may load full objects
- **Impact:** Large transaction sets could cause multiple database round-trips
- **Current state:** Small codebase size mitigates this risk; becomes critical if transaction volume grows beyond 10k
- **Improvement path:** Verify all report queries use subqueries or aggregation functions; add database query logging to detect N+1 patterns; add tests with 100k+ transaction seed data
- **Priority:** Low (mitigated by current scale)

**CSV Import Memory Usage:**
- **Problem:** Large CSV files (>50MB) loaded entirely into memory during parsing
- **Files:** `backend/app/routers/import_router.py` (line 1494), `backend/app/parsers/formats/custom_csv.py` (line 1011)
- **Cause:** `UploadFile` buffered in memory; no streaming parser
- **Impact:** Server can run out of memory or timeout on large files
- **Improvement path:** Implement streaming CSV parser using generators; process file in chunks; add file size limit validation (e.g., 100MB max)
- **Priority:** Low (typical users have <10MB files; becomes issue at scale)

---

## Fragile Areas

**Dashboard State Management with Multiple Widgets:**
- **Files:** `frontend/src/app/page.tsx` (lines 48-400), `frontend/src/contexts/DashboardContext.tsx`
- **Why fragile:** 18+ state hooks with complex interdependencies; date range changes trigger cascading refetches; widget show/hide state managed globally but rendered locally
- **Safe modification:** Before changing dashboard state flow, add comprehensive tests for: date range changes, widget toggles, data sorting changes; ensure changes don't break other widgets
- **Test coverage:** No unit tests for dashboard component; only E2E tests exist which are slow to iterate
- **Risk:** Refactoring dashboard state management could inadvertently break widgets due to hidden dependencies
- **Recommendation:** Extract each widget to component with local state first; then refactor shared state layer incrementally

**Custom CSV Format Detection:**
- **Files:** `backend/app/parsers/formats/custom_csv.py` (line 1011), `backend/app/csv_parser.py`
- **Why fragile:** Format detection relies on header signature matching and heuristics; edge cases like renamed columns break detection
- **Safe modification:** Test with real-world CSV formats before deploying; add logging to track detection failures; keep a catalog of known format signatures
- **Test coverage:** Good coverage for BoA, Amex, Venmo formats; custom format tests exist but edge cases may not be caught
- **Risk:** Users get silently incorrect imports if CSV format changes slightly

**Import Session State During Processing:**
- **Files:** `backend/app/routers/import_router.py` (lines 500-700), `backend/app/orm.py` (BatchImportSession)
- **Why fragile:** Import sessions have complex state (pending, in_progress, completed, failed); transitions must be atomic; database state must match session state
- **Safe modification:** Add transactional guards; ensure all state transitions are idempotent; test concurrent import scenarios
- **Test coverage:** Comprehensive tests exist for happy path; edge cases like network interruption mid-import may not be tested
- **Risk:** Data corruption if session state and database transactions get out of sync

---

## Scaling Limits

**SQLite Single-Connection Bottleneck:**
- **Current capacity:** SQLite suitable for single-user or small concurrent usage (~5-10 concurrent connections max)
- **Limit:** SQLite uses write-locking; high concurrency causes lock contention and timeouts
- **Scaling path:** Migrate to Postgres when deploying multi-user version; requires: timezone-aware datetime conversion, FK constraint validation, connection pooling setup
- **Files:** `backend/app/database.py` (line 7), `alembic/` migrations
- **Estimated timeline:** Not urgent for current single-user deployment; plan migration when adding multi-user auth

**Transaction Table Growth:**
- **Current capacity:** 100k+ transactions queryable efficiently with indexes; dashboard queries respond in <1s
- **Limit:** At 1M+ transactions, dashboard summary queries may timeout (no partitioning or materialized views)
- **Scaling path:** Add date-based partitioning to transactions table; add materialized views for monthly/yearly aggregates; implement incremental recalculation
- **Priority:** Low (typical personal finance users have <50k transactions)

**Dashboard Concurrent Widget Requests:**
- **Current capacity:** Main page handles ~8 concurrent API requests fine in dev/staging
- **Limit:** Under heavy load (10k+ RPS), dashboard endpoint latency degrades; no rate limiting configured
- **Scaling path:** Add rate limiting (e.g., 100 requests per minute per user); implement caching layer; consider async job queue for expensive aggregations
- **Priority:** Low (single-user local deployment)

---

## Dependencies at Risk

**Next.js App Router Edge Cases:**
- **Risk:** App Router (Next.js 13+) relatively new; edge cases in dynamic routes, data fetching patterns discovered periodically
- **Current state:** Using standard patterns (getSearchParams in Suspense boundaries, proper use client directives)
- **Mitigation:** Keep Next.js updated; monitor release notes for bug fixes; test after version bumps
- **Files:** All `app/` directory structure

**SQLAlchemy 2.0 Async API Evolution:**
- **Risk:** SQLAlchemy 2.0 async support still stabilizing; patterns may change in minor versions
- **Current state:** Using established patterns (AsyncSession, async_sessionmaker, proper await patterns)
- **Mitigation:** Version pinned in `pyproject.toml`; test async patterns in staging before production
- **Files:** `backend/app/database.py`, all router files

---

## Missing Critical Features

**No Offline Support:**
- **Problem:** No offline-first capability; all features require backend connection
- **Blocks:** Cannot use app during network outages; progress is lost if connection drops mid-import
- **Impact:** Low for dev; moderate for production SaaS (users expect offline work capability)
- **Implementation path:** Add service worker cache layer; implement local-first sync with backend; use CRDT or last-write-wins for conflict resolution
- **Priority:** Low (nice-to-have for future versions)

**No Audit Trail / Transaction History:**
- **Problem:** No record of who edited transactions or when; deletions are permanent and unlogged
- **Blocks:** Cannot track data changes; cannot support undo/redo
- **Impact:** Low for current single-user app; critical for multi-user or regulated environments
- **Implementation path:** Add audit log table; soft-delete pattern with update tracking; implement transaction versioning
- **Priority:** Low

---

## Test Coverage Gaps

**Frontend Components Untested:**
- **What's not tested:** Transaction page, Dashboard main page, Import workflow UI, Budgets page, Tag management UI, all complex interactions
- **Files:** `frontend/src/app/(main)/transactions/page.tsx`, `frontend/src/app/page.tsx`, `frontend/src/app/(main)/import/page.tsx`, etc.
- **Risk:** UI bugs, broken layouts, form submission failures ship without detection; regressions introduced by refactoring undetected
- **Coverage:** Estimated 5-10% of critical paths; only 2 simple component tests exist
- **Priority:** High (could prevent regressions during dashboard extraction project)

**Edge Cases in Date Range Calculations:**
- **What's not tested:** Leap years, DST transitions, month boundaries in date range calculations
- **Files:** `backend/app/routers/reports.py`, `backend/app/routers/dashboards.py` (date range logic)
- **Risk:** Reports and dashboards show incorrect data around DST transitions or leap years
- **Workaround:** Test manually on Feb 29 and March 11 (DST spring forward)
- **Priority:** Low (manifests only on specific dates)

**Concurrent Import Handling:**
- **What's not tested:** Multiple import sessions running simultaneously; database state consistency under concurrent imports
- **Files:** `backend/app/routers/import_router.py`, `backend/app/orm.py` (BatchImportSession)
- **Risk:** Data corruption if two imports execute concurrently with overlapping transactions
- **Current protection:** Single-user assumption; SQLite write-locking prevents concurrent writes; Postgres would need explicit transaction isolation
- **Priority:** Low (single-user app) → High (when migrating to multi-user Postgres)

---

## Observability Gaps

**Limited Production Monitoring:**
- **Current state:** OpenTelemetry setup exists for tracing/metrics; no alerting configured
- **Gap:** Errors in production have no automatic notification; slow queries not tracked
- **Recommendation:** Add OpenTelemetry exporter to observability platform (e.g., Honeycomb, DataDog); set up alerts for error rate spikes
- **Files:** `backend/app/observability/config.py`

**No User-Facing Error Context:**
- **Current state:** Errors logged to backend; frontend shows generic "error occurred" messages
- **Gap:** Cannot easily troubleshoot user-reported issues without asking them for specific steps
- **Recommendation:** Add structured error logging with correlation IDs; send error context to frontend for debugging; implement sentry-like error tracking
- **Priority:** Low (for single-user local app)

---

## Summary Risk Matrix

| Area | Issue | Severity | Impact | Status |
|------|-------|----------|--------|--------|
| Frontend | Dashboard page 1,168 lines | High | Maintainability | Open |
| Frontend | No unit tests for main pages | High | Regression risk | Open |
| Frontend | Silent API error handling | High | UX degradation | Open |
| Frontend | Dashboard tab switching crashes | High | Functional bug | Open |
| Backend | Type safety gaps in page.tsx | Medium | Runtime errors | Open |
| Backend | i18n coverage incomplete | Medium | Non-English support broken | Open |
| Backend | Budget amount validation missing | Low | Data consistency | Open |
| Backend | Tag due_day validation missing | Low | Data consistency | Open |
| Database | Timezone-naive datetimes | High | Postgres migration blocker | Open |
| Database | N+1 query risks in reports | Medium | Performance at scale | Open |
| Infra | SQLite single-connection limit | Medium | Scaling blocker | Open |

---

*Concerns audit: 2026-02-24*
