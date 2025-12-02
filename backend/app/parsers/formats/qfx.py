"""
Quicken Financial Exchange (QFX) / Open Financial Exchange (OFX) Parser

QFX/OFX is an XML-based format used by financial institutions for transaction export.
QFX is Intuit's branded version of OFX.

Format characteristics:
- SGML/XML-like structure (often not well-formed XML)
- Transaction data in <STMTTRN> elements
- FITID provides unique transaction ID from the bank
- Dates in YYYYMMDD or YYYYMMDDHHMMSS format

Key elements:
- <TRNTYPE>: Transaction type (DEBIT, CREDIT, etc.)
- <DTPOSTED>: Posted date
- <TRNAMT>: Amount
- <FITID>: Financial Institution Transaction ID (unique)
- <NAME>: Payee name
- <MEMO>: Transaction memo
- <CHECKNUM>: Check number (if applicable)

Reference: https://en.wikipedia.org/wiki/Open_Financial_Exchange
"""

import re
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple

from ..base import CSVFormatParser, ParsedTransaction
from ..registry import ParserRegistry


@ParserRegistry.register
class QFXParser(CSVFormatParser):
    """Parser for QFX/OFX (Open Financial Exchange) files."""

    format_key = "qfx"
    format_name = "Quicken QFX/OFX"

    # These aren't used since we override parse(), but required by base class
    column_mapping = None

    # Regex patterns for extracting OFX elements
    # OFX uses SGML-like syntax where closing tags are optional
    STMTTRN_PATTERN = re.compile(r'<STMTTRN>(.*?)</STMTTRN>', re.DOTALL | re.IGNORECASE)
    TAG_PATTERN = re.compile(r'<(\w+)>([^<]*)', re.IGNORECASE)

    def can_parse(self, content: str) -> Tuple[bool, float]:
        """
        Detect QFX/OFX format by looking for OFX markers.

        Returns:
            Tuple of (can_parse, confidence)
        """
        content_upper = content.strip().upper()

        # Check for OFX header or root element
        if '<OFX>' in content_upper:
            return True, 0.95

        # Check for OFXHEADER
        if 'OFXHEADER:' in content_upper:
            return True, 0.95

        # Check for <?OFX processing instruction
        if '<?OFX' in content_upper:
            return True, 0.90

        # Check for statement transaction elements
        if '<STMTTRN>' in content_upper:
            return True, 0.85

        return False, 0.0

    def parse(self, content: str, account_source: Optional[str] = None) -> List[ParsedTransaction]:
        """
        Parse QFX/OFX content into transactions.

        Args:
            content: QFX/OFX file content as string
            account_source: Optional account source identifier

        Returns:
            List of ParsedTransaction objects
        """
        transactions = []

        # Extract account info if available
        detected_account = self._extract_account_info(content)

        # Find all STMTTRN (Statement Transaction) blocks
        matches = self.STMTTRN_PATTERN.findall(content)

        for match in matches:
            txn = self._parse_transaction_block(match, account_source or detected_account)
            if txn:
                transactions.append(txn)

        return transactions

    def _extract_account_info(self, content: str) -> str:
        """
        Extract account information from OFX content.

        Looks for ACCTID (account ID) or ACCTTYPE elements.
        """
        # Try to find account ID
        acct_match = re.search(r'<ACCTID>([^<]+)', content, re.IGNORECASE)
        if acct_match:
            acct_id = acct_match.group(1).strip()
            # Mask most digits for privacy, keep last 4
            if len(acct_id) > 4:
                return f"QFX-****{acct_id[-4:]}"
            return f"QFX-{acct_id}"

        # Try to find account type
        type_match = re.search(r'<ACCTTYPE>([^<]+)', content, re.IGNORECASE)
        if type_match:
            acct_type = type_match.group(1).strip()
            return f"QFX-{acct_type}"

        return "QFX-Unknown"

    def _parse_transaction_block(
        self,
        block: str,
        account_source: str
    ) -> Optional[ParsedTransaction]:
        """
        Parse a single STMTTRN block into ParsedTransaction.

        Args:
            block: Content between <STMTTRN> and </STMTTRN>
            account_source: Account source identifier

        Returns:
            ParsedTransaction or None if invalid
        """
        # Extract all tags and values from the block
        fields = {}
        for match in self.TAG_PATTERN.finditer(block):
            tag_name = match.group(1).upper()
            tag_value = match.group(2).strip()
            if tag_value:
                fields[tag_name] = tag_value

        # Parse date (required) - DTPOSTED
        date_str = fields.get('DTPOSTED', '')
        trans_date = self._parse_ofx_date(date_str)
        if not trans_date:
            # Try DTUSER or DTAVAIL as fallbacks
            trans_date = self._parse_ofx_date(fields.get('DTUSER', ''))
            if not trans_date:
                trans_date = self._parse_ofx_date(fields.get('DTAVAIL', ''))
        if not trans_date:
            return None

        # Parse amount (required) - TRNAMT
        amount_str = fields.get('TRNAMT', '')
        amount = self._parse_ofx_amount(amount_str)
        if amount is None:
            return None

        # Get transaction type
        tran_type = fields.get('TRNTYPE', 'OTHER')

        # Get payee/description
        name = fields.get('NAME', '')
        memo = fields.get('MEMO', '')
        payee = fields.get('PAYEE', '')  # Sometimes used instead of NAME

        # Build description
        description_parts = []
        if name:
            description_parts.append(name)
        elif payee:
            description_parts.append(payee)
        if memo and memo not in description_parts:
            description_parts.append(memo)

        description = ' - '.join(description_parts) if description_parts else f"{tran_type} Transaction"

        # Merchant is NAME or PAYEE
        merchant = (name or payee or description)[:50].strip()

        # FITID is the gold standard for reference ID - unique from the bank
        fitid = fields.get('FITID', '')
        if fitid:
            reference_id = f"qfx_{fitid}"
        else:
            # Fallback to date/amount
            check_num = fields.get('CHECKNUM', '')
            if check_num:
                reference_id = f"qfx_{trans_date}_{check_num}"
            else:
                reference_id = f"qfx_{trans_date}_{amount}"

        # SIC code can help with categorization
        sic = fields.get('SIC', '')
        suggested_category = self._map_sic_code(sic) if sic else None

        return ParsedTransaction(
            date=trans_date,
            amount=amount,
            description=description,
            merchant=merchant,
            account_source=account_source,
            reference_id=reference_id,
            suggested_category=suggested_category,
            source_category=sic if sic else None,
        )

    def _parse_ofx_date(self, date_str: str) -> Optional[date]:
        """
        Parse OFX date format.

        OFX dates are in YYYYMMDD or YYYYMMDDHHMMSS format.
        May include timezone offset: YYYYMMDDHHMMSS[-5:EST]
        """
        if not date_str:
            return None

        # Remove timezone info if present (e.g., [-5:EST])
        date_str = re.sub(r'\[.*\]', '', date_str).strip()

        # Try to extract just the date portion (first 8 chars)
        if len(date_str) >= 8:
            date_only = date_str[:8]
            try:
                return datetime.strptime(date_only, "%Y%m%d").date()
            except ValueError:
                pass

        # Try full datetime format
        if len(date_str) >= 14:
            try:
                return datetime.strptime(date_str[:14], "%Y%m%d%H%M%S").date()
            except ValueError:
                pass

        return None

    def _parse_ofx_amount(self, amount_str: str) -> Optional[float]:
        """
        Parse OFX amount string.

        OFX amounts are typically plain decimal numbers.
        Negative amounts use minus prefix.
        """
        if not amount_str:
            return None

        # Clean up the string
        clean = amount_str.strip()
        clean = clean.replace(',', '')  # Remove thousands separator
        clean = clean.replace(' ', '')

        try:
            return float(clean)
        except ValueError:
            return None

    def _map_sic_code(self, sic: str) -> Optional[str]:
        """
        Map SIC (Standard Industrial Classification) code to category.

        SIC codes are 4-digit codes classifying businesses.
        Only major categories are mapped here.
        """
        if not sic:
            return None

        # Get first 2 digits for major category
        try:
            major = int(sic[:2])
        except (ValueError, IndexError):
            return None

        # Major SIC categories
        if major in range(1, 10):
            return 'agriculture'
        elif major in range(10, 15):
            return 'mining'
        elif major in range(15, 18):
            return 'construction'
        elif major in range(20, 40):
            return 'manufacturing'
        elif major in range(40, 50):
            return 'transportation'
        elif major in range(50, 52):
            return 'wholesale'
        elif major in range(52, 60):
            return 'shopping'  # Retail trade
        elif major in range(60, 68):
            return 'finance'  # Finance, insurance, real estate
        elif major in range(70, 72):
            return 'travel'  # Hotels, lodging
        elif major in range(72, 73):
            return 'personal-services'
        elif major in range(78, 80):
            return 'entertainment'  # Motion pictures, recreation
        elif major in range(80, 83):
            return 'healthcare'  # Health services
        elif major in range(83, 87):
            return 'professional-services'
        elif major in range(58, 59):
            return 'food-and-drink'  # Eating and drinking places

        return None
