# Test Suite Status & Next Steps

## Summary

Created comprehensive test suite for backend API covering all functional requirements (FR-001 through FR-005). Tests are currently failing due to API response format mismatches, but the test infrastructure is in place.

## Test Coverage Created

### ✅ Test Files Created
- `tests/conftest.py` - Test configuration with async fixtures
- `tests/test_transactions.py` - FR-002: Transaction Management (9 tests)
- `tests/test_reports.py` - FR-005: Reports & Analytics (7 tests)
- `tests/test_categories.py` - FR-003: Category Inference (5 tests)
- `tests/test_csv_import.py` - FR-001: CSV Import (6 tests)
- `tests/test_reconciliation.py` - FR-004: Reconciliation (7 tests)

**Total: 34 tests covering all functional requirements**

## Current Status

### Issues Found
1. **API Response Format**: Tests expect paginated responses with `items` and `total` keys, but API returns plain lists
   - Affects: Transaction list endpoints
   - Fix: Update tests to match actual API response format

2. **Status Code Mismatch**: Create transaction returns 201 (correct), tests expect 200
   - Fix: Update test assertions

3. **Deprecation Warnings**:
   - `regex` parameter deprecated in favor of `pattern` in Query validators
   - `on_event` deprecated in favor of `lifespan` handlers
   - `.dict()` deprecated in favor of `.model_dump()` in SQLModel

### Quick Wins to Fix Tests
1. Update test assertions to work with list responses instead of paginated responses
2. Change status code expectations (201 for creates, not 200)
3. Access list items directly: `data[0]` instead of `data["items"][0]`

## Test Infrastructure ✅

- [x] pytest configured with asyncio support
- [x] Async database fixtures (in-memory SQLite)
- [x] Test client with dependency injection
- [x] Seed data fixtures for categories and transactions
- [x] Proper isolation between tests

## Next Steps

### 1. Fix Existing Tests (30 min)
Update test assertions to match actual API responses:
```python
# Old (expected)
data["items"][0]["id"]

# New (actual)
data[0]["id"]
```

### 2. Run Tests & Verify Requirements (15 min)
```bash
cd backend
uv run pytest tests/ -v
```

### 3. Add Better Analytics Features (2-3 hours)
Based on user request for "Better Analytics":

#### A. Month-over-Month Comparison
**Backend** (`app/routers/reports.py`):
```python
@router.get("/monthly-comparison")
async def monthly_comparison(
    current_month: int,
    current_year: int,
    compare_month: int,
    compare_year: int,
    session: AsyncSession = Depends(get_session)
):
    """Compare two months side-by-side"""
    # Calculate differences, % changes
    return {
        "current": {...},
        "comparison": {...},
        "changes": {
            "income_change": ...,
            "expense_change": ...,
            "net_change": ...
        }
    }
```

**Frontend** (`frontend/src/app/page.tsx`):
- Add month selector dropdown
- Display comparison cards showing % changes
- Color code increases (red for expenses, green for income)

#### B. Spending Velocity (Daily Burn Rate)
**Backend**:
```python
@router.get("/spending-velocity")
async def spending_velocity(
    year: int,
    month: int,
    session: AsyncSession = Depends(get_session)
):
    """Calculate daily spending rate"""
    # total_expenses / days_in_month
    # projected_monthly = daily_rate * days_remaining
    return {
        "daily_average": ...,
        "current_total": ...,
        "projected_monthly": ...,
        "pace": "on track" | "over budget" | "under budget"
    }
```

**Frontend**:
- Add "Daily Burn Rate" card to dashboard
- Show projected vs actual monthly spending
- Progress bar for month completion

#### C. Anomaly Detection
**Backend**:
```python
@router.get("/anomalies")
async def detect_anomalies(
    year: int,
    month: int,
    session: AsyncSession = Depends(get_session)
):
    """Detect unusual transactions"""
    # Find transactions > 2 std deviations from mean
    # Flag new merchants
    # Detect unusual categories
    return {
        "large_transactions": [...],
        "new_merchants": [...],
        "unusual_categories": [...]
    }
```

**Frontend**:
- Add "Unusual Activity" section
- List transactions flagged as anomalies
- Explain why each is unusual

### 4. Create Tests for New Analytics (1 hour)
Add to `tests/test_reports.py`:
- `test_monthly_comparison()`
- `test_spending_velocity()`
- `test_anomaly_detection()`

## Estimated Timeline

1. **Fix existing tests**: 30 minutes
2. **Month-over-month comparison**: 45 minutes (backend 20min, frontend 25min)
3. **Spending velocity**: 45 minutes (backend 20min, frontend 25min)
4. **Anomaly detection**: 1 hour (backend 30min, frontend 30min)
5. **Tests for new features**: 30 minutes
6. **Integration & polish**: 30 minutes

**Total: ~4 hours of focused work**

## User Goal Alignment

**User wants**: Understand where to save money, what they're spending on, opportunities to cut costs

**New analytics provide**:
1. **Month-over-month**: See if spending is increasing or decreasing
2. **Daily burn rate**: Know if you're on track for the month
3. **Anomalies**: Spot unusual purchases that might be mistakes or wasteful

## Running Tests

```bash
# All tests
cd backend && uv run pytest tests/ -v

# Specific test file
uv run pytest tests/test_transactions.py -v

# Single test
uv run pytest tests/test_transactions.py::TestTransactionManagement::test_list_transactions -v

# With coverage
uv run pytest tests/ --cov=app --cov-report=html
```

## Requirements Validation

Once tests pass, they validate:
- ✅ **FR-001**: CSV Import (format detection, parsing, preview, duplicates)
- ✅ **FR-002**: Transaction Management (CRUD, search, filter)
- ✅ **FR-003**: Category Inference (auto-categorization, keyword rules)
- ✅ **FR-004**: Reconciliation (bulk ops, status transitions)
- ✅ **FR-005**: Reports & Analytics (monthly summary, trends, top merchants)

## Future Test Enhancements

- Add integration tests for CSV import with actual files
- Add performance tests for large datasets (10k+ transactions)
- Add E2E tests using Playwright for frontend
- Add API contract tests using Pact
- Set up CI/CD to run tests on every commit
