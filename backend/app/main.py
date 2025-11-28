from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import transactions, categories, import_router, reports, budgets, category_rules, tag_rules, recurring, admin, tags


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown (nothing needed for now)


app = FastAPI(
    title="Maxwell's Wallet API",
    description="Personal finance tracker API",
    version="0.4.0",
    lifespan=lifespan
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
app.include_router(categories.router)
app.include_router(import_router.router)
app.include_router(reports.router)
app.include_router(budgets.router)
app.include_router(category_rules.router)  # Legacy, will be removed
app.include_router(tag_rules.router)
app.include_router(recurring.router)
app.include_router(admin.router)
app.include_router(tags.router)

@app.get("/")
async def root():
    return {"message": "Maxwell's Wallet API", "version": "0.4.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
