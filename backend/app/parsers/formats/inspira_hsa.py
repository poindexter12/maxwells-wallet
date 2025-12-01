"""
Inspira HSA CSV Parser

Format characteristics:
- Headers: "Transaction ID","Transaction Type","Origination Date","Posted Date",
           "Description","Amount","Expense Category","Expenses for","Contribution year",
           "Document attached","Trade Details","Investment rebalance","Is Investment Trans Type",
           "Verification Status"
- Amount format: "$500.00" or "($29.44)" for negative
- Date format: MM/DD/YYYY
- Expense Category can be "Medical" which maps to Healthcare
"""

from typing import Dict, Optional, Tuple

from ..base import (
    CSVFormatParser,
    ColumnMapping,
    AmountConfig,
    DateConfig,
    AmountSign,
)
from ..registry import ParserRegistry


@ParserRegistry.register
class InspiraHSAParser(CSVFormatParser):
    """Parser for Inspira HSA CSV exports."""

    format_key = "inspira_hsa"
    format_name = "Inspira HSA"

    column_mapping = ColumnMapping(
        date_column="Posted Date",
        amount_column="Amount",
        description_column="Description",
        reference_column="Transaction ID",
        category_column="Expense Category",
        type_column="Transaction Type",
    )

    amount_config = AmountConfig(
        sign_convention=AmountSign.PARENTHESES,
        currency_prefix="$",
        thousands_separator=",",
    )

    date_config = DateConfig(
        format="%m/%d/%Y",
    )

    def can_parse(self, csv_content: str) -> Tuple[bool, float]:
        """Detect Inspira HSA format by looking for specific columns."""
        lines = csv_content.strip().split('\n')
        for line in lines[:10]:
            if 'Transaction ID' in line and 'Transaction Type' in line and 'Expense Category' in line:
                return True, 0.95
        return False, 0.0

    def should_skip_row(self, row: Dict) -> bool:
        """Use Posted Date if available, fall back to Origination Date."""
        date_str = row.get('Posted Date', '') or row.get('Origination Date', '')
        date_str = date_str.strip() if date_str else ''
        amount_str = row.get('Amount', '').strip()
        return not date_str or not amount_str

    def parse_date(self, date_str: str):
        """Override to handle fallback to Origination Date."""
        # The row handling for fallback is done in the parse method override
        return super().parse_date(date_str)

    def extract_merchant(self, row: Dict, description: str) -> str:
        """Extract merchant from description or transaction type."""
        trans_type = row.get('Transaction Type', '').strip()

        if description and description.split():
            return description.split()[0]
        elif trans_type and trans_type.split():
            return trans_type.split()[0]
        return "HSA"

    def map_category(self, source_category: str) -> Optional[str]:
        """Map Inspira category to our categories."""
        if source_category == 'Medical':
            return 'Healthcare'
        return None

    def get_default_account_source(self, csv_content: str, row: Dict) -> str:
        """Default account source for Inspira HSA."""
        return "Inspira-HSA"

    def parse(self, csv_content: str, account_source: Optional[str] = None):
        """Override to handle Posted Date / Origination Date fallback."""
        import csv
        import io
        from ..base import ParsedTransaction

        transactions = []
        content = self.preprocess_content(csv_content)
        reader = csv.DictReader(io.StringIO(content))

        for row in reader:
            # Handle date fallback - use Posted Date, fall back to Origination Date
            date_str = row.get('Posted Date', '') or row.get('Origination Date', '')
            date_str = date_str.strip() if date_str else ''

            if not date_str:
                continue

            amount_str = row.get('Amount', '').strip()
            if not amount_str:
                continue

            # Parse date
            trans_date = super().parse_date(date_str)
            if trans_date is None:
                continue

            # Parse amount
            amount = self.parse_amount(amount_str)
            if amount is None:
                continue

            # Get description, fall back to transaction type
            description = row.get('Description', '').strip()
            trans_type = row.get('Transaction Type', '').strip()
            if not description:
                description = trans_type

            # Extract merchant
            merchant = self.extract_merchant(row, description)

            # Determine account source
            effective_account = account_source or self.get_default_account_source(csv_content, row)

            # Get reference ID
            reference_id = self.get_reference_id(row, trans_date, amount)

            # Map category
            source_category = row.get('Expense Category', '').strip()
            suggested_category = self.map_category(source_category) if source_category else None

            transactions.append(ParsedTransaction(
                date=trans_date,
                amount=amount,
                description=description,
                merchant=merchant,
                account_source=effective_account,
                reference_id=reference_id,
                card_member=None,
                suggested_category=suggested_category,
                source_category=source_category,
            ))

        return transactions
