# SQLModel → SQLAlchemy Migration Plan

Issue: #163

## Overview

Migrate 15 ORM models and 21 Pydantic schemas from SQLModel to pure SQLAlchemy + Pydantic.

## Why Migrate?

- SQLModel is a thin wrapper; pure SQLAlchemy gives more control
- Cleaner separation between ORM models and API schemas
- Better IDE support and type inference
- Aligns with FastAPI best practices for larger apps

## Models Inventory

### ORM Models (table=True) - 15 total

| Model | Dependencies | Complexity | Notes |
|-------|-------------|------------|-------|
| `BaseModel` | None | Low | Abstract base with id, created_at, updated_at |
| `TransactionTag` | tags, transactions FKs | Low | Junction table |
| `ImportFormat` | None | Low | Simple fields |
| `CustomFormatConfig` | None | Low | Simple fields |
| `BatchImportSession` | None | Low | Simple fields |
| `Budget` | None | Low | Simple fields |
| `TagRule` | None | Low | Simple fields |
| `RecurringPattern` | None | Low | Simple fields |
| `MerchantAlias` | None | Low | Simple fields |
| `SavedFilter` | None | Low | Simple fields |
| `AppSettings` | None | Low | Simple fields |
| `ImportSession` | batch_import FK | Medium | Single FK relationship |
| `Tag` | transactions relationship | Medium | Many-to-many via TransactionTag |
| `Dashboard` | widgets relationship | Medium | One-to-many to DashboardWidget |
| `DashboardWidget` | dashboard FK | Medium | Belongs to Dashboard |
| `Transaction` | tags, account_tag, self, import_session FKs | High | Most complex model |

### Pydantic Schemas - 21 total

- TagCreate, TagUpdate
- TransactionCreate, TransactionUpdate
- ImportFormatCreate, ImportFormatUpdate
- CustomFormatConfigCreate, CustomFormatConfigUpdate
- BudgetCreate, BudgetUpdate
- TagRuleCreate, TagRuleUpdate
- RecurringPatternCreate, RecurringPatternUpdate
- MerchantAliasCreate, MerchantAliasUpdate
- SavedFilterCreate, SavedFilterUpdate
- DashboardCreate, DashboardUpdate
- DashboardWidgetCreate, DashboardWidgetUpdate, DashboardLayoutUpdate
- SplitItem, TransactionSplits, TransactionSplitResponse
- AppSettingsUpdate

## Migration Order (Dependency-Safe)

### Phase 1: Foundation
1. Create `backend/app/models/base.py` with SQLAlchemy DeclarativeBase
2. Create `backend/app/schemas/` directory for Pydantic models

### Phase 2: Independent Models (no relationships)
3. ImportFormat
4. CustomFormatConfig
5. BatchImportSession
6. Budget
7. TagRule
8. RecurringPattern
9. MerchantAlias
10. SavedFilter
11. AppSettings

### Phase 3: Junction Table
12. TransactionTag

### Phase 4: Models with Simple FKs
13. ImportSession (refs BatchImportSession)
14. DashboardWidget (refs Dashboard - but migrate without relationship first)

### Phase 5: Models with Relationships
15. Tag (has transactions many-to-many)
16. Dashboard (has widgets one-to-many)
17. Update DashboardWidget with relationship

### Phase 6: Complex Model
18. Transaction (refs Tag, ImportSession, self)

## Per-Model Migration Steps

For each model:

1. **Create SQLAlchemy model** in `backend/app/models/<name>.py`
   ```python
   from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
   from sqlalchemy.orm import relationship
   from app.models.base import Base

   class ModelName(Base):
       __tablename__ = "table_name"

       id = Column(Integer, primary_key=True)
       # ... columns
   ```

2. **Create Pydantic schemas** in `backend/app/schemas/<name>.py`
   ```python
   from pydantic import BaseModel
   from typing import Optional

   class ModelNameCreate(BaseModel):
       # fields

   class ModelNameUpdate(BaseModel):
       # optional fields

   class ModelNameRead(BaseModel):
       # all fields including id
       model_config = ConfigDict(from_attributes=True)
   ```

3. **Update imports** in affected files (routers, services)

4. **Run tests**: `just test::backend`

5. **Commit** if tests pass

## Key Changes Pattern

### Before (SQLModel)
```python
from sqlmodel import SQLModel, Field, Relationship

class MyModel(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    items: List["Item"] = Relationship(back_populates="parent")
```

### After (SQLAlchemy + Pydantic)
```python
# models/my_model.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.models.base import Base

class MyModel(Base):
    __tablename__ = "my_models"

    id = Column(Integer, primary_key=True)
    name = Column(String, index=True, nullable=False)
    items = relationship("Item", back_populates="parent")

# schemas/my_model.py
from pydantic import BaseModel, ConfigDict

class MyModelCreate(BaseModel):
    name: str

class MyModelRead(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)
```

## Files to Create

```
backend/app/
├── models/
│   ├── __init__.py          # Re-export all models
│   ├── base.py               # DeclarativeBase
│   ├── transaction.py
│   ├── tag.py
│   ├── budget.py
│   └── ...
├── schemas/
│   ├── __init__.py          # Re-export all schemas
│   ├── transaction.py
│   ├── tag.py
│   ├── budget.py
│   └── ...
```

## Testing Strategy

- Run `just test::backend` after each model migration
- All 200+ backend tests should pass
- No database schema changes (same tables, same columns)
- Alembic migrations should still work

## Rollback Plan

If issues arise:
- Git revert individual commits
- Each model is migrated independently
- No schema changes means database is unaffected
