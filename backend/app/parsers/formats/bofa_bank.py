"""
Bank of America Bank (Checking/Savings) CSV Parser

Format characteristics:
- Has metadata rows before the CSV header
- Header row: "Date,Description,Amount,Running Bal."
- Date format: MM/DD/YYYY
- Amount: negative prefix for debits
- Description contains encoded merchant info
"""

import csv
import io
import re
from typing import Dict, List, Optional, Tuple

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
class BofaBankParser(CSVFormatParser):
    """Parser for Bank of America checking/savings CSV exports."""

    format_key = "bofa_bank"
    format_name = "Bank of America Bank"

    column_mapping = ColumnMapping(
        date_column="Date",
        amount_column="Amount",
        description_column="Description",
    )

    amount_config = AmountConfig(
        sign_convention=AmountSign.NEGATIVE_PREFIX,
        thousands_separator=",",
    )

    date_config = DateConfig(
        format="%m/%d/%Y",
    )

    def can_parse(self, csv_content: str) -> Tuple[bool, float]:
        """Detect BofA Bank format by looking for 'Running Bal.' column."""
        lines = csv_content.strip().split('\n')
        for line in lines[:10]:
            if 'Running Bal.' in line:
                return True, 0.95
        return False, 0.0

    def preprocess_content(self, csv_content: str) -> str:
        """Find the header row and return content from there."""
        lines = csv_content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('Date') and 'Description' in line and 'Amount' in line:
                return '\n'.join(lines[i:])
        return csv_content

    def should_skip_row(self, row: Dict) -> bool:
        """Skip summary rows and rows without valid data."""
        date_str = row.get('Date', '').strip()
        amount_str = row.get('Amount', '').strip()

        if not date_str or not amount_str:
            return True
        if 'balance' in date_str.lower():
            return True
        return False

    def extract_merchant(self, row: Dict, description: str) -> str:
        """
        Extract merchant from BofA description format.

        Examples:
        - "VENMO DES:PAYMENT ID:XXXXX78391801 INDN:TEAM SEYMOUR CO ID:XXXXX81992 WEB"
        - "HAEMONETICS DES:PAYROLL ID:XXXXX9028933K43 INDN:SEYMOUR,JOSEPH CO ID:XXXXX11103 PPD"
        - "BKOFAMERICA MOBILE 10/18 XXXXX85819 DEPOSIT *MOBILE CA"
        - "T-MOBILE DES:PCS SVC ID:6527371 INDN:JOSEPH SEYMOUR CO ID:XXXXX50304 WEB"
        """
        if not description:
            return ""

        parts = description.split()
        if not parts:
            return ""

        # Take first meaningful word(s)
        merchant = parts[0]
        # If there's more context before DES: or ID:, grab it
        if len(parts) > 1 and not any(x in parts[1] for x in ['DES:', 'ID:', '/', 'XXXXX']):
            merchant += ' ' + parts[1]

        return merchant.strip()

    def get_default_account_source(self, csv_content: str, row: Dict) -> str:
        """Default account source for BofA Bank."""
        return "BOFA-Unknown"

    def get_reference_id(self, row: Dict, date_val, amount: float) -> str:
        """Generate reference ID from date and amount."""
        date_str = row.get('Date', '').strip()
        return f"bofa_{date_str}_{amount}"
