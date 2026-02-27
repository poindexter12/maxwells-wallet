---
created: 2026-02-27T14:57:27.074Z
title: Replace datetime.utcnow with timezone-aware UTC
area: backend
files:
  - backend/app/routers/tags.py:94,150
  - backend/app/routers/transfers.py:137,179,180,213,217
  - backend/app/routers/recurring.py:87
  - backend/app/routers/dashboards.py:228,276,384,409
  - backend/app/routers/transactions.py:407,440
  - backend/app/routers/dashboard.py:109,148,195
  - backend/app/routers/admin.py:84
  - backend/app/routers/settings.py:134
  - backend/app/routers/budgets.py:93,165
  - backend/app/routers/tag_rules.py:149,297,354
  - backend/app/routers/merchants.py:126,195
  - backend/app/routers/import_router.py:129,401,831,1282,1410
  - backend/app/routers/filters.py:158,195,253
  - backend/app/utils/auth.py:30
---

## Problem

`datetime.datetime.utcnow()` is deprecated since Python 3.12 and scheduled for removal. It returns a naive datetime (no tzinfo), which is error-prone. There are 35 occurrences across 12 router files and `auth.py`, each producing 636 deprecation warnings during the test suite.

## Solution

Replace all `datetime.utcnow()` calls with `datetime.now(datetime.UTC)`:
- `from datetime import datetime, UTC` (Python 3.11+)
- Search-and-replace `datetime.utcnow()` → `datetime.now(UTC)`
- Verify SQLModel/SQLAlchemy column defaults also use timezone-aware datetimes
- Check that any `datetime.utcnow()` in model defaults (e.g., `default_factory`) is also updated
