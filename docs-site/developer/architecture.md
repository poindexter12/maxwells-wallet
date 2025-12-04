# Architecture

Maxwell's Wallet is a full-stack application with a Python backend and TypeScript frontend.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS 4 |
| Backend | FastAPI + Python 3.11+ (async) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | SQLModel (Pydantic + SQLAlchemy) |
| Charts | Recharts |
| Package Management | pnpm (frontend), uv (backend) |

## Project Structure

```
maxwells-wallet/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI app entry point
│   │   ├── models.py       # SQLModel database models
│   │   ├── database.py     # Database configuration
│   │   ├── tag_inference.py # Bucket tag inference
│   │   ├── parsers/        # CSV/QIF/QFX parsing
│   │   │   ├── base.py     # Base parser with format detection
│   │   │   ├── registry.py # Format registry
│   │   │   └── formats/    # Format-specific parsers
│   │   ├── utils/
│   │   │   └── hashing.py  # Content hash utilities
│   │   └── routers/        # API route handlers
│   │       ├── transactions.py
│   │       ├── tags.py
│   │       ├── import_router.py
│   │       ├── reports.py
│   │       ├── dashboards.py    # Multi-dashboard API
│   │       ├── dashboard.py     # Widget API
│   │       ├── budgets.py
│   │       ├── accounts.py
│   │       ├── merchants.py
│   │       ├── transfers.py
│   │       ├── recurring.py
│   │       ├── filters.py
│   │       ├── tag_rules.py
│   │       └── admin.py
│   ├── alembic/            # Database migrations
│   ├── tests/              # Backend test suite (90%+ coverage)
│   └── pyproject.toml      # Python dependencies
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx  # App layout with navigation
│   │   │   ├── page.tsx    # Dashboard page
│   │   │   ├── transactions/
│   │   │   ├── import/
│   │   │   ├── budgets/
│   │   │   ├── organize/
│   │   │   ├── tools/
│   │   │   ├── admin/
│   │   │   └── dashboard/configure/
│   │   ├── components/
│   │   │   ├── NavBar.tsx
│   │   │   ├── DashboardSelector.tsx
│   │   │   ├── DashboardSidebar.tsx
│   │   │   ├── ThemeSwitcher.tsx
│   │   │   └── Providers.tsx
│   │   └── contexts/
│   │       └── DashboardContext.tsx
│   ├── package.json
│   └── next.config.js      # API proxy config
├── data/                   # Test data directory
│   ├── raw/                # Real CSVs (gitignored)
│   └── anonymized/         # Scrubbed test data
├── make/                   # Modular Makefile components
└── docs-site/              # MkDocs documentation source
```

## Backend Architecture

### API Design

The backend follows a router-based architecture with FastAPI:

- **Routers** handle HTTP endpoints, grouped by domain
- **Models** define SQLModel entities (Pydantic + SQLAlchemy hybrid)
- **Parsers** handle file format detection and parsing
- **Utils** contain shared utilities (hashing, etc.)

### Key Routers

| Router | Purpose |
|--------|---------|
| `transactions.py` | Transaction CRUD, search, splits |
| `dashboards.py` | Multi-dashboard management |
| `dashboard.py` | Widget CRUD and layout |
| `import_router.py` | File upload, preview, confirm |
| `reports.py` | Analytics, visualizations |
| `budgets.py` | Budget CRUD and status |
| `tags.py` | Tag management |
| `merchants.py` | Merchant aliases |
| `transfers.py` | Transfer detection |
| `recurring.py` | Recurring transaction detection |
| `filters.py` | Saved filter management |

### Key Patterns

- **Async everywhere**: All database operations use async/await
- **SQLModel**: Single model definitions serve as both Pydantic schemas and SQLAlchemy ORM models
- **Alembic**: Database migrations for schema changes
- **Content hashing**: Dual-hash deduplication for reliable import

### Database

SQLite is used for development with the database file at `backend/wallet.db`. The schema is PostgreSQL-compatible for production deployment.

Key entities:

- `Transaction` - Financial transactions with dual content hashes
- `TransactionSplit` - Split allocations across buckets
- `Tag` - Namespaced tags (bucket, occasion, account)
- `Dashboard` - Named dashboard configurations
- `DashboardWidget` - Widget instances with filters
- `Budget` - Spending limits per namespace
- `TagRule` - Pattern-based auto-categorization
- `MerchantAlias` - Merchant name normalization
- `RecurringPattern` - Detected subscriptions
- `SavedFilter` - Saved search configurations

## Frontend Architecture

### Next.js App Router

The frontend uses Next.js 16 with the App Router:

- **Server Components** by default for better performance
- **Client Components** where interactivity is needed (`'use client'`)
- **API Proxy** configured in `next.config.js` to route `/api/*` to the backend

### State Management

- **DashboardContext** for multi-dashboard state
- React hooks for local state
- Server-side data fetching where possible
- Client-side fetching for interactive features

### Key Components

| Component | Purpose |
|-----------|---------|
| `NavBar` | Navigation with dashboard selector |
| `DashboardSelector` | Quick dashboard switching |
| `DashboardSidebar` | Full dashboard management |
| `ThemeSwitcher` | Theme toggle |
| `Providers` | Context providers wrapper |

### Styling

- **Tailwind CSS 4** for utility-first styling
- Theme system with multiple color schemes
- Responsive design for desktop and mobile

## API Communication

The frontend communicates with the backend via REST API:

```
Frontend (localhost:3000)
    ↓
Next.js API Proxy (/api/* → localhost:8000/api/*)
    ↓
FastAPI Backend (localhost:8000)
    ↓
SQLite Database (wallet.db)
```

This proxy setup allows the frontend to make API calls to `/api/v1/...` without CORS issues during development.

## Testing

- **Backend**: pytest with 90%+ coverage
- **Frontend**: Vitest with React Testing Library
- **E2E**: Playwright for full workflow tests

Run tests:
```bash
make test-coverage    # Backend with coverage
make test-e2e         # E2E tests (requires make dev)
```
