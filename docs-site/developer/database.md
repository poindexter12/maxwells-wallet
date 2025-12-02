# Database

Maxwell's Wallet uses SQLite for development and is PostgreSQL-compatible for production.

## Schema Management

Database schema is managed with [Alembic](https://alembic.sqlalchemy.org/) migrations.

### Creating Migrations

When you modify models in `backend/app/models.py`:

```bash
cd backend
uv run alembic revision --autogenerate -m "description of change"
```

Review the generated migration in `backend/alembic/versions/` before applying.

### Applying Migrations

```bash
cd backend
uv run alembic upgrade head
```

### Migration History

```bash
# Show current revision
uv run alembic current

# Show migration history
uv run alembic history

# Downgrade one revision
uv run alembic downgrade -1
```

## Seeding

### Sample Data

Populate the database with sample transactions:

```bash
make db-seed
```

This imports sample CSV files from `/samples/` and creates default categories.

### Reset Database

To start fresh:

```bash
make db-reset
```

Or manually:

```bash
cd backend
rm wallet.db
uv run python -m app.seed
```

## Database Location

| Environment | Location |
|-------------|----------|
| Development | `backend/wallet.db` |
| Docker | `/data/wallet.db` (mounted volume) |
| Production | Configure via `DATABASE_URL` env var |

## Entity Reference

See [Domain Model](../domain-model.md) for detailed entity documentation.

### Core Entities

| Entity | Description |
|--------|-------------|
| `Transaction` | Financial transactions (amount, date, merchant) |
| `Account` | Bank accounts and credit cards |
| `Bucket` | Spending categories (Groceries, Dining, etc.) |
| `Occasion` | Time-based groupings (Christmas 2024, Vacation) |

### Supporting Entities

| Entity | Description |
|--------|-------------|
| `TagRule` | Pattern-based auto-categorization rules |
| `Budget` | Spending limits per bucket/occasion/account |
| `MerchantAlias` | Normalize messy merchant names |
| `ImportSession` | Track import history and duplicates |
| `SavedFilter` | User-saved filter presets |

## Default Categories

The seed script creates these default buckets:

- Income
- Groceries
- Dining & Coffee
- Shopping
- Utilities
- Transportation
- Entertainment
- Healthcare
- Education
- Housing
- Subscriptions
- Other

Additional categories can be created via the API or UI.
