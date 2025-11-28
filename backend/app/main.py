from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import transactions, categories, import_router, reports, budgets, category_rules, recurring

app = FastAPI(title="Finances API", description="Personal finance tracker API", version="0.3.0")

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
app.include_router(category_rules.router)
app.include_router(recurring.router)

@app.on_event("startup")
async def on_startup():
    await init_db()

@app.get("/")
async def root():
    return {"message": "Finances API", "version": "0.3.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
