# Codebase Concerns

**Analysis Date:** 2026-02-23

## Tech Debt

**Broad exception handling in parsers:**
- Issue: Multiple locations use bare `except Exception` blocks that silently swallow errors, making debugging difficult
- Files: `backend/app/routers/import_router.py` (line 925), `backend/app/parsers/formats/custom_csv.py` (lines 836, 883-884)
- Impact: Format detection failures are silently ignored; users see `detected_format=None` with no indication why. Operator errors in CSV parsing are masked
- Fix approach: Log exceptions before passing; create specific exception types for parser failures (e.g., `FormatterDetectionError`); surface meaningful errors to frontend

**Exception handling in initialization:**
- Issue: `backend/app/version.py` (lines 38-39) catches all exceptions during version detection without logging
- Files: `backend/app/version.py`
- Impact: Build/version issues go undetected in logs; operators cannot diagnose startup problems
- Fix approach: Replace with specific exception handling (e.g., catch FileNotFoundError only); add structured logging before pass

**Demo mode test endpoint exposed in non-test environments:**
- Issue: `backend/app/routers/auth.py` (lines 174-204) `/test-reset` endpoint checks ENV variable but still accessible
- Files: `backend/app/routers/auth.py`
- Impact: If ENV is misconfigured or not set, users can reset all users; confirmation parameter is weak protection
- Fix approach: Remove endpoint entirely in production builds (use environment-based route inclusion); or require strong credentials (e.g., hashed passphrase from config)

**Missing input validation on custom CSV configurations:**
- Issue: CustomCsvConfig fields like `merchant_regex`, `date_format`, and numeric constraints lack validation
- Files: `backend/app/parsers/formats/custom_csv.py`
- Impact: Invalid regex patterns cause parsing failures; bad date formats cause silent skipping of rows
- Fix approach: Add Pydantic validators in `CustomCsvConfig` to validate regex patterns on assignment; validate date_format string is valid datetime format; constrain numeric fields (e.g., merchant_max_length ≤ 255)

## Known Bugs

**Over-allocation in split transactions allowed without warning:**
- Symptoms: Users can split a $100 transaction as $60 + $50 (110% allocation), creating accounting inconsistencies
- Files: `backend/app/routers/transactions.py` (lines 618-622 explicitly state this is allowed)
- Trigger: Call PUT `/api/v1/transactions/{id}/splits` with amounts summing > transaction.amount
- Workaround: None. Users must manually correct splits
- Risk: Financial reports may show total allocations > sum of transactions; auditing becomes difficult
- Fix approach: Add validation in `set_transaction_splits` to reject allocations > transaction.amount; or store allocation state (full/partial/over) and adjust reporting logic to handle all cases

**Format detection failure silently returns None:**
- Symptoms: CSV file upload fails to suggest format; user sees blank suggestion, no error message
- Files: `backend/app/routers/import_router.py` (lines 921-926)
- Trigger: detect_format() raises any exception (e.g., malformed CSV headers)
- Workaround: Manually specify format in custom CSV config
- Risk: User has no feedback on why auto-detection failed
- Fix approach: Wrap exception in try-catch that logs and returns specific error code; surface message to frontend

## Security Considerations

**JWT token stored in localStorage (XSS vulnerable):**
- Risk: `frontend/src/contexts/AuthContext.tsx` stores JWT in localStorage. Any XSS vulnerability exposes authentication
- Files: `frontend/src/contexts/AuthContext.tsx` (lines 57, 63, 66)
- Current mitigation: No inline script injection detected; all state managed through React context (CSP would help)
- Recommendations:
  1. Move token to httpOnly cookie (middleware.ts currently tries this at line 64 but localStorage is primary)
  2. Add Content-Security-Policy header to prevent inline scripts
  3. Audit for XSS vectors in all user input (search, regex patterns, notes)

**Regex pattern in transaction filter allows ReDoS attacks:**
- Risk: `backend/app/routers/transactions.py` (line 104-105) validates regex length but not complexity
- Files: `backend/app/routers/transactions.py` (lines 42-53)
- Limit: 200 character max prevents most attacks, but complex patterns like `(a+)+b` still cause backtracking
- Current mitigation: Timeout not enforced on regex compilation; SQLite REGEXP operation blocks entire query
- Recommendations:
  1. Use `re.timeout()` context (Python 3.11+) to hard-limit regex execution
  2. Add test cases for known ReDoS patterns: `(a+)+b`, `(a*)*b`, `(a|a)*b`
  3. Consider regex simplification library or move to safe subset (no backreferences)

