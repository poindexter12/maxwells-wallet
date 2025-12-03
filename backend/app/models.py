from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from datetime import date as date_type
from typing import Optional, List, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from typing import List

class ReconciliationStatus(str, Enum):
    unreconciled = "unreconciled"
    matched = "matched"
    manually_entered = "manually_entered"
    ignored = "ignored"

class ImportFormatType(str, Enum):
    bofa_bank = "bofa_bank"   # BofA Checking (Date,Description,Amount,Running Bal.)
    bofa_cc = "bofa_cc"       # BofA Credit Card (Posted Date,Reference Number,Payee,Address,Amount)
    amex_cc = "amex_cc"       # Amex Credit Card (Date,Description,Amount,Card Member,Account #)
    inspira_hsa = "inspira_hsa"  # Inspira HSA (Transaction ID,Transaction Type,Origination Date,...)
    venmo = "venmo"           # Venmo (ID,Datetime,Type,Status,Note,From,To,Amount...)
    qif = "qif"               # Quicken Interchange Format (text-based)
    qfx = "qfx"               # Quicken Financial Exchange / OFX (XML-based)
    unknown = "unknown"

class BaseModel(SQLModel):
    """Base model with common fields"""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TransactionTag(SQLModel, table=True):
    """Junction table linking transactions to tags with optional split amounts"""
    __tablename__ = "transaction_tags"

    transaction_id: int = Field(foreign_key="transactions.id", primary_key=True)
    tag_id: int = Field(foreign_key="tags.id", primary_key=True)
    amount: Optional[float] = None  # Split amount - None means full transaction amount


class Tag(BaseModel, table=True):
    """Namespaced tag for flexible transaction classification"""
    __tablename__ = "tags"
    __table_args__ = {"extend_existing": True}

    namespace: str = Field(index=True)  # "bucket", "occasion", "merchant", "account"
    value: str = Field(index=True)       # "groceries", "vacation", "amazon", "amex-53004"
    description: Optional[str] = None
    sort_order: int = Field(default=0)   # For drag-and-drop ordering within namespace
    color: Optional[str] = None          # Hex color code (e.g., "#22c55e") for UI display

    # Account-specific fields (only used when namespace="account")
    due_day: Optional[int] = None        # Day of month payment is due (1-31)
    credit_limit: Optional[float] = None  # Credit limit for credit card accounts

    # Note: Unique constraint on (namespace, value) added via migration

    # Relationships
    transactions: List["Transaction"] = Relationship(back_populates="tags", link_model=TransactionTag)


class TagCreate(SQLModel):
    namespace: str
    value: str
    description: Optional[str] = None


class TagUpdate(SQLModel):
    value: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    color: Optional[str] = None
    due_day: Optional[int] = None        # For account tags: day of month payment is due
    credit_limit: Optional[float] = None  # For account tags: credit limit

class Transaction(BaseModel, table=True):
    """Transaction model"""
    __tablename__ = "transactions"

    # Pydantic config for proper enum serialization
    model_config = {"use_enum_values": True}

    date: date_type = Field(index=True)
    amount: float  # positive=income, negative=expense
    description: str  # raw description from bank
    merchant: Optional[str] = Field(default=None, index=True)  # extracted/cleaned merchant name
    account_source: str = Field(index=True)  # e.g., "BOFA-Checking", "AMEX-53004" (kept for display)
    account_tag_id: Optional[int] = Field(default=None, foreign_key="tags.id", index=True)  # FK to account tag
    card_member: Optional[str] = None  # e.g., "JOSEPH W SEYMOUR"
    category: Optional[str] = Field(default=None, index=True)  # DEPRECATED: use tags instead
    reconciliation_status: ReconciliationStatus = Field(
        default=ReconciliationStatus.unreconciled,
        index=True
    )
    notes: Optional[str] = None
    reference_id: Optional[str] = Field(default=None, index=True)  # original bank reference/transaction ID
    import_session_id: Optional[int] = Field(default=None, foreign_key="import_sessions.id", index=True)
    content_hash: Optional[str] = Field(default=None, index=True)  # SHA256 hash for reliable deduplication
    is_transfer: bool = Field(default=False, index=True)  # True if internal transfer (excluded from spending)
    linked_transaction_id: Optional[int] = Field(default=None, foreign_key="transactions.id", index=True)  # Link paired transfers

    # Relationships
    tags: List["Tag"] = Relationship(back_populates="transactions", link_model=TransactionTag)
    account_tag: Optional["Tag"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Transaction.account_tag_id]"}
    )
    linked_transaction: Optional["Transaction"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[Transaction.linked_transaction_id]", "remote_side": "[Transaction.id]"}
    )

