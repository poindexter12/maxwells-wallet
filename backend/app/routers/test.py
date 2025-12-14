"""
Test utilities router - only enabled in development/test environments.

Provides endpoints for:
- Seeding the database with test data
- Clearing test data

WARNING: These endpoints are destructive and should never be enabled in production.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Only enable in development/test environments
ENABLE_TEST_ENDPOINTS = os.getenv("ENABLE_TEST_ENDPOINTS", "").lower() in {"1", "true", "yes", "development", "test"}

router = APIRouter(
    prefix="/api/v1/test",
    tags=["test"],
)


class SeedRequest(BaseModel):
    clear: bool = False
    num_transactions: int = 500


class SeedResponse(BaseModel):
    success: bool
    message: str


@router.post("/seed", response_model=SeedResponse)
async def seed_database(request: SeedRequest = SeedRequest()):
    """
    Seed the database with test data.

    WARNING: This is a destructive operation if clear=True.
    Only available when ENABLE_TEST_ENDPOINTS=true.

    Args:
        clear: If True, clears existing data before seeding
        num_transactions: Number of transactions to generate (default: 500)
    """
    if not ENABLE_TEST_ENDPOINTS:
        raise HTTPException(
            status_code=403, detail="Test endpoints are disabled. Set ENABLE_TEST_ENDPOINTS=true to enable."
        )

    try:
        # Import here to avoid loading seed script in production
        from scripts.seed import (
            async_session,
            clear_data,
            seed_tags,
            seed_transactions,
            seed_budgets,
            seed_dashboards,
            seed_tag_rules,
        )

        async with async_session() as session:
            if request.clear:
                await clear_data(session)

            tag_lookup = await seed_tags(session)
            await seed_transactions(session, tag_lookup, num_transactions=request.num_transactions)
            await seed_budgets(session)
            await seed_dashboards(session)
            await seed_tag_rules(session)

        return SeedResponse(
            success=True, message=f"Database seeded successfully with {request.num_transactions} transactions."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")


@router.delete("/clear", response_model=SeedResponse)
async def clear_database():
    """
    Clear all data from the database.

    WARNING: This is a destructive operation.
    Only available when ENABLE_TEST_ENDPOINTS=true.
    """
    if not ENABLE_TEST_ENDPOINTS:
        raise HTTPException(
            status_code=403, detail="Test endpoints are disabled. Set ENABLE_TEST_ENDPOINTS=true to enable."
        )

    try:
        from scripts.seed import async_session, clear_data

        async with async_session() as session:
            await clear_data(session)

        return SeedResponse(success=True, message="Database cleared successfully.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clear failed: {str(e)}")


@router.get("/status")
async def test_status():
    """Check if test endpoints are enabled."""
    return {
        "test_endpoints_enabled": ENABLE_TEST_ENDPOINTS,
        "environment": os.getenv("ENVIRONMENT", "unknown"),
    }
