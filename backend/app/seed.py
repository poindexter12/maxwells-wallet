"""
Database seeding script
Loads sample CSV data and default categories
"""
import asyncio
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import async_session
from app.models import Category, Transaction, ReconciliationStatus
from app.csv_parser import parse_csv
from app.category_inference import infer_category, build_user_history

# Default categories
DEFAULT_CATEGORIES = [
    ("Income", "Salary, deposits, refunds"),
    ("Groceries", "Supermarkets and grocery stores"),
    ("Dining & Coffee", "Restaurants, cafes, takeout"),
    ("Shopping", "Retail stores, online shopping"),
    ("Utilities", "Gas, electric, water, internet, phone"),
    ("Transportation", "Gas, tolls, rideshare, parking"),
    ("Entertainment", "Streaming services, movies, concerts"),
    ("Healthcare", "Medical, dental, pharmacy, veterinary"),
    ("Education", "Schools, classes, training"),
    ("Housing", "Rent, mortgage, HOA dues"),
    ("Subscriptions", "Monthly/annual subscriptions and memberships"),
    ("Other", "Miscellaneous expenses"),
]

async def seed_categories(session: AsyncSession):
    """Seed default categories"""
    print("Seeding categories...")

    for name, description in DEFAULT_CATEGORIES:
        # Check if category exists
        result = await session.execute(
            select(Category).where(Category.name == name)
        )
        existing = result.scalar_one_or_none()

        if not existing:
            category = Category(name=name, description=description)
            session.add(category)
            print(f"  Added category: {name}")

    await session.commit()
    print("Categories seeded!")

async def seed_sample_data(session: AsyncSession):
    """Load sample CSV files into database"""
    print("Seeding sample transaction data...")

    samples_dir = Path(__file__).parent.parent.parent / "samples"

    if not samples_dir.exists():
        print("  No samples directory found, skipping sample data")
        return

    # Load BOFA sample
    bofa_file = samples_dir / "bofa.csv"
    if bofa_file.exists():
        print("  Loading BOFA sample...")
        with open(bofa_file) as f:
            csv_content = f.read()

        transactions, _ = parse_csv(csv_content, "BOFA-Checking", None)

        for txn_data in transactions:
            # Check for duplicate
            result = await session.execute(
                select(Transaction).where(
                    Transaction.reference_id == txn_data.get('reference_id')
                )
            )
            if result.scalar_one_or_none():
                continue

            # Create transaction
            transaction = Transaction(
                date=txn_data['date'],
                amount=txn_data['amount'],
                description=txn_data['description'],
                merchant=txn_data.get('merchant'),
                account_source=txn_data['account_source'],
                card_member=txn_data.get('card_member'),
                category=None,  # Will infer later
                reconciliation_status=ReconciliationStatus.unreconciled,
                reference_id=txn_data.get('reference_id')
            )
            session.add(transaction)

        print(f"  Loaded {len(transactions)} BOFA transactions")

    # Load AMEX sample
    amex_file = samples_dir / "amex.csv"
    if amex_file.exists():
        print("  Loading AMEX sample...")
        with open(amex_file) as f:
            csv_content = f.read()

        transactions, _ = parse_csv(csv_content, None, None)

        for txn_data in transactions:
            # Check for duplicate
            result = await session.execute(
                select(Transaction).where(
                    Transaction.reference_id == txn_data.get('reference_id')
                )
            )
            if result.scalar_one_or_none():
                continue

            # Create transaction with suggested category
            transaction = Transaction(
                date=txn_data['date'],
                amount=txn_data['amount'],
                description=txn_data['description'],
                merchant=txn_data.get('merchant'),
                account_source=txn_data['account_source'],
                card_member=txn_data.get('card_member'),
                category=txn_data.get('suggested_category'),
                reconciliation_status=ReconciliationStatus.unreconciled,
                reference_id=txn_data.get('reference_id')
            )
            session.add(transaction)

        print(f"  Loaded {len(transactions)} AMEX transactions")

    await session.commit()

    # Now infer categories for uncategorized transactions
    print("  Inferring categories for uncategorized transactions...")
    result = await session.execute(
        select(Transaction).where(Transaction.category.is_(None))
    )
    uncategorized = result.scalars().all()

    # Build user history
    result = await session.execute(
        select(Transaction).where(Transaction.category.isnot(None))
    )
    categorized = result.scalars().all()
    user_history = build_user_history(categorized)

    for txn in uncategorized:
        suggestions = infer_category(
            txn.merchant or "",
            txn.description,
            txn.amount,
            user_history
        )
        if suggestions:
            txn.category = suggestions[0][0]

    await session.commit()
    print("Sample data seeded!")

async def main():
    """Main seeding function"""
    # Initialize database (create tables if they don't exist)
    from app.database import init_db
    await init_db()

    async with async_session() as session:
        # Check if already seeded
        result = await session.execute(select(Category))
        if result.scalars().first():
            print("Database already seeded, skipping...")
            return

        await seed_categories(session)
        await seed_sample_data(session)

        print("\n✅ Database seeding complete!")

if __name__ == "__main__":
    asyncio.run(main())
