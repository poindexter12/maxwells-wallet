"""
Demo setup script for Maxwell's Wallet.

Seeds the database with sample data and creates a demo backup that will be
restored periodically when running in demo mode.

Usage:
    python -m scripts.setup_demo

This script:
1. Clears existing data
2. Seeds with demo transactions, budgets, dashboards, etc.
3. Creates a backup
4. Marks the backup as the demo restore point

After running this script, start the app with:
    DEMO_MODE=true
    DEMO_RESET_INTERVAL_HOURS=1
"""

import asyncio

from app.database import async_session
from app.services.backup import backup_service
from scripts.seed import (
    clear_data,
    seed_tags,
    seed_transactions,
    seed_budgets,
    seed_dashboards,
    seed_tag_rules,
)


async def setup_demo():
    """Set up demo database with sample data and create demo backup."""
    print("=" * 60)
    print("Maxwell's Wallet - Demo Setup")
    print("=" * 60)
    print()

    # Step 1: Seed the database
    print("Step 1: Seeding database with demo data...")
    async with async_session() as session:
        await clear_data(session)
        tag_lookup = await seed_tags(session)
        await seed_transactions(session, tag_lookup, num_transactions=500)
        await seed_budgets(session)
        await seed_dashboards(session)
        await seed_tag_rules(session)
    print("Database seeded successfully.")
    print()

    # Step 2: Create a backup
    print("Step 2: Creating demo backup...")
    backup = backup_service.create_backup(
        description="Demo seed data - restore point for demo mode",
        source="demo_seed",
    )
    print(f"Backup created: {backup.id}")
    print()

    # Step 3: Mark as demo backup
    print("Step 3: Marking backup as demo restore point...")
    backup_service.set_demo_backup(backup.id)
    print(f"Backup {backup.id} is now the demo restore point.")
    print()

    print("=" * 60)
    print("Demo setup complete!")
    print()
    print("To run in demo mode, set these environment variables:")
    print("  DEMO_MODE=true")
    print("  DEMO_RESET_INTERVAL_HOURS=1")
    print()
    print("The database will reset to this state every hour.")
    print("=" * 60)


def main():
    asyncio.run(setup_demo())
    # Force immediate exit to avoid APScheduler threads blocking
    import os
    os._exit(0)


if __name__ == "__main__":
    main()
