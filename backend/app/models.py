"""
Models module - re-exports from orm.py and schemas.py.

This module exists for backwards compatibility during the SQLModel→SQLAlchemy migration.
New code should import directly from:
  - app.orm for ORM models (Tag, Transaction, etc.)
  - app.schemas for Pydantic schemas (TagCreate, TransactionResponse, etc.)
"""

# Re-export all ORM models
from app.orm import (
    Base,
    TimestampMixin,
    # Enums
    ReconciliationStatus,
    DateRangeType,
    ImportFormatType,
    BudgetPeriod,
    RecurringFrequency,
    RecurringStatus,
    MerchantAliasMatchType,
    LanguagePreference,
    # ORM Models
    TransactionTag,
    Tag,
    Transaction,
    ImportFormat,
    CustomFormatConfig,
    ImportSession,
    BatchImportSession,
    Budget,
    TagRule,
    RecurringPattern,
    MerchantAlias,
    SavedFilter,
    Dashboard,
    DashboardWidget,
    AppSettings,
    User,
)

# Re-export all Pydantic schemas
from app.schemas import (
    # Base classes
    BaseResponse,
    TimestampResponse,
    # Tag schemas
    TagCreate,
    TagUpdate,
    TagResponse,
    TagOrderItem,
    TagOrderUpdate,
    # Transaction schemas
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    PaginatedTransactions,
    # Split schemas
    SplitItem,
    TransactionSplits,
    TransactionSplitResponse,
    # Import format schemas
    ImportFormatCreate,
    ImportFormatUpdate,
    ImportFormatResponse,
    # Custom format config schemas
    CustomFormatConfigCreate,
    CustomFormatConfigUpdate,
    CustomFormatConfigResponse,
    # Import session schemas
    ImportSessionResponse,
    BatchImportSessionResponse,
    # Budget schemas
    BudgetCreate,
    BudgetUpdate,
    BudgetResponse,
    # Tag rule schemas
    TagRuleCreate,
    TagRuleUpdate,
    TagRuleResponse,
    # Recurring pattern schemas
    RecurringPatternCreate,
    RecurringPatternUpdate,
    RecurringPatternResponse,
    # Merchant alias schemas
    MerchantAliasCreate,
    MerchantAliasUpdate,
    MerchantAliasResponse,
    # Saved filter schemas
    SavedFilterCreate,
    SavedFilterUpdate,
    SavedFilterResponse,
    # Dashboard schemas
    DashboardCreate,
    DashboardUpdate,
    DashboardResponse,
    # Dashboard widget schemas
    DashboardWidgetCreate,
    DashboardWidgetUpdate,
    DashboardWidgetResponse,
    DashboardLayoutUpdate,
    # App settings schemas
    AppSettingsUpdate,
    AppSettingsResponse,
    # User/auth schemas
    UserCreate,
    UserResponse,
    PasswordChange,
)

# Backwards compatibility alias - SQLModel's BaseModel was used as our base
# Now use the ORM Base class, but keep BaseModel name for compatibility
BaseModel = Base

__all__ = [
    # Base classes
    "Base",
    "BaseModel",
    "TimestampMixin",
    # Enums
    "ReconciliationStatus",
    "DateRangeType",
    "ImportFormatType",
    "BudgetPeriod",
    "RecurringFrequency",
    "RecurringStatus",
    "MerchantAliasMatchType",
    "LanguagePreference",
    # ORM Models
    "TransactionTag",
    "Tag",
    "Transaction",
    "ImportFormat",
    "CustomFormatConfig",
    "ImportSession",
    "BatchImportSession",
    "Budget",
    "TagRule",
    "RecurringPattern",
    "MerchantAlias",
    "SavedFilter",
    "Dashboard",
    "DashboardWidget",
    "AppSettings",
    "User",
    # Pydantic Schemas
    "BaseResponse",
    "TimestampResponse",
    "TagCreate",
    "TagUpdate",
    "TagResponse",
    "TagOrderItem",
    "TagOrderUpdate",
    "TransactionCreate",
    "TransactionUpdate",
    "TransactionResponse",
    "PaginatedTransactions",
    "SplitItem",
    "TransactionSplits",
    "TransactionSplitResponse",
    "ImportFormatCreate",
    "ImportFormatUpdate",
    "ImportFormatResponse",
    "CustomFormatConfigCreate",
    "CustomFormatConfigUpdate",
    "CustomFormatConfigResponse",
    "ImportSessionResponse",
    "BatchImportSessionResponse",
    "BudgetCreate",
    "BudgetUpdate",
    "BudgetResponse",
    "TagRuleCreate",
    "TagRuleUpdate",
    "TagRuleResponse",
    "RecurringPatternCreate",
    "RecurringPatternUpdate",
    "RecurringPatternResponse",
    "MerchantAliasCreate",
    "MerchantAliasUpdate",
    "MerchantAliasResponse",
    "SavedFilterCreate",
    "SavedFilterUpdate",
    "SavedFilterResponse",
    "DashboardCreate",
    "DashboardUpdate",
    "DashboardResponse",
    "DashboardWidgetCreate",
    "DashboardWidgetUpdate",
    "DashboardWidgetResponse",
    "DashboardLayoutUpdate",
    "AppSettingsUpdate",
    "AppSettingsResponse",
    "UserCreate",
    "UserResponse",
    "PasswordChange",
]
