"""
SQLAlchemy ORM models for Maxwell's Wallet.

This module contains all database table definitions using SQLAlchemy 2.0
declarative mapping with proper type annotations for mypy support.
"""

from datetime import datetime, date as date_type
from typing import Optional, List
from enum import Enum

from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Date,
    Text,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# ============================================================================
# Base Classes
# ============================================================================


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""

    pass


class TimestampMixin:
    """Mixin providing created_at and updated_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )


# ============================================================================
# Enums (shared between ORM and Pydantic)
# ============================================================================


class ReconciliationStatus(str, Enum):
    unreconciled = "unreconciled"
    matched = "matched"
    manually_entered = "manually_entered"
    ignored = "ignored"


class DateRangeType(str, Enum):
    """Relative date range types for dashboards"""

    mtd = "mtd"  # Month to Date
    qtd = "qtd"  # Quarter to Date
    ytd = "ytd"  # Year to Date
    last_30_days = "last_30_days"
    last_90_days = "last_90_days"
    last_year = "last_year"


class ImportFormatType(str, Enum):
    bofa_bank = "bofa_bank"
    bofa_cc = "bofa_cc"
    amex_cc = "amex_cc"
    inspira_hsa = "inspira_hsa"
    venmo = "venmo"
    qif = "qif"
    qfx = "qfx"
    custom = "custom"
    unknown = "unknown"


class BudgetPeriod(str, Enum):
    monthly = "monthly"
    yearly = "yearly"


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


class MerchantAliasMatchType(str, Enum):
    exact = "exact"
    contains = "contains"
    regex = "regex"


class LanguagePreference(str, Enum):
    browser = "browser"
    en_us = "en-US"
    en_gb = "en-GB"
    es_es = "es-ES"
    fr_fr = "fr-FR"
    it_it = "it-IT"
    pt_pt = "pt-PT"
    de_de = "de-DE"
    nl_nl = "nl-NL"
    pseudo = "pseudo"


# ============================================================================
# Junction Tables
# ============================================================================


class TransactionTag(Base):
    """Junction table linking transactions to tags with optional split amounts."""

    __tablename__ = "transaction_tags"

    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)
    amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


# ============================================================================
# Core Models
# ============================================================================


class Tag(TimestampMixin, Base):
    """Namespaced tag for flexible transaction classification."""

    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("namespace", "value", name="uq_tags_namespace_value"),
        {"extend_existing": True},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    namespace: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Account-specific fields
    due_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    credit_limit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    # Use lazy="selectin" for async compatibility
    transactions: Mapped[List["Transaction"]] = relationship(
        back_populates="tags", secondary="transaction_tags", lazy="selectin"
    )


class Transaction(TimestampMixin, Base):
    """Financial transaction record."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date_type] = mapped_column(Date, index=True)
    amount: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(String)
    merchant: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    account_source: Mapped[str] = mapped_column(String, index=True)
    account_tag_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tags.id"), index=True, nullable=True
    )
    card_member: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    reconciliation_status: Mapped[str] = mapped_column(
        String, index=True, default=ReconciliationStatus.unreconciled.value
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(
        String, index=True, nullable=True
    )
    import_session_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("import_sessions.id"), index=True, nullable=True
    )
    content_hash: Mapped[Optional[str]] = mapped_column(
        String, index=True, nullable=True
    )
    content_hash_no_account: Mapped[Optional[str]] = mapped_column(
        String, index=True, nullable=True
    )
    is_transfer: Mapped[bool] = mapped_column(Boolean, index=True, default=False)
    linked_transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("transactions.id"), index=True, nullable=True
    )

    # Relationships
    # Use lazy="selectin" for async compatibility - eager loads in separate SELECT
    tags: Mapped[List["Tag"]] = relationship(
        back_populates="transactions", secondary="transaction_tags", lazy="selectin"
    )
    account_tag: Mapped[Optional["Tag"]] = relationship(
        foreign_keys=[account_tag_id], lazy="selectin"
    )
    linked_transaction: Mapped[Optional["Transaction"]] = relationship(
        foreign_keys=[linked_transaction_id], remote_side="Transaction.id", lazy="selectin"
    )


class ImportFormat(TimestampMixin, Base):
    """Saved import format preferences."""

    __tablename__ = "import_formats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_source: Mapped[str] = mapped_column(String, index=True, unique=True)
    format_type: Mapped[str] = mapped_column(String)
    custom_mappings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CustomFormatConfig(TimestampMixin, Base):
    """Named custom CSV format configurations."""

    __tablename__ = "custom_format_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, index=True, unique=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    config_json: Mapped[str] = mapped_column(Text)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    header_signature: Mapped[Optional[str]] = mapped_column(
        String, index=True, nullable=True
    )


