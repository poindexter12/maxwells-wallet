from sqlmodel import SQLModel, Field
from datetime import datetime
from datetime import date as date_type
from typing import Optional
from enum import Enum

class ReconciliationStatus(str, Enum):
    unreconciled = "unreconciled"
    matched = "matched"
    manually_entered = "manually_entered"
    ignored = "ignored"

class ImportFormatType(str, Enum):
    bofa = "bofa"
    amex = "amex"
    unknown = "unknown"

class BaseModel(SQLModel):
    """Base model with common fields"""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Category(BaseModel, table=True):
    """Category for transaction classification"""
    __tablename__ = "categories"

    name: str = Field(index=True, unique=True)
    description: Optional[str] = None

class CategoryCreate(SQLModel):
    name: str
    description: Optional[str] = None

class CategoryUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None

class Transaction(BaseModel, table=True):
    """Transaction model"""
    __tablename__ = "transactions"

    date: date_type = Field(index=True)
    amount: float  # positive=income, negative=expense
    description: str  # raw description from bank
    merchant: Optional[str] = Field(default=None, index=True)  # extracted/cleaned merchant name
    account_source: str = Field(index=True)  # e.g., "BOFA-Checking", "AMEX-53004"
    card_member: Optional[str] = None  # e.g., "JOSEPH W SEYMOUR"
    category: Optional[str] = Field(default=None, index=True)  # user-assigned or auto-inferred
    reconciliation_status: ReconciliationStatus = Field(
        default=ReconciliationStatus.unreconciled,
        index=True
    )
    notes: Optional[str] = None
    reference_id: Optional[str] = Field(default=None, index=True)  # original bank reference/transaction ID

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

class TransactionUpdate(SQLModel):
    date: Optional[date_type] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    merchant: Optional[str] = None
    account_source: Optional[str] = None
    card_member: Optional[str] = None
    category: Optional[str] = None
    reconciliation_status: Optional[ReconciliationStatus] = None
    notes: Optional[str] = None
    reference_id: Optional[str] = None

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

class BudgetPeriod(str, Enum):
    monthly = "monthly"
    yearly = "yearly"

class Budget(BaseModel, table=True):
    """Budget tracking model"""
    __tablename__ = "budgets"

    category: str = Field(index=True)  # Category name
    amount: float  # Budget limit
    period: BudgetPeriod = Field(default=BudgetPeriod.monthly)
    start_date: Optional[date_type] = None  # Optional: specific start date
    end_date: Optional[date_type] = None    # Optional: specific end date
    rollover_enabled: bool = Field(default=False)

class BudgetCreate(SQLModel):
    category: str
    amount: float
    period: BudgetPeriod = BudgetPeriod.monthly
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    rollover_enabled: bool = False

class BudgetUpdate(SQLModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    period: Optional[BudgetPeriod] = None
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    rollover_enabled: Optional[bool] = None

class CategoryRule(BaseModel, table=True):
    """Category auto-categorization rules"""
    __tablename__ = "category_rules"

    name: str  # User-friendly rule name
    category: str = Field(index=True)  # Target category
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

class CategoryRuleCreate(SQLModel):
    name: str
    category: str
    priority: int = 0
    enabled: bool = True
    merchant_pattern: Optional[str] = None
    description_pattern: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    account_source: Optional[str] = None
    match_all: bool = False

class CategoryRuleUpdate(SQLModel):
    name: Optional[str] = None
    category: Optional[str] = None
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