**Single-user system has no field-level access control:**
- Risk: One compromised token = full account access. No row-level security
- Files: All routers assume `get_current_user()` = owner of all data
- Impact: If JWT is leaked, attacker can export/delete all transactions
- Current mitigation: Short-lived tokens not enforced; no audit log of API access
- Recommendations:
  1. Add token expiration and refresh token logic
  2. Log all DELETE, PUT operations with timestamp and user
  3. Consider read-only API key option for reports

**Merchant alias regex patterns not validated:**
- Risk: User can create MerchantAlias with malicious regex patterns that cause ReDoS on every import
- Files: `backend/app/routers/import_router.py` (line 94)
- Impact: Slow imports; potential DoS if many complex patterns created
- Current mitigation: None. Aliases stored as plain strings, evaluated with `regex_module.search()`
- Recommendations: Validate regex patterns same as transaction search (length + complexity); rate-limit regex matching in import loop

## Performance Bottlenecks

**N+1 queries in transaction list pagination:**
- Problem: Transactions endpoint uses `lazy="selectin"` for tags which loads all tags in separate SELECT per page
- Files: `backend/app/orm.py` (line 165), `backend/app/routers/transactions.py` (pagination logic)
- Cause: With `lazy="selectin"`, a page of 50 transactions triggers 1 SELECT for transactions + 50 SELECTs for tag batches (SQLAlchemy groups but still significant)
- Current performance: ~200ms for 50 items on SQLite; will degrade with 100k transactions
- Improvement path:
  1. Use explicit `joinedload` in list endpoint for related tags
  2. For large result sets, consider denormalizing bucket_id into transactions table to avoid join
  3. Add query explanation logging to catch future N+1 issues

**Import endpoint loads ALL transactions for duplicate detection:**
- Problem: `backend/app/routers/import_router.py` (line 250) `select(Transaction).where(Transaction.category.isnot(None))` loads entire transaction table into memory
- Files: `backend/app/routers/import_router.py` (lines 250, 508, 657, 1071, 1142)
- Cause: Used for building user_history dict; repeated 5+ times across different import endpoints
- Impact: With 100k transactions, ~15MB memory per import request
- Improvement path:
  1. Create user_history index: table of (merchant_lower, bucket_value) aggregated at import time
  2. Cache user_history in request context, not recompute per endpoint
  3. Query only recent transactions (e.g., last 6 months) for pattern inference

**Regex search on large datasets unindexed:**
- Problem: Transaction search with `search_regex=true` uses `Transaction.description.op("REGEXP")(pattern)` without index support
- Files: `backend/app/routers/transactions.py` (line 113)
- Cause: SQLite REGEXP operator requires full table scan; no partial index available
- Impact: Single regex query on 100k transactions ~2-3 seconds
- Improvement path:
  1. Add tsvector-style full-text index (Postgres feature; not available in SQLite)
  2. Limit regex to recent transactions by default
  3. Document that regex search is slow; recommend non-regex search for large datasets

**CSV parsing with many rows and complex formats slow:**
- Problem: `backend/app/parsers/formats/custom_csv.py` reads entire file into memory; processes rows sequentially with regex/datetime parsing
- Files: `backend/app/parsers/formats/custom_csv.py` (entire module)
- Cause: No streaming; all 100k row CSVs loaded before parsing
- Impact: Large files (>50MB) timeout or cause memory pressure
- Improvement path:
  1. Implement streaming CSV reader (pandas.read_csv with chunksize, or csv.DictReader)
  2. Pre-compile regex patterns once, not per row
  3. Benchmark with typical customer file (e.g., 5 year export = 10k rows)

## Fragile Areas

**Import session transaction tracking:**
- Files: `backend/app/routers/import_router.py` (lines 263-273)
- Why fragile: ImportSession is created but only partially populated; transaction_count/duplicate_count/total_amount set at creation (0) and never updated
- Impact: Reports show 0 imported even if import succeeds; users see wrong statistics
- Safe modification: Audit all import endpoints; ensure they update ImportSession before commit; add tests for count accuracy
- Test coverage: Test coverage in `backend/tests/test_import_comprehensive.py` exists but doesn't verify final ImportSession counts