class TransactionCreate(SQLModel):
    date: date_type
    amount: float
    description: str
    merchant: Optional[str] = None
    account_source: str
    card_member: Optional[str] = None
    category: Optional[str] = None
    reconciliation_status: ReconciliationStatus = ReconciliationStatus.unreconciled
    notes: Optional[str] = None
    reference_id: Optional[str] = None
    content_hash: Optional[str] = None  # Optional - auto-generated if not provided
    is_transfer: bool = False
    linked_transaction_id: Optional[int] = None

class TransactionUpdate(SQLModel):
    date: Optional[date_type] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    merchant: Optional[str] = None
    account_source: Optional[str] = None
    account_tag_id: Optional[int] = None  # FK to account tag (can be set to clear account)
    card_member: Optional[str] = None
    category: Optional[str] = None
    reconciliation_status: Optional[ReconciliationStatus] = None
    notes: Optional[str] = None
    reference_id: Optional[str] = None
    content_hash: Optional[str] = None
    is_transfer: Optional[bool] = None
    linked_transaction_id: Optional[int] = None

class ImportFormat(BaseModel, table=True):
    """Saved import format preferences"""
    __tablename__ = "import_formats"

    account_source: str = Field(index=True, unique=True)  # e.g., "AMEX-53004", "BOFA-Checking"
    format_type: ImportFormatType  # bofa, amex, unknown
    custom_mappings: Optional[str] = None  # JSON string for custom column mappings if needed

class ImportFormatCreate(SQLModel):
    account_source: str
    format_type: ImportFormatType
    custom_mappings: Optional[str] = None

class ImportFormatUpdate(SQLModel):
    format_type: Optional[ImportFormatType] = None
    custom_mappings: Optional[str] = None

class ImportSession(BaseModel, table=True):
    """Tracks import batches for audit and rollback"""
    __tablename__ = "import_sessions"

    filename: str  # Original filename
    format_type: ImportFormatType
    account_source: Optional[str] = None
    transaction_count: int = 0
    duplicate_count: int = 0
    total_amount: float = 0.0  # Sum of imported transaction amounts
    date_range_start: Optional[date_type] = None
    date_range_end: Optional[date_type] = None
    status: str = Field(default="completed")  # completed, rolled_back
    batch_import_id: Optional[int] = Field(default=None, foreign_key="batch_import_sessions.id", index=True)


class BatchImportSession(BaseModel, table=True):
    """Tracks batch import operations (multiple files imported together)"""
    __tablename__ = "batch_import_sessions"

    total_files: int = 0
    imported_files: int = 0
    total_transactions: int = 0
    total_duplicates: int = 0
    status: str = Field(default="pending")  # pending, in_progress, completed

class BudgetPeriod(str, Enum):
    monthly = "monthly"
    yearly = "yearly"

class Budget(BaseModel, table=True):
    """Budget tracking model"""
    __tablename__ = "budgets"

    tag: str = Field(index=True)  # Tag in namespace:value format (e.g., "bucket:groceries")
    amount: float  # Budget limit
    period: BudgetPeriod = Field(default=BudgetPeriod.monthly)
    start_date: Optional[date_type] = None  # Optional: specific start date
    end_date: Optional[date_type] = None    # Optional: specific end date
    rollover_enabled: bool = Field(default=False)


class BudgetCreate(SQLModel):
    tag: str  # namespace:value format
    amount: float
    period: BudgetPeriod = BudgetPeriod.monthly
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    rollover_enabled: bool = False


class BudgetUpdate(SQLModel):
    tag: Optional[str] = None
    amount: Optional[float] = None
    period: Optional[BudgetPeriod] = None
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    rollover_enabled: Optional[bool] = None

