"""
Tests for ORM → Pydantic schema conversion.

These tests verify that:
1. ORM models convert correctly to Pydantic response schemas
2. Nested relationships serialize properly
3. from_attributes=True works for all response models
4. Optional fields and defaults are handled correctly
"""

import pytest
from datetime import datetime, date
from pydantic import ValidationError

from app.orm import (
    Tag,
    Transaction,
    Dashboard,
    DashboardWidget,
    Budget,
    TagRule,
    RecurringPattern,
    MerchantAlias,
    SavedFilter,
    ImportSession,
    ImportFormat,
    CustomFormatConfig,
    User,
    AppSettings,
)
from app.schemas import (
    TagResponse,
    TransactionResponse,
    DashboardResponse,
    DashboardWidgetResponse,
    BudgetResponse,
    TagRuleResponse,
    RecurringPatternResponse,
    MerchantAliasResponse,
    SavedFilterResponse,
    ImportSessionResponse,
    ImportFormatResponse,
    CustomFormatConfigResponse,
    UserResponse,
    AppSettingsResponse,
)


# ============================================================================
# Basic ORM → Schema Conversion Tests
# ============================================================================


class TestTagSchemaConversion:
    """Tests for Tag ORM → TagResponse conversion."""

    def test_basic_conversion(self):
        """Tag converts to TagResponse with all fields."""
        now = datetime.now()
        tag = Tag(
            id=1,
            namespace="bucket",
            value="groceries",
            description="Food purchases",
            sort_order=5,
            color="#ff0000",
            due_day=15,
            credit_limit=5000.0,
            created_at=now,
            updated_at=now,
        )

        response = TagResponse.model_validate(tag)

        assert response.id == 1
        assert response.namespace == "bucket"
        assert response.value == "groceries"
        assert response.description == "Food purchases"
        assert response.sort_order == 5
        assert response.color == "#ff0000"
        assert response.due_day == 15
        assert response.credit_limit == 5000.0
        assert response.created_at == now
        assert response.updated_at == now

    def test_optional_fields_none(self):
        """Tag with None optional fields converts correctly."""
        now = datetime.now()
        tag = Tag(
            id=2,
            namespace="account",
            value="checking",
            description=None,
            sort_order=0,
            color=None,
            due_day=None,
            credit_limit=None,
            created_at=now,
            updated_at=now,
        )

        response = TagResponse.model_validate(tag)

        assert response.description is None
        assert response.color is None
        assert response.due_day is None
        assert response.credit_limit is None


class TestTransactionSchemaConversion:
    """Tests for Transaction ORM → TransactionResponse conversion."""

    def test_basic_conversion(self):
        """Transaction converts with all scalar fields."""
        now = datetime.now()
        txn = Transaction(
            id=1,
            date=date(2024, 6, 15),
            amount=-75.50,
            description="Whole Foods purchase",
            merchant="Whole Foods",
            account_source="Chase",
            account_tag_id=5,
            card_member="JOHN DOE",
            category="groceries",
            reconciliation_status="matched",
            notes="Weekly groceries",
            reference_id="REF123",
            import_session_id=10,
            content_hash="abc123",
            content_hash_no_account="def456",
            is_transfer=False,
            linked_transaction_id=None,
            created_at=now,
            updated_at=now,
        )
        # Mock empty tags relationship
        txn.tags = []

        response = TransactionResponse.model_validate(txn)

        assert response.id == 1
        assert response.date == date(2024, 6, 15)
        assert response.amount == -75.50
        assert response.description == "Whole Foods purchase"
        assert response.merchant == "Whole Foods"
        assert response.account_source == "Chase"
        assert response.account_tag_id == 5
        assert response.card_member == "JOHN DOE"
        assert response.category == "groceries"
        assert response.reconciliation_status == "matched"
        assert response.notes == "Weekly groceries"
        assert response.is_transfer is False
        assert response.tags == []

    def test_conversion_with_tags(self):
        """Transaction with tags serializes nested tags correctly."""
        now = datetime.now()
        tag1 = Tag(
            id=1,
            namespace="bucket",
            value="groceries",
            sort_order=0,
            created_at=now,
            updated_at=now,
        )
        tag2 = Tag(
            id=2,
            namespace="occasion",
            value="holiday",
            sort_order=0,
            created_at=now,
            updated_at=now,
        )

        txn = Transaction(
            id=1,
            date=date.today(),
            amount=-100.0,
            description="Test",
            account_source="Test",
            reconciliation_status="unreconciled",
            is_transfer=False,
            created_at=now,
            updated_at=now,
        )
        txn.tags = [tag1, tag2]

        response = TransactionResponse.model_validate(txn)

        assert len(response.tags) == 2
        assert response.tags[0].namespace == "bucket"
        assert response.tags[0].value == "groceries"
        assert response.tags[1].namespace == "occasion"
        assert response.tags[1].value == "holiday"

    def test_transfer_with_linked_transaction(self):
        """Transfer transaction with linked_transaction_id."""
        now = datetime.now()
        txn = Transaction(
            id=2,
            date=date.today(),
            amount=500.0,
            description="Transfer in",
            account_source="Savings",
            reconciliation_status="matched",
            is_transfer=True,
            linked_transaction_id=1,
            created_at=now,
            updated_at=now,
        )
        txn.tags = []

        response = TransactionResponse.model_validate(txn)

        assert response.is_transfer is True
        assert response.linked_transaction_id == 1


