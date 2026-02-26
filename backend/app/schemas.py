"""
Pydantic schemas for API request/response validation.

This module contains all Pydantic models for FastAPI endpoints.
ORM models are in orm.py - these are separate for proper type checking.
"""

from datetime import datetime, date as date_type
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field

# Import enums from orm (shared between ORM and schemas)
from app.orm import (
    ReconciliationStatus,
    DateRangeType,
    ImportFormatType,
    BudgetPeriod,
    RecurringFrequency,
    RecurringStatus,
    MerchantAliasMatchType,
    LanguagePreference,
)

# Re-export enums for convenience
__all__ = [
    "ReconciliationStatus",
    "DateRangeType",
    "ImportFormatType",
    "BudgetPeriod",
    "RecurringFrequency",
    "RecurringStatus",
    "MerchantAliasMatchType",
    "LanguagePreference",
]


# ============================================================================
# Base Response Mixin
# ============================================================================


class BaseResponse(BaseModel):
    """Base for ORM response models with from_attributes enabled."""

    model_config = ConfigDict(from_attributes=True)


class TimestampResponse(BaseResponse):
    """Base response with timestamp fields."""

    id: int
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Tag Schemas
# ============================================================================


class TagCreate(BaseModel):
    namespace: str
    value: str
    description: Optional[str] = None
    due_day: Optional[int] = Field(None, ge=1, le=28, description="Due day must be between 1-28")


class TagUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    color: Optional[str] = None
    due_day: Optional[int] = Field(None, ge=1, le=28, description="Due day must be between 1-28")
    credit_limit: Optional[float] = None


class TagResponse(TimestampResponse):
    namespace: str
    value: str
    description: Optional[str] = None
    sort_order: int
    color: Optional[str] = None
    due_day: Optional[int] = None
    credit_limit: Optional[float] = None


# ============================================================================
# Transaction Schemas
# ============================================================================


class TransactionCreate(BaseModel):
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
    content_hash: Optional[str] = None
    is_transfer: bool = False
    linked_transaction_id: Optional[int] = None


class TransactionUpdate(BaseModel):
    date: Optional[date_type] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    merchant: Optional[str] = None
    account_source: Optional[str] = None
    account_tag_id: Optional[int] = None
    card_member: Optional[str] = None
    category: Optional[str] = None
    reconciliation_status: Optional[ReconciliationStatus] = None
    notes: Optional[str] = None
    reference_id: Optional[str] = None
    content_hash: Optional[str] = None
    is_transfer: Optional[bool] = None
    linked_transaction_id: Optional[int] = None


class TransactionResponse(TimestampResponse):
    date: date_type
    amount: float
    description: str
    merchant: Optional[str] = None
    account_source: str
    account_tag_id: Optional[int] = None
    card_member: Optional[str] = None
    category: Optional[str] = None
    reconciliation_status: str
    notes: Optional[str] = None
    reference_id: Optional[str] = None
    import_session_id: Optional[int] = None
    content_hash: Optional[str] = None
    content_hash_no_account: Optional[str] = None
    is_transfer: bool
    linked_transaction_id: Optional[int] = None
    tags: List[TagResponse] = []


class PaginatedTransactions(BaseModel):
    """Paginated transaction response."""

    items: List[TransactionResponse]
    next_cursor: Optional[str] = None
    has_more: bool = False


# ============================================================================
# Split Transaction Schemas
# ============================================================================


class SplitItem(BaseModel):
    """A single split allocation for a transaction."""

    tag: str  # Format: "bucket:groceries" or just bucket value
    amount: float


class TransactionSplits(BaseModel):
    """Request model for setting transaction splits."""

    splits: List[SplitItem]


class TransactionSplitResponse(BaseModel):
    """Response model showing transaction splits."""

    transaction_id: int
    total_amount: float
    splits: List[SplitItem]
    unallocated: float


# ============================================================================
# Import Format Schemas
# ============================================================================


class ImportFormatCreate(BaseModel):
    account_source: str
    format_type: ImportFormatType
    custom_mappings: Optional[str] = None


class ImportFormatUpdate(BaseModel):
    format_type: Optional[ImportFormatType] = None
    custom_mappings: Optional[str] = None


class ImportFormatResponse(TimestampResponse):
    account_source: str
    format_type: str
    custom_mappings: Optional[str] = None


# ============================================================================
# Custom Format Config Schemas
# ============================================================================


class CustomFormatConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config_json: str
    header_signature: Optional[str] = None


class CustomFormatConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config_json: Optional[str] = None
    header_signature: Optional[str] = None


class CustomFormatConfigResponse(TimestampResponse):
    name: str
    description: Optional[str] = None
    config_json: str
    use_count: int
    header_signature: Optional[str] = None


# ============================================================================
# Import Session Schemas
# ============================================================================


class ImportSessionResponse(TimestampResponse):
    filename: str
    format_type: str
    account_source: Optional[str] = None
    transaction_count: int
    duplicate_count: int
    total_amount: float
    date_range_start: Optional[date_type] = None
    date_range_end: Optional[date_type] = None
    status: str
    batch_import_id: Optional[int] = None


