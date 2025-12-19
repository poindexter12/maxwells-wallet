"""
Seed script for Maxwell's Wallet E2E testing.

Creates realistic test data:
- 5 accounts (2 bank, 2 credit card, 1 HSA)
- 10 bucket tags, 5 occasion tags
- 500+ transactions across 6 months
- 3 budgets
- 2 dashboards with widgets
- 5 tag rules

Usage:
    python -m scripts.seed          # Seed with fresh data
    python -m scripts.seed --clear  # Clear existing data first
"""

import asyncio
import random
import hashlib
import argparse
from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select

from app.database import async_session, engine
from app.models import (
    Tag,
    Transaction,
    TransactionTag,
    Budget,
    BudgetPeriod,
    Dashboard,
    DashboardWidget,
    DateRangeType,
    TagRule,
    ReconciliationStatus,
    User,
)
from app.utils.auth import hash_password

# Demo user credentials
DEMO_USER = {
    "username": "maxwell",
    "password": "wallet",
}


# ============================================================================
# Configuration
# ============================================================================

ACCOUNTS = [
    {
        "value": "chase-checking",
        "description": "Chase Checking",
        "color": "#1e40af",
        "due_day": None,
        "credit_limit": None,
    },
    {"value": "bofa-savings", "description": "BofA Savings", "color": "#15803d", "due_day": None, "credit_limit": None},
    {"value": "amex-gold", "description": "Amex Gold Card", "color": "#b45309", "due_day": 15, "credit_limit": 10000},
    {
        "value": "chase-sapphire",
        "description": "Chase Sapphire",
        "color": "#0ea5e9",
        "due_day": 20,
        "credit_limit": 15000,
    },
    {"value": "inspira-hsa", "description": "Inspira HSA", "color": "#059669", "due_day": None, "credit_limit": None},
]

BUCKET_TAGS = [
    {"value": "groceries", "description": "Food and groceries", "color": "#22c55e"},
    {"value": "dining", "description": "Restaurants and takeout", "color": "#f97316"},
    {"value": "utilities", "description": "Bills and utilities", "color": "#3b82f6"},
    {"value": "entertainment", "description": "Movies, games, streaming", "color": "#a855f7"},
    {"value": "transportation", "description": "Gas, transit, parking", "color": "#eab308"},
    {"value": "shopping", "description": "Retail and online shopping", "color": "#ec4899"},
    {"value": "healthcare", "description": "Medical and pharmacy", "color": "#ef4444"},
    {"value": "subscriptions", "description": "Monthly subscriptions", "color": "#6366f1"},
    {"value": "travel", "description": "Hotels, flights, vacation", "color": "#14b8a6"},
    {"value": "personal", "description": "Personal care and misc", "color": "#8b5cf6"},
]

OCCASION_TAGS = [
    {"value": "vacation", "description": "Vacation spending", "color": "#06b6d4"},
    {"value": "birthday", "description": "Birthday gifts/parties", "color": "#ec4899"},
    {"value": "holiday", "description": "Holiday gifts and meals", "color": "#ef4444"},
    {"value": "home-project", "description": "Home improvement", "color": "#84cc16"},
    {"value": "emergency", "description": "Unexpected expenses", "color": "#f59e0b"},
]

# Merchant templates for generating realistic transactions
MERCHANTS = {
    "groceries": [
        ("Whole Foods", -45, -150),
        ("Trader Joe's", -30, -80),
        ("Costco", -100, -300),
        ("Safeway", -20, -100),
        ("Target", -25, -120),
    ],
    "dining": [
        ("Chipotle", -12, -20),
        ("Starbucks", -5, -15),
        ("Local Restaurant", -30, -80),
        ("DoorDash", -20, -50),
        ("McDonald's", -8, -15),
    ],
    "utilities": [
        ("PG&E", -80, -200),
        ("Comcast", -89, -150),
        ("AT&T", -80, -120),
        ("Water Utility", -40, -80),
    ],
    "entertainment": [
        ("Netflix", -15.99, -15.99),
        ("Spotify", -10.99, -10.99),
        ("Steam", -10, -60),
        ("AMC Theatres", -15, -40),
        ("Disney+", -13.99, -13.99),
    ],
    "transportation": [
        ("Shell", -30, -70),
        ("Chevron", -35, -75),
        ("Uber", -10, -40),
        ("BART", -5, -15),
        ("Parking Meter", -2, -10),
    ],
    "shopping": [
        ("Amazon", -20, -200),
        ("Best Buy", -50, -500),
        ("Nordstrom", -50, -300),
        ("REI", -30, -200),
        ("Home Depot", -25, -150),
    ],
    "healthcare": [
        ("CVS Pharmacy", -10, -80),
        ("Kaiser", -20, -100),
        ("Walgreens", -15, -60),
    ],
    "subscriptions": [
        ("Apple iCloud", -2.99, -2.99),
        ("Adobe Creative Cloud", -54.99, -54.99),
        ("GitHub Pro", -4, -4),
        ("1Password", -2.99, -2.99),
    ],
    "travel": [
        ("United Airlines", -200, -800),
        ("Marriott", -150, -400),
        ("Airbnb", -100, -500),
        ("Enterprise", -50, -200),
    ],
    "personal": [
        ("Great Clips", -20, -35),
        ("Gym Membership", -40, -80),
        ("Dry Cleaner", -15, -40),
    ],
}