class TagRule(BaseModel, table=True):
    """Tag auto-assignment rules (applies tags to transactions based on patterns)"""
    __tablename__ = "tag_rules"

    name: str  # User-friendly rule name
    tag: str = Field(index=True)  # Target tag in namespace:value format (e.g., "bucket:groceries")
    priority: int = Field(default=0, index=True)  # Higher = applied first
    enabled: bool = Field(default=True)

    # Match conditions (at least one must be specified)
    merchant_pattern: Optional[str] = None  # Substring or regex
    description_pattern: Optional[str] = None  # Substring or regex
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    account_source: Optional[str] = None

    # Match logic
    match_all: bool = Field(default=False)  # True: AND logic, False: OR logic

    # Stats
    match_count: int = Field(default=0)
    last_matched_date: Optional[datetime] = None


class TagRuleCreate(SQLModel):
    name: str
    tag: str  # namespace:value format
    priority: int = 0
    enabled: bool = True
    merchant_pattern: Optional[str] = None
    description_pattern: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    account_source: Optional[str] = None
    match_all: bool = False


class TagRuleUpdate(SQLModel):
    name: Optional[str] = None
    tag: Optional[str] = None
    priority: Optional[int] = None
    enabled: Optional[bool] = None
    merchant_pattern: Optional[str] = None
    description_pattern: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    account_source: Optional[str] = None
    match_all: Optional[bool] = None