class BatchImportSessionResponse(TimestampResponse):
    total_files: int
    imported_files: int
    total_transactions: int
    total_duplicates: int
    status: str


# ============================================================================
# Budget Schemas
# ============================================================================


class BudgetCreate(BaseModel):
    tag: str  # namespace:value format
    amount: float = Field(gt=0, description="Budget amount must be positive")
    period: BudgetPeriod = BudgetPeriod.monthly
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    rollover_enabled: bool = False


class BudgetUpdate(BaseModel):
    tag: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0, description="Budget amount must be positive")
    period: Optional[BudgetPeriod] = None
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    rollover_enabled: Optional[bool] = None


class BudgetResponse(TimestampResponse):
    tag: str
    amount: float
    period: str
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    rollover_enabled: bool


# ============================================================================
# Tag Rule Schemas
# ============================================================================


class TagRuleCreate(BaseModel):
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


class TagRuleUpdate(BaseModel):
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


class TagRuleResponse(TimestampResponse):
    name: str
    tag: str
    priority: int
    enabled: bool
    merchant_pattern: Optional[str] = None
    description_pattern: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    account_source: Optional[str] = None
    match_all: bool
    match_count: int
    last_matched_date: Optional[datetime] = None


# ============================================================================
# Recurring Pattern Schemas
# ============================================================================


class RecurringPatternCreate(BaseModel):
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


class RecurringPatternUpdate(BaseModel):
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


class RecurringPatternResponse(TimestampResponse):
    merchant: str
    category: Optional[str] = None
    amount_min: float
    amount_max: float
    frequency: str
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    last_seen_date: Optional[date_type] = None
    next_expected_date: Optional[date_type] = None
    confidence_score: float
    status: str


# ============================================================================
# Merchant Alias Schemas
# ============================================================================


class MerchantAliasCreate(BaseModel):
    pattern: str
    canonical_name: str
    match_type: MerchantAliasMatchType = MerchantAliasMatchType.exact
    priority: int = 0


class MerchantAliasUpdate(BaseModel):
    pattern: Optional[str] = None
    canonical_name: Optional[str] = None
    match_type: Optional[MerchantAliasMatchType] = None
    priority: Optional[int] = None


class MerchantAliasResponse(TimestampResponse):
    pattern: str
    canonical_name: str
    match_type: str
    priority: int
    match_count: int
    last_matched_date: Optional[datetime] = None


# ============================================================================
# Saved Filter Schemas
# ============================================================================


class SavedFilterCreate(BaseModel):
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


class SavedFilterUpdate(BaseModel):
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


class SavedFilterResponse(TimestampResponse):
    name: str
    description: Optional[str] = None
    accounts: Optional[str] = None
    accounts_exclude: Optional[str] = None
    tags: Optional[str] = None
    tags_exclude: Optional[str] = None
    search: Optional[str] = None
    search_regex: bool
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    reconciliation_status: Optional[str] = None
    is_transfer: Optional[bool] = None
    category: Optional[str] = None
    date_range_type: Optional[str] = None
    relative_days: Optional[int] = None
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    use_count: int
    last_used_at: Optional[datetime] = None
    is_pinned: bool


# ============================================================================
# Dashboard Schemas
# ============================================================================


class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    date_range_type: DateRangeType = DateRangeType.mtd
    is_default: bool = False
    position: int = 0


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    date_range_type: Optional[DateRangeType] = None
    is_default: Optional[bool] = None
    position: Optional[int] = None


class DashboardResponse(TimestampResponse):
    name: str
    description: Optional[str] = None
    date_range_type: str
    is_default: bool
    position: int


# ============================================================================
# Dashboard Widget Schemas
# ============================================================================


class DashboardWidgetCreate(BaseModel):
    dashboard_id: Optional[int] = None
    widget_type: str
    position: int = 0
    width: str = "half"
    is_visible: bool = True
    config: Optional[str] = None


class DashboardWidgetUpdate(BaseModel):
    position: Optional[int] = None
    width: Optional[str] = None
    is_visible: Optional[bool] = None
    config: Optional[str] = None


class DashboardWidgetResponse(TimestampResponse):
    dashboard_id: Optional[int] = None
    widget_type: str
    position: int
    width: str
    is_visible: bool
    config: Optional[str] = None


class DashboardLayoutUpdate(BaseModel):
    """Batch update for widget positions."""

    widgets: List[dict]  # [{"id": 1, "position": 0}, ...]


# ============================================================================
# App Settings Schemas
# ============================================================================


class AppSettingsUpdate(BaseModel):
    language: Optional[LanguagePreference] = None


class AppSettingsResponse(TimestampResponse):
    language: str


# ============================================================================
# User / Auth Schemas
# ============================================================================


class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseResponse):
    id: int
    username: str
    created_at: datetime


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ============================================================================
# Tag Order Schemas (used in tags router)
# ============================================================================


class TagOrderItem(BaseModel):
    id: int
    sort_order: int


class TagOrderUpdate(BaseModel):
    tags: List[TagOrderItem]