class TestDashboardSchemaConversion:
    """Tests for Dashboard ORM → DashboardResponse conversion."""

    def test_basic_conversion(self):
        """Dashboard converts correctly."""
        now = datetime.now()
        dashboard = Dashboard(
            id=1,
            name="Main Dashboard",
            description="Primary view",
            date_range_type="mtd",
            is_default=True,
            position=0,
            created_at=now,
            updated_at=now,
        )

        response = DashboardResponse.model_validate(dashboard)

        assert response.id == 1
        assert response.name == "Main Dashboard"
        assert response.description == "Primary view"
        assert response.date_range_type == "mtd"
        assert response.is_default is True
        assert response.position == 0


class TestDashboardWidgetSchemaConversion:
    """Tests for DashboardWidget ORM → DashboardWidgetResponse conversion."""

    def test_basic_conversion(self):
        """Widget converts correctly."""
        now = datetime.now()
        widget = DashboardWidget(
            id=1,
            dashboard_id=5,
            widget_type="bucket_pie",
            position=2,
            width="half",
            is_visible=True,
            config='{"showLegend": true}',
            created_at=now,
            updated_at=now,
        )

        response = DashboardWidgetResponse.model_validate(widget)

        assert response.id == 1
        assert response.dashboard_id == 5
        assert response.widget_type == "bucket_pie"
        assert response.position == 2
        assert response.width == "half"
        assert response.is_visible is True
        assert response.config == '{"showLegend": true}'


class TestBudgetSchemaConversion:
    """Tests for Budget ORM → BudgetResponse conversion."""

    def test_basic_conversion(self):
        """Budget converts correctly."""
        now = datetime.now()
        budget = Budget(
            id=1,
            tag="bucket:groceries",
            amount=500.0,
            period="monthly",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            rollover_enabled=True,
            created_at=now,
            updated_at=now,
        )

        response = BudgetResponse.model_validate(budget)

        assert response.id == 1
        assert response.tag == "bucket:groceries"
        assert response.amount == 500.0
        assert response.period == "monthly"
        assert response.start_date == date(2024, 1, 1)
        assert response.end_date == date(2024, 12, 31)
        assert response.rollover_enabled is True


class TestTagRuleSchemaConversion:
    """Tests for TagRule ORM → TagRuleResponse conversion."""

    def test_basic_conversion(self):
        """TagRule converts correctly."""
        now = datetime.now()
        rule = TagRule(
            id=1,
            name="Grocery stores",
            tag="bucket:groceries",
            priority=10,
            enabled=True,
            merchant_pattern="Whole Foods|Trader.*",
            description_pattern=None,
            amount_min=-500.0,
            amount_max=0.0,
            account_source=None,
            match_all=False,
            match_count=42,
            last_matched_date=now,
            created_at=now,
            updated_at=now,
        )

        response = TagRuleResponse.model_validate(rule)

        assert response.id == 1
        assert response.name == "Grocery stores"
        assert response.tag == "bucket:groceries"
        assert response.priority == 10
        assert response.enabled is True
        assert response.merchant_pattern == "Whole Foods|Trader.*"
        assert response.match_count == 42
        assert response.last_matched_date == now


