"""
American Express Credit Card CSV Parser

Format characteristics:
- Headers: Date,Description,Card Member,Account #,Amount,Reference,Category
- Date format: MM/DD/YYYY
- Amount: positive = charge, negative = credit/refund (inverted from our convention)
- Has category column that we map to our categories
- Description has multiple space-separated parts
"""

import re
from typing import Dict, Optional, Tuple

from ..base import (
    CSVFormatParser,
    ColumnMapping,
    AmountConfig,
    DateConfig,
    AmountSign,
    ParsedTransaction,
)
from ..registry import ParserRegistry


@ParserRegistry.register
class AmexCCParser(CSVFormatParser):
    """Parser for American Express Credit Card CSV exports."""

    format_key = "amex_cc"
    format_name = "American Express"

    column_mapping = ColumnMapping(
        date_column="Date",
        amount_column="Amount",
        description_column="Description",
        reference_column="Reference",
        category_column="Category",
        card_member_column="Card Member",
        account_column="Account #",
    )

    amount_config = AmountConfig(
        sign_convention=AmountSign.NEGATIVE_PREFIX,
        thousands_separator=",",
        invert_sign=True,  # AMEX: positive = charge, we want negative for expenses
    )

    date_config = DateConfig(
        format="%m/%d/%Y",
    )

    # AMEX category mapping to our simplified categories
    CATEGORY_MAP = {
        'restaurant': 'Dining & Coffee',
        'bar & café': 'Dining & Coffee',
        'merchandise': 'Shopping',
        'retail': 'Shopping',
        'wholesale': 'Shopping',
        'entertainment': 'Entertainment',
        'health care': 'Healthcare',
        'education': 'Education',
        'government': 'Transportation',
        'toll': 'Transportation',
        'computer': 'Subscriptions',
        'internet': 'Subscriptions',
        'telecom': 'Utilities',
        'communications': 'Utilities',
    }

    def can_parse(self, csv_content: str) -> Tuple[bool, float]:
        """Detect AMEX format by looking for 'Card Member' and 'Account #' columns."""
        lines = csv_content.strip().split('\n')
        for line in lines[:10]:
            if 'Card Member' in line and 'Account #' in line:
                return True, 0.95
        return False, 0.0

    def should_skip_row(self, row: Dict) -> bool:
        """Skip payment rows and rows without valid data."""
        # First check standard skip conditions
        if super().should_skip_row(row):
            return True

        # Skip payment rows
        description = row.get('Description', '').strip()
        if 'AUTOPAY PAYMENT' in description or 'THANK YOU' in description:
            return True

        return False

    def extract_merchant(self, row: Dict, description: str) -> str:
        """
        Extract merchant from AMEX description.

        Examples:
        - "TARGET              ENCINITAS           CA"
        - "MICROSOFT           MSBILL.INFO"
        - "AplPay STARBUCKS    800-782-7282        WA"
        """
        if not description:
            return ""

        # Take first part before multiple spaces or location/phone
        parts = re.split(r'\s{2,}', description)
        if parts:
            return parts[0].strip()
        return description[:50].strip()

    def map_category(self, source_category: str) -> Optional[str]:
        """Map AMEX category to our simplified categories."""
        if not source_category:
            return None

        cat_lower = source_category.lower()
        for keyword, mapped_category in self.CATEGORY_MAP.items():
            if keyword in cat_lower:
                return mapped_category

        return None

    def get_default_account_source(self, csv_content: str, row: Dict) -> str:
        """Build account source from account number."""
        account_num = row.get('Account #', '').strip() if row else ''
        if account_num:
            return f"AMEX{account_num}"
        return "AMEX"