**Transaction reconciliation status enum handling:**
- Files: `backend/app/orm.py` (ReconciliationStatus enum), multiple routers
- Why fragile: Reconciliation status can be `"unreconciled"`, `"pending"`, `"reconciled"` but no validation of string format in API; frontend sends exact string
- Impact: If frontend sends wrong status value, request fails silently or stores corrupt value
- Safe modification: Add Pydantic validator to normalize status strings; document valid values in OpenAPI schema
- Test coverage: No unit tests for status validation

**Account tag normalization inconsistent:**
- Files: `backend/app/routers/import_router.py` (line 54), `frontend/src/app/(main)/transactions/page.tsx` (state management)
- Why fragile: Account names normalized `account_source.lower().replace(" ", "-")` in backend but frontend may send raw names; double-normalization possible
- Impact: User creates account "My Checking", import normalizes to "my-checking", but if user manually creates tag "my-checking" first, state conflicts
- Safe modification: Define account name normalization standard in shared utils; apply consistently on all paths
- Test coverage: Test ORM model to ensure normalization is idempotent

**Custom CSV config caching by header signature:**
- Files: `backend/app/routers/import_router.py` (lines 993, 1343)
- Why fragile: Header signature computed as hash of column names; two different files with same column order match. If user renames "Date" → "Transaction Date", signature changes but logic identical
- Impact: User uploads same bank export twice (different month), first matches, second doesn't; confusing UX
- Safe modification: Include column positions AND names in signature; or ask user to confirm match before applying
- Test coverage: Test with realistic bank exports (CSV + QFX with different column ordering)

**Frontend state management in large pages:**
- Files: `frontend/src/app/(main)/transactions/page.tsx` (1323 lines, multiple state hooks)
- Why fragile: Single component manages filters, pagination, selection, expanded rows, editing state; 15+ useState calls
- Impact: Prop drilling to children components creates render thrashing; adding new feature requires threading state through 5+ levels
- Safe modification: Extract state logic into custom hook (useTransactionFilters, useTransactionSelection); move child state to context
- Test coverage: `page.test.tsx` exists but covers only basic rendering

**Backend error handling with optional fields:**
- Files: Various routers that handle optional tag values, amounts
- Why fragile: If optional field becomes required for new feature, API doesn't fail explicitly; downstream code assumes None is possible
- Impact: New feature adds required field; old clients pass null; API returns 400 without clear message
- Safe modification: Use explicit type discriminated unions for optional fields (e.g., `SplitItem with amount | SplitItem without amount`)
- Test coverage: No tests for backward compatibility with missing optional fields

## Scaling Limits

**SQLite concurrent write bottleneck:**
- Current capacity: 1 concurrent write (SQLite mutex)
- Limit: File-locking at DB level; if two requests write simultaneously, second blocks/fails
- Scaling path:
  1. Migrate to PostgreSQL (docker compose in dev; AWS RDS in prod)
  2. Connection pooling with sqlalchemy.pool.QueuePool (already configured via async_sessionmaker)
  3. Note: Devcontainer uses SQLite for simplicity; production should use Postgres

**In-memory user history cache during import:**
- Current capacity: ~1000 unique merchants × 50 bytes per entry = 50KB per import
- Limit: If import takes >1 minute, memory not freed; concurrent imports = multiple caches
- Scaling path:
  1. Store user_history in DB (new table: `merchant_history(merchant, bucket_value, frequency)`)
  2. Query on-demand instead of loading all transactions
  3. Add periodic cleanup of stale entries (>6 months old)

**JWT token expiration not enforced:**
- Current capacity: Tokens issued at login never expire
- Limit: Compromised token = permanent access; no way to revoke except delete user
- Scaling path:
  1. Add exp claim to JWT (e.g., 24 hours)
  2. Implement refresh token endpoint to extend session
  3. Add token revocation list (blacklist) for logout

**Report aggregation on unindexed columns:**
- Current capacity: Reports work for <10k transactions
- Limit: Dashboard aggregates by bucket/account without indexes
- Scaling path:
  1. Add index on Transaction(date, account_tag_id, is_transfer)
  2. Add covering index for reports: (date DESC, amount, bucket_tag_id)
  3. Consider materialized view for daily spending by bucket

