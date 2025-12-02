"""
Quicken Interchange Format (QIF) Parser

QIF is a text-based format used by Quicken and many banks for transaction export.

Format characteristics:
- Text file with single-letter field codes
- Each record ends with '^' on its own line
- Header line starts with '!Type:' (Bank, CCard, Cash, etc.)

Field codes:
- D: Date (MM/DD/YYYY or MM/DD/YY)
- T: Amount (negative for debits)
- P: Payee
- M: Memo
- L: Category
- N: Check number
- C: Cleared status (* or X = cleared)
- A: Address (multi-line)
- ^: End of record

Reference: https://en.wikipedia.org/wiki/Quicken_Interchange_Format
"""

import re
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple

from ..base import CSVFormatParser, ParsedTransaction
from ..registry import ParserRegistry


@ParserRegistry.register
class QIFParser(CSVFormatParser):
    """Parser for Quicken Interchange Format (.qif) files."""

    format_key = "qif"
    format_name = "Quicken QIF"

    # These aren't used since we override parse(), but required by base class
    column_mapping = None

    def can_parse(self, content: str) -> Tuple[bool, float]:
        """
        Detect QIF format by looking for !Type: header.

        Returns:
            Tuple of (can_parse, confidence)
        """
        content_lower = content.strip().lower()

        # Check for QIF type header
        if content_lower.startswith('!type:'):
            return True, 0.95

        # Check within first few lines
        lines = content.strip().split('\n')[:10]
        for line in lines:
            if line.strip().lower().startswith('!type:'):
                return True, 0.90

        return False, 0.0

    def parse(self, content: str, account_source: Optional[str] = None) -> List[ParsedTransaction]:
        """
        Parse QIF content into transactions.

        Args:
            content: QIF file content as string
            account_source: Optional account source identifier

        Returns:
            List of ParsedTransaction objects
        """
        transactions = []
        lines = content.strip().split('\n')

        # Track account type from header
        account_type = "Unknown"
        current_record: Dict[str, str] = {}

        for line in lines:
            line = line.strip()

            if not line:
                continue

            # Account type header
            if line.lower().startswith('!type:'):
                account_type = line[6:].strip()
                continue

            # Account header (multi-account QIF files)
            if line.lower().startswith('!account'):
                continue

            # Other headers we skip
            if line.startswith('!'):
                continue

            # End of record
            if line == '^':
                if current_record:
                    txn = self._parse_record(current_record, account_type, account_source)
                    if txn:
                        transactions.append(txn)
                current_record = {}
                continue

            # Parse field code
            if len(line) >= 1:
                field_code = line[0].upper()
                field_value = line[1:].strip() if len(line) > 1 else ""

                if field_code == 'D':
                    current_record['date'] = field_value
                elif field_code == 'T':
                    current_record['amount'] = field_value
                elif field_code == 'P':
                    current_record['payee'] = field_value
                elif field_code == 'M':
                    current_record['memo'] = field_value
                elif field_code == 'L':
                    current_record['category'] = field_value
                elif field_code == 'N':
                    current_record['check_number'] = field_value
                elif field_code == 'C':
                    current_record['cleared'] = field_value
                elif field_code == 'A':
                    # Address can be multi-line, append
                    existing = current_record.get('address', '')
                    current_record['address'] = (existing + ' ' + field_value).strip()

        # Handle last record if file doesn't end with ^
        if current_record:
            txn = self._parse_record(current_record, account_type, account_source)
            if txn:
                transactions.append(txn)

        return transactions

    def _parse_record(
        self,
        record: Dict[str, str],
        account_type: str,
        account_source: Optional[str]
    ) -> Optional[ParsedTransaction]:
        """
        Convert a QIF record dict to ParsedTransaction.

        Args:
            record: Dict with QIF field values
            account_type: Account type from !Type: header
            account_source: Override account source

        Returns:
            ParsedTransaction or None if invalid
        """
        # Parse date (required)
        date_str = record.get('date', '')
        trans_date = self._parse_qif_date(date_str)
        if not trans_date:
            return None

        # Parse amount (required)
        amount_str = record.get('amount', '')
        amount = self._parse_qif_amount(amount_str)
        if amount is None:
            return None

        # Get payee/description
        payee = record.get('payee', '')
        memo = record.get('memo', '')

        # Build description from payee and memo
        if payee and memo:
            description = f"{payee} - {memo}"
        else:
            description = payee or memo or "Unknown"

        # Merchant is the payee
        merchant = payee[:50].strip() if payee else description[:50].strip()

        # Determine account source
        effective_account = account_source
        if not effective_account:
            # Use account type as fallback
            effective_account = f"QIF-{account_type}"

        # Generate reference ID
        check_num = record.get('check_number', '')
        if check_num:
            reference_id = f"qif_{trans_date}_{check_num}"
        else:
            reference_id = f"qif_{trans_date}_{amount}"

        # Map category if present
        source_category = record.get('category', '')
        suggested_category = self._map_qif_category(source_category) if source_category else None

        return ParsedTransaction(
            date=trans_date,
            amount=amount,
            description=description,
            merchant=merchant,
            account_source=effective_account,
            reference_id=reference_id,
            suggested_category=suggested_category,
            source_category=source_category if source_category else None,
        )

    def _parse_qif_date(self, date_str: str) -> Optional[date]:
        """
        Parse QIF date formats.

        QIF dates can be:
        - MM/DD/YYYY
        - MM/DD/YY
        - M/D/YY
        - MM/DD'YYYY (apostrophe separator for year)
        """
        if not date_str:
            return None

        # Handle apostrophe year separator (e.g., 12/15'2024)
        date_str = date_str.replace("'", "/")

        # Try common formats
        formats = [
            "%m/%d/%Y",    # 12/15/2024
            "%m/%d/%y",    # 12/15/24
            "%m-%d-%Y",    # 12-15-2024
            "%m-%d-%y",    # 12-15-24
            "%d/%m/%Y",    # 15/12/2024 (international)
            "%Y-%m-%d",    # 2024-12-15 (ISO)
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue

        return None

    def _parse_qif_amount(self, amount_str: str) -> Optional[float]:
        """
        Parse QIF amount string.

        QIF amounts:
        - Can have commas as thousands separator
        - Negative amounts use minus prefix
        - May have currency symbols
        """
        if not amount_str:
            return None

        # Remove currency symbols and whitespace
        clean = amount_str.strip()
        clean = re.sub(r'[$£€]', '', clean)
        clean = clean.replace(',', '')
        clean = clean.replace(' ', '')

        try:
            return float(clean)
        except ValueError:
            return None

    def _map_qif_category(self, category: str) -> Optional[str]:
        """
        Map QIF category to internal category.

        QIF categories can be hierarchical (e.g., "Auto:Fuel")
        """
        if not category:
            return None

        # Take the top-level category
        top_level = category.split(':')[0].strip()

        # Basic mapping (can be expanded)
        category_map = {
            'auto': 'transportation',
            'car': 'transportation',
            'fuel': 'transportation',
            'gas': 'transportation',
            'food': 'food-and-drink',
            'groceries': 'groceries',
            'dining': 'food-and-drink',
            'restaurant': 'food-and-drink',
            'utilities': 'utilities',
            'phone': 'utilities',
            'electric': 'utilities',
            'medical': 'healthcare',
            'healthcare': 'healthcare',
            'doctor': 'healthcare',
            'pharmacy': 'healthcare',
            'entertainment': 'entertainment',
            'shopping': 'shopping',
            'clothing': 'shopping',
            'travel': 'travel',
            'vacation': 'travel',
            'home': 'home',
            'household': 'home',
            'insurance': 'insurance',
            'salary': 'income',
            'income': 'income',
            'paycheck': 'income',
            'transfer': 'transfers',
        }

        return category_map.get(top_level.lower())
