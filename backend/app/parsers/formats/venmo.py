"""
Venmo CSV Parser

Format characteristics:
- Has metadata header rows before the actual CSV header
- Row 1: "Account Statement - (@username) ,,,..."
- Row 2: "Account Activity,,,..."
- Row 3: ",ID,Datetime,Type,Status,Note,From,To,Amount (total),..."
- Row 4: Balance row (skip)
- Row 5+: Transaction data
- Amount format: "+ $20.00" or "- $18.00"
- Datetime format: ISO "2025-04-04T22:01:03"
"""

import csv
import io
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
class VenmoParser(CSVFormatParser):
    """Parser for Venmo CSV exports."""

    format_key = "venmo"
    format_name = "Venmo"

    column_mapping = ColumnMapping(
        date_column="Datetime",
        amount_column="Amount (total)",
        description_column="Note",
        reference_column="ID",
        status_column="Status",
        type_column="Type",
        from_column="From",
        to_column="To",
    )

    amount_config = AmountConfig(
        sign_convention=AmountSign.PLUS_MINUS_PREFIX,
        currency_prefix="$",
        thousands_separator=",",
    )

    date_config = DateConfig(
        use_iso_format=True,  # 2025-04-04T22:01:03
    )

    def can_parse(self, csv_content: str) -> Tuple[bool, float]:
        """Detect Venmo format by looking for characteristic headers."""
        lines = csv_content.strip().split("\n")
        for line in lines[:10]:
            if "Account Statement" in line:
                return True, 0.95
            if "ID" in line and "Datetime" in line and "From" in line and "To" in line:
                return True, 0.90
        return False, 0.0

    def preprocess_content(self, csv_content: str) -> str:
        """Find the header row (contains ID,Datetime,Type) and return from there."""
        lines = csv_content.strip().split("\n")
        for i, line in enumerate(lines):
            if "ID" in line and "Datetime" in line and "Type" in line:
                return "\n".join(lines[i:])
        return csv_content

    def should_skip_row(self, row: Dict) -> bool:
        """Skip balance rows and incomplete transactions."""
        trans_id = row.get("ID", "").strip()
        datetime_str = row.get("Datetime", "").strip()
        amount_str = row.get("Amount (total)", "").strip()
        status = row.get("Status", "").strip()

        # Skip rows without transaction data (balance rows)
        if not trans_id or not datetime_str or not amount_str:
            return True

        # Skip incomplete/failed transactions
        if status and status.lower() != "complete":
            return True

        return False

    def extract_merchant(self, row: Dict, description: str) -> str:
        """
        Determine merchant/counterparty based on transaction direction.
        - Received money: merchant is who sent it (From)
        - Sent money: merchant is who received it (To)
        """
        from_user = row.get("From", "").strip()
        to_user = row.get("To", "").strip()
        amount_str = row.get("Amount (total)", "").strip()

        # Determine direction from amount sign
        is_income = amount_str.strip().startswith("+")

        if is_income:
            return from_user if from_user else "Venmo"
        else:
            return to_user if to_user else "Venmo"

    def get_default_account_source(self, csv_content: str, row: Dict) -> str:
        """Default account source for Venmo."""
        return "Venmo"

    def parse(self, csv_content: str, account_source: Optional[str] = None) -> List[ParsedTransaction]:
        """
        Override parse to handle Venmo-specific description building.
        When Note is empty, build description from Type: From -> To
        """
        transactions = []
        content = self.preprocess_content(csv_content)
        reader = csv.DictReader(io.StringIO(content))

        for row in reader:
            if self.should_skip_row(row):
                continue

            # Parse date
            datetime_str = row.get("Datetime", "").strip()
            trans_date = self.parse_date(datetime_str)
            if trans_date is None:
                continue

            # Parse amount
            amount_str = row.get("Amount (total)", "").strip()
            amount = self.parse_amount(amount_str)
            if amount is None:
                continue

            # Build description from Note, or from Type/From/To if Note is empty
            note = row.get("Note", "").strip()
            trans_type = row.get("Type", "").strip()
            from_user = row.get("From", "").strip()
            to_user = row.get("To", "").strip()

            if note:
                description = note
            else:
                description = f"{trans_type}: {from_user} -> {to_user}"

            # Extract merchant
            merchant = self.extract_merchant(row, description)

            # Determine account source
            effective_account = account_source or self.get_default_account_source(csv_content, row)

            # Get reference ID
            trans_id = row.get("ID", "").strip()
            reference_id = trans_id if trans_id else f"venmo_{datetime_str}_{amount}"

            transactions.append(
                ParsedTransaction(
                    date=trans_date,
                    amount=amount,
                    description=description,
                    merchant=merchant,
                    account_source=effective_account,
                    reference_id=reference_id,
                    card_member=None,
                    suggested_category=None,
                    source_category=None,
                )
            )

        return transactions