## Dependencies at Risk

**opentelemetry observability stack (15+ packages):**
- Risk: Multiple minor version dependencies (0.45b0 = pre-release); one CVE in opentelemetry-sdk breaks tracing
- Impact: Error tracking, metrics collection fails silently
- Migration plan:
  1. Pin to stable versions (1.0.0+) once available
  2. Monitor security advisories for opentelemetry-* packages
  3. Consider lighter alternative (Sentry SDK) if overhead becomes issue

**apscheduler for background tasks:**
- Risk: Scheduler runs in main process; if task hangs, blocks all requests
- Impact: Demo reset or backup fails → entire app becomes unresponsive
- Migration plan:
  1. Move scheduler to separate process (e.g., Celery or simple subprocess)
  2. Add timeout enforcement: max 30 seconds per scheduled task
  3. Log all scheduler exceptions; alert on repeated failures

**bcrypt version pinned loosely (>=4.0.0):**
- Risk: Future bcrypt versions may require config changes; password hashing algorithm may change
- Impact: If bcrypt 5.0 introduces breaking changes, hashes become incompatible
- Mitigation: Pin to current stable range (e.g., >=4.0.0,<5.0.0); test bcrypt upgrades before deploying
- Current code: `backend/app/utils/auth.py` uses default bcrypt.hashpw(); OK for current versions

## Missing Critical Features

**No backup/export functionality:**
- Problem: Users cannot export transactions; data loss recovery limited to manual DB backup
- Blocks: User switch to competitor; compliance with data portability requests
- Recommendation: Implement:
  1. CSV export of all transactions (with all tags, custom fields)
  2. Backup endpoint that returns gzipped wallet.db
  3. Import endpoint for previous export (full restore)

**No audit log of user actions:**
- Problem: No trace of who deleted/modified what; single-user but no accountability
- Blocks: Regulatory compliance (if this becomes medical device); debugging data integrity issues
- Recommendation: Create audit_log table; log all CREATE/UPDATE/DELETE with timestamp, old_value, new_value

**No password reset mechanism:**
- Problem: User loses password = locked out; no recovery option
- Blocks: Production deployments where users might forget credentials
- Recommendation: Implement security question or email-based reset (for future multi-user variant)

## Test Coverage Gaps

**Import de-duplication logic:**
- What's not tested: Cross-account duplicate detection; edge cases in content_hash calculation
- Files: `backend/app/routers/import_router.py` (lines 285-315)
- Risk: Users could import same transaction twice in different accounts undetected
- Priority: High — affects data integrity
- Recommendation: Add test cases for:
  - Same transaction imported to two different accounts (should warn, not duplicate)
  - Hash collision (unlikely but untested)
  - Null merchant/description scenarios

**CSV parser with edge cases:**
- What's not tested: Empty fields, malformed dates, thousands separators in different locales
- Files: `backend/app/parsers/formats/custom_csv.py` (entire parsing logic)
- Risk: Silent failures when parsing real-world bank CSVs (commas in descriptions, non-standard dates)
- Priority: High — affects imports
- Recommendation: Create test fixtures with actual bank export formats (Chase, Amex, etc.); test each parser

**Frontend virtualization performance:**
- What's not tested: List rendering with 10k+ transactions; scroll performance; memory leaks
- Files: `frontend/src/components/transactions/VirtualTransactionList.tsx`
- Risk: App becomes unresponsive with large datasets
- Priority: Medium — not blocking for current users
- Recommendation: Add performance tests with generated transaction fixtures (1000, 5000, 10k rows)

**Concurrent import handling:**
- What's not tested: Two imports simultaneous; import while viewing transactions
- Files: Entire import_router.py
- Risk: Race condition between import session and transaction list updates
- Priority: Medium — edge case but possible
- Recommendation: Add test with async imports and concurrent list requests

**Frontend form validation:**
- What's not tested: Login form with XSS payloads, CSV format with injection attempts
- Files: Frontend auth and import forms
- Risk: XSS or injection attacks if validation is bypassable
- Priority: High — security critical
- Recommendation: Add security-focused unit tests for all form inputs

---

*Concerns audit: 2026-02-23*
