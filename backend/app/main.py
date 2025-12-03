from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import transactions, import_router, reports, budgets, tag_rules, recurring, admin, tags, transfers, merchants, accounts, filters, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown (nothing needed for now)


tags_metadata = [
    {"name": "transactions", "description": "Transaction CRUD and filtering operations"},
    {"name": "import", "description": "Import transactions from CSV, QIF, QFX, and OFX files"},
    {"name": "reports", "description": "Analytics, summaries, and spending insights"},
    {"name": "budgets", "description": "Budget tracking with limits and alerts"},
    {"name": "recurring", "description": "Recurring transaction detection and predictions"},
    {"name": "tags", "description": "Tag management (buckets, occasions, accounts)"},
    {"name": "category-rules", "description": "Automated categorization rules"},
    {"name": "transfers", "description": "Transfer detection and linking"},
    {"name": "merchants", "description": "Merchant alias management"},
    {"name": "accounts", "description": "Account management including credit cards"},
    {"name": "filters", "description": "Saved search filters"},
    {"name": "dashboard", "description": "Dashboard widget configuration and layout"},
    {"name": "admin", "description": "Administrative operations and data management"},
]

app = FastAPI(
    title="Maxwell's Wallet API",
    description="""
Personal finance tracker API with support for:

- **Multi-format import** - CSV (Bank of America, Amex, Venmo), QIF, QFX, OFX
- **Smart categorization** - Auto-categorize with rules and keyword matching
- **Budget tracking** - Set limits and get alerts at 80%/100% thresholds
- **Analytics** - Month-over-month comparison, burn rate, anomaly detection
- **Transfer detection** - Identify and link internal transfers
- **Recurring transactions** - Detect subscriptions and predict upcoming payments

## Authentication

This API currently has no authentication. It's designed for single-user local deployment.

## Getting Started

1. Import transactions via `/api/v1/import/preview` and `/api/v1/import/confirm`
2. Categorize using tags at `/api/v1/transactions/{id}/tags`
3. View insights at `/api/v1/reports/*`
    """,
    version="0.4.4",
    lifespan=lifespan,
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(transactions.router)
app.include_router(import_router.router)
app.include_router(reports.router)
app.include_router(budgets.router)
app.include_router(tag_rules.router)
app.include_router(recurring.router)
app.include_router(admin.router)
app.include_router(tags.router)
app.include_router(transfers.router)
app.include_router(merchants.router)
app.include_router(accounts.router)
app.include_router(filters.router)
app.include_router(dashboard.router)

@app.get("/", tags=["health"])
async def root():
    """API root - returns version and links to documentation."""
    return {
        "name": "Maxwell's Wallet API",
        "version": "0.4.4",
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json"
    }

@app.get("/health", tags=["health"])
async def health():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}