# Income sources
INCOME_SOURCES = [
    ("Direct Deposit - Employer", 3500, 5000),
    ("Venmo - Friend", 20, 100),
    ("Interest Payment", 1, 10),
    ("Tax Refund", 500, 2000),
]


# ============================================================================
# Helper Functions
# ============================================================================


def generate_content_hash(date_val: date, amount: float, description: str, account: str) -> str:
    """Generate a content hash for deduplication."""
    content = f"{date_val.isoformat()}|{amount:.2f}|{description}|{account}"
    return hashlib.sha256(content.encode()).hexdigest()


def random_date_in_range(start: date, end: date) -> date:
    """Generate a random date between start and end."""
    delta = (end - start).days
    random_days = random.randint(0, delta)
    return start + timedelta(days=random_days)


# ============================================================================
# Seeding Functions
# ============================================================================


async def clear_data(session: AsyncSession):
    """Clear all existing data."""
    print("Clearing existing data...")

    # Delete in order to respect foreign keys
    await session.execute(delete(TransactionTag))
    await session.execute(delete(DashboardWidget))
    await session.execute(delete(Dashboard))
    await session.execute(delete(Budget))
    await session.execute(delete(TagRule))
    await session.execute(delete(Transaction))
    await session.execute(delete(Tag))
    await session.execute(delete(User))

    await session.commit()
    print("Data cleared.")


async def seed_demo_user(session: AsyncSession):
    """Create demo user if not exists."""
    print("Seeding demo user...")

    # Check if user already exists
    result = await session.execute(
        select(User).where(User.username == DEMO_USER["username"])
    )
    existing = result.scalar_one_or_none()

    if existing:
        print(f"Demo user '{DEMO_USER['username']}' already exists, skipping.")
        return

    user = User(
        username=DEMO_USER["username"],
        password_hash=hash_password(DEMO_USER["password"]),
    )
    session.add(user)
    await session.commit()
    print(f"Created demo user: {DEMO_USER['username']} / {DEMO_USER['password']}")


