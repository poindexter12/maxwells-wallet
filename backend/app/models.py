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
