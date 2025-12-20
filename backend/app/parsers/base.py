"""
Base classes and dataclasses for the extensible CSV parser system.

This module provides the abstract base class that all format parsers must implement,
along with configuration dataclasses for declarative parser configuration.
"""

import csv
import io
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple


class AmountSign(Enum):
    """How negative amounts are represented in the CSV"""

    NEGATIVE_PREFIX = "negative_prefix"  # -50.00
    PARENTHESES = "parentheses"  # (50.00)
    PLUS_MINUS_PREFIX = "plus_minus"  # + $50.00 / - $50.00


@dataclass
class ColumnMapping:
    """Maps CSV columns to transaction fields"""

    date_column: str
    amount_column: str
    description_column: str
    reference_column: Optional[str] = None
    category_column: Optional[str] = None

    # Optional columns for specific formats
    card_member_column: Optional[str] = None
    account_column: Optional[str] = None
    from_column: Optional[str] = None  # For peer-to-peer (Venmo)
    to_column: Optional[str] = None
    status_column: Optional[str] = None
    type_column: Optional[str] = None


@dataclass
class AmountConfig:
    """Configuration for parsing amount values"""

    sign_convention: AmountSign = AmountSign.NEGATIVE_PREFIX
    currency_prefix: str = ""  # e.g., "$"
    invert_sign: bool = False  # Flip sign after parsing (for CC statements)
    thousands_separator: str = ","


@dataclass
class DateConfig:
    """Configuration for parsing date values"""

    format: str = "%m/%d/%Y"  # strptime format
    use_iso_format: bool = False  # Use datetime.fromisoformat() instead