async def get_or_create_tag(
    session: AsyncSession,
    namespace: str,
    value: str,
    description: str,
    sort_order: int,
    color: str | None = None,
    due_day: int | None = None,
    credit_limit: float | None = None,
) -> Tag:
    """Get existing tag or create new one."""
    result = await session.execute(
        select(Tag).where(Tag.namespace == namespace, Tag.value == value)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    tag = Tag(
        namespace=namespace,
        value=value,
        description=description,
        sort_order=sort_order,
        color=color,
        due_day=due_day,
        credit_limit=credit_limit,
    )
    session.add(tag)
    await session.flush()
    return tag


async def seed_tags(session: AsyncSession) -> dict:
    """Create account, bucket, and occasion tags. Returns tag lookup dict."""
    print("Seeding tags...")
    tag_lookup = {}
    created_count = {"account": 0, "bucket": 0, "occasion": 0}

    # Account tags
    for i, account in enumerate(ACCOUNTS):
        tag = await get_or_create_tag(
            session,
            namespace="account",
            value=account["value"],
            description=account["description"],
            sort_order=i,
            color=account["color"],
            due_day=account["due_day"],
            credit_limit=account["credit_limit"],
        )
        tag_lookup[f"account:{account['value']}"] = tag.id
        if tag.created_at == tag.updated_at:  # New tag
            created_count["account"] += 1

    # Bucket tags
    for i, bucket in enumerate(BUCKET_TAGS):
        tag = await get_or_create_tag(
            session,
            namespace="bucket",
            value=bucket["value"],
            description=bucket["description"],
            sort_order=i,
            color=bucket["color"],
        )
        tag_lookup[f"bucket:{bucket['value']}"] = tag.id
        if tag.created_at == tag.updated_at:  # New tag
            created_count["bucket"] += 1

    # Occasion tags
    for i, occasion in enumerate(OCCASION_TAGS):
        tag = await get_or_create_tag(
            session,
            namespace="occasion",
            value=occasion["value"],
            description=occasion["description"],
            sort_order=i,
            color=occasion["color"],
        )
        tag_lookup[f"occasion:{occasion['value']}"] = tag.id
        if tag.created_at == tag.updated_at:  # New tag
            created_count["occasion"] += 1

    await session.commit()
    print(f"Tags: {created_count['account']} account, {created_count['bucket']} bucket, {created_count['occasion']} occasion (skipped existing).")
    return tag_lookup


async def seed_transactions(session: AsyncSession, tag_lookup: dict, num_transactions: int = 500):
    """Create realistic transactions across 6 months."""
    print(f"Seeding {num_transactions} transactions...")

    end_date = date.today()
    start_date = end_date - timedelta(days=180)  # ~6 months

    transactions_created = 0
    account_values = [a["value"] for a in ACCOUNTS]

    # Generate expense transactions
    for _ in range(int(num_transactions * 0.9)):  # 90% expenses
        bucket = random.choice(list(MERCHANTS.keys()))
        merchant_name, amount_min, amount_max = random.choice(MERCHANTS[bucket])
        amount = round(random.uniform(amount_min, amount_max), 2)

        # Pick an account (credit cards more likely for expenses)
        if bucket == "healthcare" and random.random() < 0.7:
            account = "inspira-hsa"
        elif random.random() < 0.7:
            account = random.choice(["amex-gold", "chase-sapphire"])
        else:
            account = random.choice(account_values)

        txn_date = random_date_in_range(start_date, end_date)
        description = f"{merchant_name} #{random.randint(1000, 9999)}"

        txn = Transaction(
            date=txn_date,
            amount=amount,
            description=description,
            merchant=merchant_name,
            account_source=account,
            account_tag_id=tag_lookup.get(f"account:{account}"),
            reconciliation_status=ReconciliationStatus.unreconciled,
            content_hash=generate_content_hash(txn_date, amount, description, account),
        )
        session.add(txn)
        await session.flush()

        # Add bucket tag
        bucket_tag_id = tag_lookup.get(f"bucket:{bucket}")
        if bucket_tag_id:
            txn_tag = TransactionTag(
                transaction_id=txn.id,
                tag_id=bucket_tag_id,
            )
            session.add(txn_tag)

        # Occasionally add occasion tag
        if random.random() < 0.1:
            occasion = random.choice(list(OCCASION_TAGS))
            occasion_tag_id = tag_lookup.get(f"occasion:{occasion['value']}")
            if occasion_tag_id:
                txn_tag = TransactionTag(
                    transaction_id=txn.id,
                    tag_id=occasion_tag_id,
                )
                session.add(txn_tag)

        transactions_created += 1

    # Generate income transactions
    for _ in range(int(num_transactions * 0.1)):  # 10% income
        source_name, amount_min, amount_max = random.choice(INCOME_SOURCES)
        amount = round(random.uniform(amount_min, amount_max), 2)
        account = random.choice(["chase-checking", "bofa-savings"])

        txn_date = random_date_in_range(start_date, end_date)
        description = source_name

        txn = Transaction(
            date=txn_date,
            amount=amount,
            description=description,
            merchant=source_name.split(" - ")[0],
            account_source=account,
            account_tag_id=tag_lookup.get(f"account:{account}"),
            reconciliation_status=ReconciliationStatus.unreconciled,
            content_hash=generate_content_hash(txn_date, amount, description, account),
        )
        session.add(txn)
        transactions_created += 1

    await session.commit()
    print(f"Created {transactions_created} transactions.")


async def seed_budgets(session: AsyncSession):
    """Create sample budgets."""
    print("Seeding budgets...")

    budgets = [
        Budget(tag="bucket:groceries", amount=500.00, period=BudgetPeriod.monthly),
        Budget(tag="bucket:dining", amount=300.00, period=BudgetPeriod.monthly),
        Budget(tag="bucket:entertainment", amount=150.00, period=BudgetPeriod.monthly),
    ]

    for budget in budgets:
        session.add(budget)

    await session.commit()
    print(f"Created {len(budgets)} budgets.")


async def seed_dashboards(session: AsyncSession):
    """Create dashboards with widgets."""
    from sqlalchemy import insert

    print("Seeding dashboards...")

    # Default dashboard - Month to Date
    default_dashboard = Dashboard(
        name="Monthly Overview",
        description="Month-to-date spending summary",
        date_range_type=DateRangeType.mtd,
        is_default=True,
        position=0,
    )
    session.add(default_dashboard)
    await session.commit()
    await session.refresh(default_dashboard)

    # Widgets for default dashboard - use raw insert to avoid ORM identity issues
    now = datetime.utcnow()
    default_widget_data = [
        {
            "dashboard_id": default_dashboard.id,
            "widget_type": "summary",
            "position": 0,
            "width": "full",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "dashboard_id": default_dashboard.id,
            "widget_type": "velocity",
            "position": 1,
            "width": "half",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "dashboard_id": default_dashboard.id,
            "widget_type": "bucket_pie",
            "position": 2,
            "width": "half",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "dashboard_id": default_dashboard.id,
            "widget_type": "top_merchants",
            "position": 3,
            "width": "half",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "dashboard_id": default_dashboard.id,
            "widget_type": "trends",
            "position": 4,
            "width": "full",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await session.execute(insert(DashboardWidget), default_widget_data)
    await session.commit()

    # Year to Date dashboard
    ytd_dashboard = Dashboard(
        name="Yearly View",
        description="Year-to-date analysis",
        date_range_type=DateRangeType.ytd,
        is_default=False,
        position=1,
    )
    session.add(ytd_dashboard)
    await session.commit()
    await session.refresh(ytd_dashboard)

    # Widgets for YTD dashboard
    ytd_widget_data = [
        {
            "dashboard_id": ytd_dashboard.id,
            "widget_type": "summary",
            "position": 0,
            "width": "full",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "dashboard_id": ytd_dashboard.id,
            "widget_type": "trends",
            "position": 1,
            "width": "full",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "dashboard_id": ytd_dashboard.id,
            "widget_type": "bucket_pie",
            "position": 2,
            "width": "half",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "dashboard_id": ytd_dashboard.id,
            "widget_type": "top_merchants",
            "position": 3,
            "width": "half",
            "is_visible": True,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await session.execute(insert(DashboardWidget), ytd_widget_data)
    await session.commit()

    print("Created 2 dashboards with widgets.")


async def seed_tag_rules(session: AsyncSession):
    """Create auto-tagging rules."""
    print("Seeding tag rules...")

    rules = [
        TagRule(
            name="Grocery Stores",
            tag="bucket:groceries",
            priority=100,
            merchant_pattern="Whole Foods|Trader Joe's|Safeway|Costco",
            enabled=True,
        ),
        TagRule(
            name="Coffee Shops",
            tag="bucket:dining",
            priority=90,
            merchant_pattern="Starbucks|Peet's|Blue Bottle",
            enabled=True,
        ),
        TagRule(
            name="Gas Stations",
            tag="bucket:transportation",
            priority=80,
            merchant_pattern="Shell|Chevron|Arco|76",
            enabled=True,
        ),
        TagRule(
            name="Streaming Services",
            tag="bucket:subscriptions",
            priority=70,
            merchant_pattern="Netflix|Spotify|Disney\\+|Hulu",
            enabled=True,
        ),
        TagRule(
            name="Amazon Shopping",
            tag="bucket:shopping",
            priority=60,
            merchant_pattern="Amazon|AMZN",
            enabled=True,
        ),
    ]

    for rule in rules:
        session.add(rule)

    await session.commit()
    print(f"Created {len(rules)} tag rules.")


# ============================================================================
# Main Entry Point
# ============================================================================


async def seed_all(clear: bool = False):
    """Run all seeding operations."""
    print("=" * 60)
    print("Maxwell's Wallet - Seed Script")
    print("=" * 60)

    async with async_session() as session:
        if clear:
            await clear_data(session)

        await seed_demo_user(session)
        tag_lookup = await seed_tags(session)
        await seed_transactions(session, tag_lookup, num_transactions=500)
        await seed_budgets(session)
        await seed_dashboards(session)
        await seed_tag_rules(session)

    print("=" * 60)
    print("Seeding complete!")
    print("=" * 60)

    # Dispose engine to close connection pool (prevents hanging in Docker)
    await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Seed Maxwell's Wallet database with test data")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before seeding")
    args = parser.parse_args()

    asyncio.run(seed_all(clear=args.clear))


if __name__ == "__main__":
    main()
