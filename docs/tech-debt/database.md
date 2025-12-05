# Database Schema & Migrations Review

**Date:** 2025-12-05
**Grade:** B+
**Stack:** SQLModel ORM, SQLite (dev), Postgres (prod target), Alembic migrations

## Overview

The database layer demonstrates solid fundamentals with thoughtful schema design and comprehensive migrations, but has several production-readiness gaps, particularly around Postgres migration safety and data consistency.

---

## Top 3 Strengths

### 1. Well-Designed Tag System with Namespacing

**Location:** `/backend/app/models.py`, lines 43-71

- Flexible multi-namespace tag model (bucket, occasion, merchant, account) replacing brittle category strings
- Composite unique constraint on (namespace, value) enforced at migration level
- Split transaction support via junction table with optional amounts (models.py, lines 43-49)
- Excellent backward compatibility during category→tag migration

```python
class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    namespace: TagNamespace  # bucket, occasion, merchant, account
    value: str
    # Unique constraint on (namespace, value)
```

### 2. Thoughtful Migration Strategy with Reversibility

**Location:** `/backend/alembic/versions/`

- 25 well-documented migrations with clear upgrade/downgrade paths
- Intelligent backfill patterns (e.g., 4a20f1655011_backfill_account_tag_id.py creates tags if missing, then links transactions)
- Content hash migration includes smart normalization logic with parameterized queries
- Proper junction table setup with CASCADE deletes

### 3. Clean Async Data Access Patterns

**Location:** `/backend/app/routers/transactions.py`, lines 30-135

- Parameterized queries throughout (no SQL injection risk)
- Reusable filter builder pattern supporting complex AND/OR logic
- Proper limit/offset pagination
- Prepared for Postgres with ILIKE and REGEXP operators

---

## Top 3 Risks (Postgres Migration Blocking)

### 1. CRITICAL: Missing Foreign Key Constraints on Critical Paths

**Location:** `/backend/alembic/versions/36d3a72a4e57_add_account_tag_id_to_transactions.py`, lines 20-24

**Issue:** Account tag FK is added as a column + index only, with FK "enforced at ORM level" per comment. In early migration 6ce6205b5a58 (line 40), FK creation is explicitly skipped with comment "SQLite doesn't enforce foreign keys by default."

```python
# Migration 36d3a72a4e57 (line 24):
# FK constraint enforced at ORM level for SQLite; real FK would be added for Postgres
```

**Postgres Impact:**
- The Transaction.account_tag_id column references Tag.id but no actual FK constraint exists in the schema
- Orphaned accounts are possible if a tag is deleted without ORM intervention
- Postgres doesn't use ORM-level enforcement—only database-level constraints matter
- `linked_transaction_id` self-reference also missing FK (models.py, line 112)

**Remediation:**
```sql
-- For account_tag_id
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_account_tag_id
FOREIGN KEY (account_tag_id)
REFERENCES tags(id) ON DELETE SET NULL;

-- For linked_transaction_id
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_linked_transaction_id
FOREIGN KEY (linked_transaction_id)
REFERENCES transactions(id) ON DELETE SET NULL;
```

For zero-downtime: add constraint with `NOT VALID` then validate separately, OR add during maintenance window.

---

### 2. Data Consistency Risk: Nullable Foreign Keys Without Validation

**Location:** `/backend/app/models.py`, lines 99, 108, 112

**Issue:** Multiple FK columns are nullable with no NOT NULL enforcement or application-level constraints:

```python
account_tag_id: Optional[int] = Field(default=None, foreign_key="tags.id", index=True)
import_session_id: Optional[int] = Field(default=None, foreign_key="import_sessions.id", index=True)
linked_transaction_id: Optional[int] = Field(default=None, foreign_key="transactions.id", index=True)
```

**Risk in Production:**
- Transactions can exist without account classification (account_tag_id is nullable)
- If account_tag_id is NULL, queries filtering by account return incomplete results
- Linked transfer pairs may be asymmetric (one has linked_transaction_id, other doesn't)
- Silent data loss if users assume "empty = untagged" but receive NULL

**Postgres-Specific:** Postgres will enforce NOT NULL constraints strictly—SQLite is lenient.

**Remediation:**
- Review business logic: Should account_tag_id be NOT NULL (or default to a "none" tag)?
- Add application-level validation in routers (check for required FKs before commit)
- Consider: migrate all NULL account_tag_ids to a default "unclassified" account tag

---

### 3. Incomplete Migration Chain for Postgres Readiness

**Location:** Multiple migrations with SQLite-specific workarounds

**Issues:**

a) **Foreign key constraint gaps** (6ce6205b5a58, lines 40):
```python
# SQLite doesn't enforce foreign keys by default, skip explicit FK creation
```
This comment appears in an OLD migration. Later migrations DO create FKs properly, but inconsistently.

b) **account_tag_id FK never explicitly created** (36d3a72a4e57):
```python
op.add_column('transactions', sa.Column('account_tag_id', sa.Integer(), nullable=True))
# FK never created—only index added
```

c) **Datetime handling uses `datetime.utcnow()` without timezone** (models.py, lines 40-41):
```python
created_at: datetime = Field(default_factory=datetime.utcnow)
updated_at: datetime = Field(default_factory=datetime.utcnow)
```

**Postgres-specific:**
- SQLite: naive datetimes work fine
- Postgres: naive datetimes stored as timestamp without timezone can cause confusion with timezone-aware columns elsewhere
- Recommendation: Use `datetime.now(timezone.utc)` or Postgres `timestamptz`