@dataclass
class ParsedTransaction:
    """Normalized transaction output from all parsers"""

    date: date
    amount: float
    description: str
    merchant: str
    account_source: str
    reference_id: str
    card_member: Optional[str] = None
    suggested_category: Optional[str] = None
    source_category: Optional[str] = None  # Original category from source

    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses"""
        return {
            "date": self.date,
            "amount": self.amount,
            "description": self.description,
            "merchant": self.merchant,
            "account_source": self.account_source,
            "reference_id": self.reference_id,
            "card_member": self.card_member,
            "suggested_category": self.suggested_category,
            "amex_category": self.source_category,  # backwards compat
        }


class CSVFormatParser(ABC):
    """
    Abstract base class for CSV format parsers.

    To create a new parser:
    1. Subclass CSVFormatParser
    2. Set class attributes (format_key, format_name, column_mapping, etc.)
    3. Implement can_parse() for format detection
    4. Optionally override hooks (extract_merchant, should_skip_row, etc.)
    5. Decorate with @ParserRegistry.register

    Example:
        @ParserRegistry.register
        class MyBankParser(CSVFormatParser):
            format_key = "my_bank"
            format_name = "My Bank"
            column_mapping = ColumnMapping(
                date_column="Date",
                amount_column="Amount",
                description_column="Description"
            )

            def can_parse(self, csv_content: str) -> Tuple[bool, float]:
                if "My Bank" in csv_content[:500]:
                    return True, 0.9
                return False, 0.0
    """

    # Identity - must be set by subclass
    format_key: str = ""  # e.g., "amex_cc"
    format_name: str = ""  # e.g., "American Express"

    # Configuration - set by subclass
    column_mapping: Optional[ColumnMapping] = None
    amount_config: AmountConfig = field(default_factory=AmountConfig)
    date_config: DateConfig = field(default_factory=DateConfig)
    skip_header_rows: int = 0  # Rows to skip before CSV header

    def __init__(self):
        # Ensure configs have defaults if not set
        if self.amount_config is None:
            self.amount_config = AmountConfig()
        if self.date_config is None:
            self.date_config = DateConfig()

    @abstractmethod
    def can_parse(self, csv_content: str) -> Tuple[bool, float]:
        """
        Detect if this parser can handle the given CSV content.

        Returns:
            Tuple of (can_parse: bool, confidence: float 0.0-1.0)
        """
        pass

    # =========================================================================
    # Customization Hooks - Override as needed
    # =========================================================================

    def preprocess_content(self, csv_content: str) -> str:
        """
        Preprocess CSV content before parsing.
        Override to handle header rows, metadata, etc.

        Default: Skips `skip_header_rows` lines and returns the rest.
        """
        if self.skip_header_rows > 0:
            lines = csv_content.split("\n")
            return "\n".join(lines[self.skip_header_rows :])
        return csv_content

    def extract_merchant(self, row: Dict, description: str) -> str:
        """
        Extract merchant name from row data and description.
        Override for format-specific merchant extraction logic.

        Default: Returns first 50 chars of description.
        """
        return description[:50].strip() if description else ""

    def map_category(self, source_category: str) -> Optional[str]:
        """
        Map source category to normalized category.
        Override to provide format-specific category mapping.

        Default: Returns None (no mapping).
        """
        return None

    def should_skip_row(self, row: Dict) -> bool:
        """
        Determine if a row should be skipped.
        Override to filter out balance rows, payments, etc.

        Default: Skips rows with empty date or amount.
        """
        if self.column_mapping is None:
            return True
        date_col = self.column_mapping.date_column
        amount_col = self.column_mapping.amount_column
        date_val = row.get(date_col, "").strip() if date_col else ""
        amount_val = row.get(amount_col, "").strip() if amount_col else ""
        return not date_val or not amount_val

    def get_default_account_source(self, csv_content: str, row: Dict) -> str:
        """
        Get default account source if not provided.
        Override to extract from CSV content or row data.

        Default: Returns format_key in uppercase.
        """
        return self.format_key.upper()

    def get_reference_id(self, row: Dict[str, str], date_val: date, amount: float) -> str:
        """
        Generate reference ID for the transaction.
        Override for format-specific reference extraction.

        Default: Uses reference column if available, else generates from date/amount.
        """
        if self.column_mapping and self.column_mapping.reference_column:
            ref = row.get(self.column_mapping.reference_column, "").strip()
            if ref:
                return ref
        return f"{self.format_key}_{date_val}_{amount}"

    # =========================================================================
    # Amount Parsing
    # =========================================================================

    def parse_amount(self, amount_str: str) -> Optional[float]:
        """Parse amount string according to amount_config."""
        if not amount_str:
            return None

        config = self.amount_config
        clean = amount_str.strip()

        # Remove currency prefix
        if config.currency_prefix:
            clean = clean.replace(config.currency_prefix, "")

        # Remove thousands separator
        clean = clean.replace(config.thousands_separator, "")

        # Handle different sign conventions
        is_negative = False

        if config.sign_convention == AmountSign.PARENTHESES:
            if clean.startswith("(") and clean.endswith(")"):
                clean = clean[1:-1]
                is_negative = True
        elif config.sign_convention == AmountSign.PLUS_MINUS_PREFIX:
            clean = clean.replace(" ", "")
            if clean.startswith("+"):
                clean = clean[1:]
            elif clean.startswith("-"):
                clean = clean[1:]
                is_negative = True
        else:  # NEGATIVE_PREFIX
            if clean.startswith("-"):
                clean = clean[1:]
                is_negative = True

        try:
            amount = float(clean)
        except ValueError:
            return None

        if is_negative:
            amount = -amount

        if config.invert_sign:
            amount = -amount

        return amount

    # =========================================================================
    # Date Parsing
    # =========================================================================

    def parse_date(self, date_str: str) -> Optional[date]:
        """Parse date string according to date_config."""
        if not date_str:
            return None

        date_str = date_str.strip()

        try:
            if self.date_config.use_iso_format:
                return datetime.fromisoformat(date_str).date()
            else:
                return datetime.strptime(date_str, self.date_config.format).date()
        except ValueError:
            return None

    # =========================================================================
    # Main Parse Method
    # =========================================================================

    def parse(self, csv_content: str, account_source: Optional[str] = None) -> List[ParsedTransaction]:
        """
        Parse CSV content and return normalized transactions.

        Uses declarative configuration + hooks for customization.
        Most parsers won't need to override this method.
        """
        if self.column_mapping is None:
            raise ValueError("column_mapping must be set before parsing")

        transactions = []

        # Preprocess content (handle header rows, etc.)
        content = self.preprocess_content(csv_content)

        reader = csv.DictReader(io.StringIO(content))

        for row in reader:
            # Check if row should be skipped
            if self.should_skip_row(row):
                continue

            # Parse date
            date_col = self.column_mapping.date_column
            date_str = row.get(date_col, "").strip()
            trans_date = self.parse_date(date_str)
            if trans_date is None:
                continue

            # Parse amount
            amount_col = self.column_mapping.amount_column
            amount_str = row.get(amount_col, "").strip()
            amount = self.parse_amount(amount_str)
            if amount is None:
                continue

            # Get description
            desc_col = self.column_mapping.description_column
            description = row.get(desc_col, "").strip()

            # Extract merchant
            merchant = self.extract_merchant(row, description)

            # Determine account source
            effective_account = account_source
            if not effective_account:
                effective_account = self.get_default_account_source(csv_content, row)

            # Get reference ID
            reference_id = self.get_reference_id(row, trans_date, amount)

            # Get card member if applicable
            card_member = None
            if self.column_mapping.card_member_column:
                card_member = row.get(self.column_mapping.card_member_column, "").strip()

            # Map category
            source_category = None
            suggested_category = None
            if self.column_mapping.category_column:
                source_category = row.get(self.column_mapping.category_column, "").strip()
                if source_category:
                    suggested_category = self.map_category(source_category)

            transactions.append(
                ParsedTransaction(
                    date=trans_date,
                    amount=amount,
                    description=description,
                    merchant=merchant,
                    account_source=effective_account,
                    reference_id=reference_id,
                    card_member=card_member,
                    suggested_category=suggested_category,
                    source_category=source_category,
                )
            )

        return transactions