class TestMerchantAliasSchemaConversion:
    """Tests for MerchantAlias ORM → MerchantAliasResponse conversion."""

    def test_basic_conversion(self):
        """MerchantAlias converts correctly."""
        now = datetime.now()
        alias = MerchantAlias(
            id=1,
            pattern="AMZN*",
            canonical_name="Amazon",
            match_type="contains",
            priority=5,
            match_count=100,
            last_matched_date=now,
            created_at=now,
            updated_at=now,
        )

        response = MerchantAliasResponse.model_validate(alias)

        assert response.id == 1
        assert response.pattern == "AMZN*"
        assert response.canonical_name == "Amazon"
        assert response.match_type == "contains"
        assert response.priority == 5
        assert response.match_count == 100


class TestRecurringPatternSchemaConversion:
    """Tests for RecurringPattern ORM → RecurringPatternResponse conversion."""

    def test_basic_conversion(self):
        """RecurringPattern converts correctly."""
        now = datetime.now()
        today = date.today()
        pattern = RecurringPattern(
            id=1,
            merchant="Netflix",
            category="subscriptions",
            amount_min=-15.99,
            amount_max=-15.99,
            frequency="monthly",
            day_of_month=15,
            day_of_week=None,
            last_seen_date=today,
            next_expected_date=today,
            confidence_score=0.95,
            status="active",
            created_at=now,
            updated_at=now,
        )

        response = RecurringPatternResponse.model_validate(pattern)

        assert response.id == 1
        assert response.merchant == "Netflix"
        assert response.category == "subscriptions"
        assert response.frequency == "monthly"
        assert response.day_of_month == 15
        assert response.confidence_score == 0.95
        assert response.status == "active"


class TestImportSchemaConversion:
    """Tests for Import-related ORM → schema conversions."""

    def test_import_session_conversion(self):
        """ImportSession converts correctly."""
        now = datetime.now()
        session = ImportSession(
            id=1,
            filename="transactions.csv",
            format_type="bofa_bank",
            account_source="BofA Checking",
            transaction_count=50,
            duplicate_count=5,
            total_amount=-2500.0,
            date_range_start=date(2024, 1, 1),
            date_range_end=date(2024, 1, 31),
            status="completed",
            batch_import_id=None,
            created_at=now,
            updated_at=now,
        )

        response = ImportSessionResponse.model_validate(session)

        assert response.id == 1
        assert response.filename == "transactions.csv"
        assert response.format_type == "bofa_bank"
        assert response.transaction_count == 50
        assert response.duplicate_count == 5

    def test_import_format_conversion(self):
        """ImportFormat converts correctly."""
        now = datetime.now()
        fmt = ImportFormat(
            id=1,
            account_source="Chase",
            format_type="custom",
            custom_mappings='{"date": 0, "amount": 1}',
            created_at=now,
            updated_at=now,
        )

        response = ImportFormatResponse.model_validate(fmt)

        assert response.id == 1
        assert response.account_source == "Chase"
        assert response.format_type == "custom"
        assert response.custom_mappings == '{"date": 0, "amount": 1}'

    def test_custom_format_config_conversion(self):
        """CustomFormatConfig converts correctly."""
        now = datetime.now()
        config = CustomFormatConfig(
            id=1,
            name="My Bank Format",
            description="Custom format for my bank",
            config_json='{"delimiter": ","}',
            use_count=10,
            header_signature="Date,Amount,Description",
            created_at=now,
            updated_at=now,
        )

        response = CustomFormatConfigResponse.model_validate(config)

        assert response.id == 1
        assert response.name == "My Bank Format"
        assert response.use_count == 10
        assert response.header_signature == "Date,Amount,Description"


class TestUserSchemaConversion:
    """Tests for User ORM → UserResponse conversion."""

    def test_basic_conversion(self):
        """User converts correctly (excluding password_hash)."""
        now = datetime.now()
        user = User(
            id=1,
            username="testuser",
            password_hash="hashed_password_here",
            created_at=now,
            updated_at=now,
        )

        response = UserResponse.model_validate(user)

        assert response.id == 1
        assert response.username == "testuser"
        assert response.created_at == now
        # password_hash should NOT be in response
        assert not hasattr(response, "password_hash")