class ImportSession(TimestampMixin, Base):
    """Tracks import batches for audit and rollback."""

    __tablename__ = "import_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String)
    format_type: Mapped[str] = mapped_column(String)
    account_source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    transaction_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    date_range_start: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)
    date_range_end: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="completed")
    batch_import_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("batch_import_sessions.id"), index=True, nullable=True
    )


class BatchImportSession(TimestampMixin, Base):
    """Tracks batch import operations."""

    __tablename__ = "batch_import_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    imported_files: Mapped[int] = mapped_column(Integer, default=0)
    total_transactions: Mapped[int] = mapped_column(Integer, default=0)
    total_duplicates: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="pending")


class Budget(TimestampMixin, Base):
    """Budget tracking model."""

    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tag: Mapped[str] = mapped_column(String, index=True)
    amount: Mapped[float] = mapped_column(Float)
    period: Mapped[str] = mapped_column(String, default=BudgetPeriod.monthly.value)
    start_date: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)
    rollover_enabled: Mapped[bool] = mapped_column(Boolean, default=False)


class TagRule(TimestampMixin, Base):
    """Tag auto-assignment rules."""

    __tablename__ = "tag_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    tag: Mapped[str] = mapped_column(String, index=True)
    priority: Mapped[int] = mapped_column(Integer, index=True, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Match conditions
    merchant_pattern: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description_pattern: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    amount_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    account_source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    match_all: Mapped[bool] = mapped_column(Boolean, default=False)

    # Stats
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    last_matched_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )


class RecurringPattern(TimestampMixin, Base):
    """Recurring transaction patterns."""

    __tablename__ = "recurring_patterns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    merchant: Mapped[str] = mapped_column(String, index=True)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    amount_min: Mapped[float] = mapped_column(Float)
    amount_max: Mapped[float] = mapped_column(Float)
    frequency: Mapped[str] = mapped_column(String, index=True)
    day_of_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    day_of_week: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_seen_date: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)
    next_expected_date: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String, default=RecurringStatus.active.value)


class MerchantAlias(TimestampMixin, Base):
    """Merchant alias for normalizing merchant names."""

    __tablename__ = "merchant_aliases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pattern: Mapped[str] = mapped_column(String, index=True)
    canonical_name: Mapped[str] = mapped_column(String, index=True)
    match_type: Mapped[str] = mapped_column(
        String, default=MerchantAliasMatchType.exact.value
    )
    priority: Mapped[int] = mapped_column(Integer, index=True, default=0)
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    last_matched_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )


class SavedFilter(TimestampMixin, Base):
    """Saved search filters."""

    __tablename__ = "saved_filters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Filter criteria (JSON strings)
    accounts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    accounts_exclude: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags_exclude: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    search: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    search_regex: Mapped[bool] = mapped_column(Boolean, default=False)
    amount_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reconciliation_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_transfer: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Date range
    date_range_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    relative_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_date: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)

    # Usage
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)


class Dashboard(TimestampMixin, Base):
    """Dashboard configuration."""

    __tablename__ = "dashboards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date_range_type: Mapped[str] = mapped_column(
        String, default=DateRangeType.mtd.value
    )
    is_default: Mapped[bool] = mapped_column(Boolean, index=True, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Deprecated fields (kept for backwards compatibility)
    view_mode: Mapped[str] = mapped_column(String, default="month")
    pinned_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    pinned_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    filter_buckets: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    filter_accounts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    filter_merchants: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    # Use lazy="selectin" for async compatibility
    widgets: Mapped[List["DashboardWidget"]] = relationship(
        back_populates="dashboard", lazy="selectin"
    )


class DashboardWidget(TimestampMixin, Base):
    """Dashboard widget configuration."""

    __tablename__ = "dashboard_widgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dashboard_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("dashboards.id"), index=True, nullable=True
    )
    widget_type: Mapped[str] = mapped_column(String, index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[str] = mapped_column(String, default="half")
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    # Use lazy="selectin" for async compatibility
    dashboard: Mapped[Optional["Dashboard"]] = relationship(
        back_populates="widgets", lazy="selectin"
    )


class AppSettings(TimestampMixin, Base):
    """Application-wide settings."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    language: Mapped[str] = mapped_column(
        String, default=LanguagePreference.browser.value
    )


class User(TimestampMixin, Base):
    """User account for authentication."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