**Remediation:**
- Create a migration adding explicit FK constraints for account_tag_id, linked_transaction_id, import_session_id
- Update all datetime fields to use timezone-aware UTC
- Validate migration safety with EXPLAIN plans on Postgres staging

---

## Secondary Issues (Non-Blocking)

### Eager Loading Strategy Absent

**Location:** `/backend/app/routers/transactions.py`, line 233

```python
transactions = result.scalars().all()
return transactions
```

- No explicit eager loading of related tags/account_tag via `selectinload()` or `joinedload()`
- When Transaction.tags is accessed in response serialization, SQLAlchemy will fetch tags lazily (one query per transaction)

**Impact:** List endpoint with 100 transactions = 100+ additional queries (N+1 problem)

**Fix:** Add `.options(selectinload(Transaction.tags), selectinload(Transaction.account_tag))` to queries returning multiple transactions

### No Indexes on Frequently Joined Columns

**Location:** `/backend/app/models.py`, lines 47-48

```python
transaction_id: int = Field(foreign_key="transactions.id", primary_key=True)
tag_id: int = Field(foreign_key="tags.id", primary_key=True)
```

- TransactionTag has composite PK but no index on tag_id alone
- Queries filtering by tag_id without transaction_id may table-scan in larger datasets

**Fix:** Add single index on tag_id for queries like "find all transactions with tag X"

### Envelope/Wrapper Response Models Missing

**Location:** `/backend/app/routers/transactions.py`, lines 180-234

- Transaction list endpoint returns raw `List[Transaction]` with no metadata (total_count, page_info)
- Count endpoint exists separately (line 138), forcing clients to make 2 calls

**Fix:** Wrap list responses in `{"data": [...], "total": N, "page": M}`

---

## Schema Design Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Normalization** | A | Tags table well-normalized; transaction_tags junction table proper M:M |
| **Naming** | A- | Clear conventions (id, created_at, updated_at, namespace:value); only caveat: `account_tag_id` is implied FK |
| **Constraints** | C+ | PK/UK in place; FK constraints incomplete/inconsistent (see Risk #1) |
| **Indexes** | B | Good coverage on filters (date, merchant, amount, status); missing composite/covering indexes |
| **NULL Safety** | C | Too many nullable FKs (account_tag_id, import_session_id); no NOT NULL constraints |

---

## Issue Reference Table

| File | Line(s) | Issue | Severity |
|------|---------|-------|----------|
| `alembic/versions/36d3a72a4e57_*.py` | 20-24 | Missing FK constraint for account_tag_id in Postgres | **CRITICAL** |
| `alembic/versions/6ce6205b5a58_*.py` | 40 | Comment explains FK skipped for SQLite; inconsistent vs later migrations | **HIGH** |
| `models.py` | 99, 108, 112 | Nullable FK columns (account_tag_id, import_session_id, linked_transaction_id) | **HIGH** |
| `models.py` | 40-41 | UTC datetimes lack timezone info; conflicts with Postgres timestamptz | **MEDIUM** |
| `routers/transactions.py` | 233 | No eager loading; N+1 query risk when accessing transaction.tags | **MEDIUM** |
| `models.py` | 43-50 | TransactionTag missing index on tag_id alone | **MEDIUM** |
| `alembic/env.py` | 9 | URL conversion `replace("+aiosqlite", "")` works but fragile if URL format changes | **LOW** |

---

## Migration Safety Assessment

### Reversibility: Good

All 25 migrations have proper `downgrade()` implementations.

### Zero-Downtime Readiness: Conditional

| Aspect | Status |
|--------|--------|
| Column additions | Backward-compatible |
| Backfills | Done after column creation (good pattern) |
| NOT VALID constraints | Not used for new FKs |
| Rollout strategy | Not documented |

### Testing: Incomplete

No evidence of:
- Pre-production Postgres validation
- Data integrity checks post-migration
- Query performance verification with realistic data volumes

---

## Recommendations for Postgres Migration

### Pre-Migration (Week 1)

1. Run SQLite migrations end-to-end on a test database with production-like data
2. Enable `PRAGMA foreign_keys=ON` and verify no constraint violations
3. Compare schema between SQLite and Postgres post-migration

### Migration Phase (Maintenance Window)

1. **Add explicit FK constraints:**

```sql
-- For account_tag_id
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_account_tag_id
FOREIGN KEY (account_tag_id)
REFERENCES tags(id) ON DELETE SET NULL;

-- For linked_transaction_id
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_linked_transaction_id
FOREIGN KEY (linked_transaction_id)
REFERENCES transactions(id) ON DELETE SET NULL;
```

2. **Update datetime columns to timestamptz:**

```sql
ALTER TABLE transactions
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
```

3. **Add eager loading to high-traffic endpoints**

### Post-Migration (Week 2)

1. Run performance benchmarks on Postgres
2. Validate query plans with EXPLAIN ANALYZE
3. Monitor slow query logs for N+1 patterns

---

## Summary

The database layer is well-structured with thoughtful migrations but needs explicit FK constraints and timezone-aware datetimes before Postgres migration. The main risk is implicit ORM-level enforcement that Postgres will not respect.

**Priority fixes:**
1. Create Postgres-specific migration adding FK constraints
2. Update datetime handling to use timezone-aware UTC
3. Add eager loading to prevent N+1 queries
4. Review nullable FKs and add application-level validation
