"""
Bank of America Credit Card CSV Parser

Format characteristics:
- Standard CSV with header row
- Headers: Posted Date,Reference Number,Payee,Address,Amount
- Date format: MM/DD/YYYY
- Amount: negative = charge, positive = credit/payment
"""

from typing import Dict, Tuple

from ..base import (
    CSVFormatParser,
    ColumnMapping,
    AmountConfig,
    DateConfig,
    AmountSign,
)
from ..registry import ParserRegistry


@ParserRegistry.register
class BofaCCParser(CSVFormatParser):
    """Parser for Bank of America Credit Card CSV exports."""

    format_key = "bofa_cc"
    format_name = "Bank of America Credit Card"

    column_mapping = ColumnMapping(
        date_column="Posted Date",
        amount_column="Amount",
        description_column="Payee",
        reference_column="Reference Number",
    )

    amount_config = AmountConfig(
        sign_convention=AmountSign.NEGATIVE_PREFIX,
        thousands_separator=",",
    )

    date_config = DateConfig(
        format="%m/%d/%Y",
    )

    def can_parse(self, csv_content: str) -> Tuple[bool, float]:
        """Detect BofA CC format by looking for specific header columns."""
        lines = csv_content.strip().split('\n')
        for line in lines[:10]:
            if 'Posted Date' in line and 'Reference Number' in line and 'Payee' in line:
                return True, 0.95
        return False, 0.0

    def extract_merchant(self, row: Dict, description: str) -> str:
        """Extract merchant from Payee field - take first part before comma."""
        if not description:
            return ""
        return description.split(',')[0].strip()

    def get_default_account_source(self, csv_content: str, row: Dict) -> str:
        """Default account source for BofA CC."""
        return "BOFA-CC"