class RecurringFrequency(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"

class RecurringStatus(str, Enum):
    active = "active"
    paused = "paused"
    ended = "ended"

class RecurringPattern(BaseModel, table=True):
    """Recurring transaction patterns (subscriptions, bills, etc.)"""
    __tablename__ = "recurring_patterns"

    merchant: str = Field(index=True)
    category: Optional[str] = None
    amount_min: float  # Min amount for fuzzy matching
    amount_max: float  # Max amount for fuzzy matching
    frequency: RecurringFrequency = Field(index=True)
    day_of_month: Optional[int] = None  # Expected day (for monthly)
    day_of_week: Optional[int] = None   # Expected day (for weekly, 0=Monday)
    last_seen_date: Optional[date_type] = None
    next_expected_date: Optional[date_type] = None
    confidence_score: float = Field(default=0.0)  # 0-1 confidence
    status: RecurringStatus = Field(default=RecurringStatus.active)

class RecurringPatternCreate(SQLModel):
    merchant: str
    category: Optional[str] = None
    amount_min: float
    amount_max: float
    frequency: RecurringFrequency
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    last_seen_date: Optional[date_type] = None
    next_expected_date: Optional[date_type] = None
    confidence_score: float = 0.0
    status: RecurringStatus = RecurringStatus.active

class RecurringPatternUpdate(SQLModel):
    merchant: Optional[str] = None
    category: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    frequency: Optional[RecurringFrequency] = None
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    last_seen_date: Optional[date_type] = None
    next_expected_date: Optional[date_type] = None
    confidence_score: Optional[float] = None
    status: Optional[RecurringStatus] = None


class MerchantAliasMatchType(str, Enum):
    exact = "exact"        # Exact string match (case-insensitive)
    contains = "contains"  # Pattern contained in merchant string
    regex = "regex"        # Regular expression match


class MerchantAlias(BaseModel, table=True):
    """Merchant alias for normalizing messy bank merchant names"""
    __tablename__ = "merchant_aliases"

    pattern: str = Field(index=True)        # Raw merchant string/pattern to match
    canonical_name: str = Field(index=True) # Clean display name
    match_type: MerchantAliasMatchType = Field(default=MerchantAliasMatchType.exact)
    priority: int = Field(default=0, index=True)  # Higher = applied first
    match_count: int = Field(default=0)     # Track how often this alias is used
    last_matched_date: Optional[datetime] = None


class MerchantAliasCreate(SQLModel):
    pattern: str
    canonical_name: str
    match_type: MerchantAliasMatchType = MerchantAliasMatchType.exact
    priority: int = 0


class MerchantAliasUpdate(SQLModel):
    pattern: Optional[str] = None
    canonical_name: Optional[str] = None
    match_type: Optional[MerchantAliasMatchType] = None
    priority: Optional[int] = None


class SavedFilter(BaseModel, table=True):
    """Saved search filters for quick access to common queries"""
    __tablename__ = "saved_filters"

    name: str = Field(index=True)  # User-friendly name like "Amazon purchases"
    description: Optional[str] = None

    # Filter criteria (stored as JSON-serialized strings for flexibility)
    accounts: Optional[str] = None  # JSON array of account values
    accounts_exclude: Optional[str] = None  # JSON array of excluded accounts
    tags: Optional[str] = None  # JSON array of namespace:value tags
    tags_exclude: Optional[str] = None  # JSON array of excluded tags
    search: Optional[str] = None  # Search text
    search_regex: bool = Field(default=False)  # Use regex for search
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    reconciliation_status: Optional[str] = None  # ReconciliationStatus value
    is_transfer: Optional[bool] = None
    category: Optional[str] = None  # Legacy category filter

    # Date range (relative or absolute)
    date_range_type: Optional[str] = None  # "relative" or "absolute"
    relative_days: Optional[int] = None  # e.g., 30 = last 30 days
    start_date: Optional[date_type] = None  # For absolute dates
    end_date: Optional[date_type] = None

    # Usage stats
    use_count: int = Field(default=0)
    last_used_at: Optional[datetime] = None
    is_pinned: bool = Field(default=False)  # Pinned filters appear at top


class SavedFilterCreate(SQLModel):
    name: str
    description: Optional[str] = None
    accounts: Optional[List[str]] = None
    accounts_exclude: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    tags_exclude: Optional[List[str]] = None
    search: Optional[str] = None
    search_regex: bool = False
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    reconciliation_status: Optional[ReconciliationStatus] = None
    is_transfer: Optional[bool] = None
    category: Optional[str] = None
    date_range_type: Optional[str] = None
    relative_days: Optional[int] = None
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    is_pinned: bool = False


class SavedFilterUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    accounts: Optional[List[str]] = None
    accounts_exclude: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    tags_exclude: Optional[List[str]] = None
    search: Optional[str] = None
    search_regex: Optional[bool] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    reconciliation_status: Optional[ReconciliationStatus] = None
    is_transfer: Optional[bool] = None
    category: Optional[str] = None
    date_range_type: Optional[str] = None
    relative_days: Optional[int] = None
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    is_pinned: Optional[bool] = None


# Split Transaction Models
class SplitItem(SQLModel):
    """A single split allocation for a transaction"""
    tag: str  # Format: "bucket:groceries" or just bucket value
    amount: float


class TransactionSplits(SQLModel):
    """Request model for setting transaction splits"""
    splits: List[SplitItem]


class TransactionSplitResponse(SQLModel):
    """Response model showing transaction splits"""
    transaction_id: int
    total_amount: float
    splits: List[SplitItem]
    unallocated: float  # Amount not assigned to any bucket


# Dashboard Widget Configuration Models
class DashboardWidget(BaseModel, table=True):
    """User's dashboard widget configuration"""
    __tablename__ = "dashboard_widgets"

    widget_type: str = Field(index=True)  # "summary", "velocity", "anomalies", "bucket_pie", "top_merchants", "trends"
    title: Optional[str] = None  # Custom title override
    position: int = Field(default=0)  # Order on dashboard
    width: str = Field(default="half")  # "full", "half", "third"
    is_visible: bool = Field(default=True)
    config: Optional[str] = None  # JSON string for widget-specific settings


class DashboardWidgetCreate(SQLModel):
    widget_type: str
    title: Optional[str] = None
    position: int = 0
    width: str = "half"
    is_visible: bool = True
    config: Optional[str] = None


class DashboardWidgetUpdate(SQLModel):
    title: Optional[str] = None
    position: Optional[int] = None
    width: Optional[str] = None
    is_visible: Optional[bool] = None
    config: Optional[str] = None


class DashboardLayoutUpdate(SQLModel):
    """Batch update for widget positions"""
    widgets: List[dict]  # [{"id": 1, "position": 0}, {"id": 2, "position": 1}, ...]