class TestAppSettingsSchemaConversion:
    """Tests for AppSettings ORM → AppSettingsResponse conversion."""

    def test_basic_conversion(self):
        """AppSettings converts correctly."""
        now = datetime.now()
        settings = AppSettings(
            id=1,
            language="en-US",
            created_at=now,
            updated_at=now,
        )

        response = AppSettingsResponse.model_validate(settings)

        assert response.id == 1
        assert response.language == "en-US"


class TestSavedFilterSchemaConversion:
    """Tests for SavedFilter ORM → SavedFilterResponse conversion."""

    def test_basic_conversion(self):
        """SavedFilter converts correctly."""
        now = datetime.now()
        filter_obj = SavedFilter(
            id=1,
            name="Groceries this month",
            description="All grocery spending",
            accounts='["chase", "bofa"]',
            accounts_exclude=None,
            tags='["bucket:groceries"]',
            tags_exclude=None,
            search=None,
            search_regex=False,
            amount_min=None,
            amount_max=None,
            reconciliation_status=None,
            is_transfer=False,
            category="groceries",
            date_range_type="mtd",
            relative_days=None,
            start_date=None,
            end_date=None,
            use_count=15,
            last_used_at=now,
            is_pinned=True,
            created_at=now,
            updated_at=now,
        )

        response = SavedFilterResponse.model_validate(filter_obj)

        assert response.id == 1
        assert response.name == "Groceries this month"
        assert response.accounts == '["chase", "bofa"]'
        assert response.tags == '["bucket:groceries"]'
        assert response.use_count == 15
        assert response.is_pinned is True


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================


class TestSchemaEdgeCases:
    """Edge case tests for schema conversion."""

    def test_transaction_with_empty_tags_list(self):
        """Transaction with empty tags list converts correctly."""
        now = datetime.now()
        txn = Transaction(
            id=1,
            date=date.today(),
            amount=-50.0,
            description="Test",
            account_source="Test",
            reconciliation_status="unreconciled",
            is_transfer=False,
            created_at=now,
            updated_at=now,
        )
        txn.tags = []

        response = TransactionResponse.model_validate(txn)
        assert response.tags == []

    def test_transaction_all_optional_fields_none(self):
        """Transaction with all optional fields as None."""
        now = datetime.now()
        txn = Transaction(
            id=1,
            date=date.today(),
            amount=-50.0,
            description="Minimal",
            account_source="Test",
            merchant=None,
            account_tag_id=None,
            card_member=None,
            category=None,
            reconciliation_status="unreconciled",
            notes=None,
            reference_id=None,
            import_session_id=None,
            content_hash=None,
            content_hash_no_account=None,
            is_transfer=False,
            linked_transaction_id=None,
            created_at=now,
            updated_at=now,
        )
        txn.tags = []

        response = TransactionResponse.model_validate(txn)

        assert response.merchant is None
        assert response.account_tag_id is None
        assert response.card_member is None
        assert response.category is None
        assert response.notes is None
        assert response.reference_id is None

    def test_model_validate_rejects_invalid_data(self):
        """Schema validation fails for invalid data."""
        with pytest.raises(ValidationError):
            # Missing required 'date' field
            TransactionResponse.model_validate(
                {"id": 1, "amount": 50.0, "description": "test"}
            )

    def test_conversion_preserves_datetime_precision(self):
        """Datetime fields preserve full precision."""
        precise_time = datetime(2024, 6, 15, 14, 30, 45, 123456)
        tag = Tag(
            id=1,
            namespace="test",
            value="test",
            sort_order=0,
            created_at=precise_time,
            updated_at=precise_time,
        )

        response = TagResponse.model_validate(tag)

        assert response.created_at == precise_time
        assert response.updated_at == precise_time
        assert response.created_at.microsecond == 123456

    def test_from_attributes_config_works(self):
        """ConfigDict(from_attributes=True) allows ORM object validation."""
        now = datetime.now()
        tag = Tag(
            id=1,
            namespace="test",
            value="value",
            sort_order=0,
            created_at=now,
            updated_at=now,
        )

        # This should work due to from_attributes=True
        response = TagResponse.model_validate(tag)
        assert response.id == 1

        # Dict validation should also work
        response_from_dict = TagResponse.model_validate(
            {
                "id": 2,
                "namespace": "test",
                "value": "value2",
                "sort_order": 0,
                "created_at": now,
                "updated_at": now,
            }
        )
        assert response_from_dict.id == 2
