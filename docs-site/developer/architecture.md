# Architecture

Maxwell's Wallet is a full-stack application with a Python backend and TypeScript frontend.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python (async) |
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
│   │   ├── csv_parser.py   # CSV parsing logic (BOFA/AMEX)
│   │   ├── category_inference.py  # Category inference service
│   │   ├── seed.py         # Database seeding script
│   │   └── routers/        # API route handlers
│   │       ├── transactions.py
│   │       ├── categories.py
│   │       ├── import_router.py
│   │       └── reports.py
│   ├── alembic/            # Database migrations
│   ├── tests/              # Backend test suite
│   └── pyproject.toml      # Python dependencies
├── frontend/               # Next.js frontend
│   ├── src/
│   │   └── app/
│   │       ├── layout.tsx  # App layout with navigation
│   │       ├── page.tsx    # Dashboard page
│   │       ├── transactions/  # Transactions page
│   │       ├── import/     # Import page
│   │       └── reconcile/  # Reconciliation page
│   ├── package.json        # Node dependencies
│   └── next.config.js      # Next.js config (API proxy)
├── samples/                # Sample CSV files (seeding)
├── data/                   # Test data directory
│   ├── raw/                # Real financial CSVs (gitignored)
│   └── anonymized/         # Scrubbed test data (safe to commit)
├── scripts/                # Utility scripts
├── make/                   # Modular Makefile components
└── docs-site/              # MkDocs documentation source
```

## Backend Architecture

### API Design

The backend follows a router-based architecture with FastAPI:

- **Routers** handle HTTP endpoints, grouped by domain
- **Models** define SQLModel entities (Pydantic + SQLAlchemy hybrid)
- **Services** contain business logic (category inference, CSV parsing)

### Key Patterns

- **Async everywhere**: All database operations use async/await
- **SQLModel**: Single model definitions serve as both Pydantic schemas and SQLAlchemy ORM models
- **Alembic**: Database migrations for schema changes

### Database

SQLite is used for development with the database file at `backend/wallet.db`. The schema is PostgreSQL-compatible for production deployment.

Key entities:

- `Transaction` - Financial transactions with amount, date, merchant
- `Account` - Bank accounts and credit cards
- `Bucket` - Spending categories (Groceries, Dining, etc.)
- `Occasion` - Time-based groupings (Christmas 2024, Vacation, etc.)
- `TagRule` - Pattern-based auto-categorization rules
- `Budget` - Spending limits per bucket/occasion/account

## Frontend Architecture

### Next.js App Router

The frontend uses Next.js 14 with the App Router:

- **Server Components** by default for better performance
- **Client Components** where interactivity is needed (`'use client'`)
- **API Proxy** configured in `next.config.js` to route `/api/*` to the backend

### State Management

- React hooks for local state
- Server-side data fetching where possible
- Client-side fetching for interactive features

### Styling

- **Tailwind CSS** for utility-first styling
- Consistent color scheme with blue primary accent
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
