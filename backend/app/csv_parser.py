import csv
import io
import re
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from app.models import ImportFormatType

def detect_format(csv_content: str) -> ImportFormatType:
    """Auto-detect CSV format (BofA bank, BofA CC, Amex CC)"""
    lines = csv_content.strip().split('\n')

    # Check first few lines for format indicators
    for line in lines[:10]:
        # Amex CC has "Card Member" column
        if 'Card Member' in line and 'Account #' in line:
            return ImportFormatType.amex_cc
        # BofA Bank (checking/savings) has "Running Bal." column
        if 'Running Bal.' in line:
            return ImportFormatType.bofa_bank
        # BofA Credit Card has "Posted Date,Reference Number,Payee"
        if 'Posted Date' in line and 'Reference Number' in line and 'Payee' in line:
            return ImportFormatType.bofa_cc

    return ImportFormatType.unknown

def extract_merchant_from_description(description: str, format_type: ImportFormatType) -> str:
    """Extract merchant name from description based on format"""
    if format_type == ImportFormatType.bofa_bank:
        # BOFA format examples:
        # "VENMO DES:PAYMENT ID:XXXXX78391801 INDN:TEAM SEYMOUR CO ID:XXXXX81992 WEB"
        # "HAEMONETICS DES:PAYROLL ID:XXXXX9028933K43 INDN:SEYMOUR,JOSEPH CO ID:XXXXX11103 PPD"
        # "BKOFAMERICA MOBILE 10/18 XXXXX85819 DEPOSIT *MOBILE CA"
        # "T-MOBILE DES:PCS SVC ID:6527371 INDN:JOSEPH SEYMOUR CO ID:XXXXX50304 WEB"

        # First word/phrase before "DES:" or numbers
        parts = description.split()
        if parts:
            # Take first meaningful word(s)
            merchant = parts[0]
            # If there's more context before DES: or ID:, grab it
            if len(parts) > 1 and not any(x in parts[1] for x in ['DES:', 'ID:', '/', 'XXXXX']):
                merchant += ' ' + parts[1]
            return merchant.strip()

    elif format_type == ImportFormatType.amex_cc:
        # AMEX descriptions are cleaner, usually just merchant name
        # "TARGET              ENCINITAS           CA"
        # "MICROSOFT           MSBILL.INFO"
        # "AplPay STARBUCKS    800-782-7282        WA"

        # Take first part before multiple spaces or location/phone
        parts = re.split(r'\s{2,}', description)
        if parts:
            return parts[0].strip()

    # Fallback: return first 50 chars of description
    return description[:50].strip()

def parse_bofa_csv(csv_content: str, account_source: str) -> List[Dict]:
    """Parse Bank of America CSV format"""
    transactions = []

    # Find the line with "Date,Description,Amount,Running Bal."
    lines = csv_content.split('\n')
    start_index = 0
    for i, line in enumerate(lines):
        if line.startswith('Date') and 'Description' in line and 'Amount' in line:
            start_index = i
            break

    # Parse from that line forward
    transaction_content = '\n'.join(lines[start_index:])
    reader = csv.DictReader(io.StringIO(transaction_content))

    for row in reader:

        # Skip summary rows
        date_str = row.get('Date', '').strip()
        if not date_str or 'balance' in date_str.lower():
            continue

        description = row.get('Description', '').strip()
        amount_str = row.get('Amount', '').strip()

        if not amount_str:
            continue

        # Parse amount (remove commas, parse negative)
        amount = float(amount_str.replace(',', ''))

        # Parse date (MM/DD/YYYY)
        try:
            trans_date = datetime.strptime(date_str, '%m/%d/%Y').date()
        except ValueError:
            continue

        merchant = extract_merchant_from_description(description, ImportFormatType.bofa_bank)

        transactions.append({
            'date': trans_date,
            'amount': amount,
            'description': description,
            'merchant': merchant,
            'account_source': account_source,
            'card_member': None,
            'reference_id': f"bofa_{date_str}_{amount}",
        })

    return transactions

def parse_bofa_cc_csv(csv_content: str, account_source: str) -> List[Dict]:
    """Parse Bank of America Credit Card CSV format

    Headers: Posted Date,Reference Number,Payee,Address,Amount
    """
    transactions = []
    reader = csv.DictReader(io.StringIO(csv_content))

    for row in reader:
        date_str = row.get('Posted Date', '').strip()
        reference = row.get('Reference Number', '').strip()
        payee = row.get('Payee', '').strip()
        amount_str = row.get('Amount', '').strip()

        if not date_str or not amount_str:
            continue

        # Parse amount - BofA CC: negative = charge, positive = credit/payment
        amount = float(amount_str.replace(',', ''))

        # Parse date (MM/DD/YYYY)
        try:
            trans_date = datetime.strptime(date_str, '%m/%d/%Y').date()
        except ValueError:
            continue

        # Payee is already the merchant name in BofA CC format
        merchant = payee.split(',')[0].strip() if payee else None

        transactions.append({
            'date': trans_date,
            'amount': amount,
            'description': payee,  # Use payee as description
            'merchant': merchant,
            'account_source': account_source,
            'card_member': None,
            'reference_id': reference if reference else f"bofa_cc_{date_str}_{amount}",
        })

    return transactions

def parse_amex_csv(csv_content: str) -> List[Dict]:
    """Parse American Express CSV format"""
    transactions = []
    reader = csv.DictReader(io.StringIO(csv_content))

    for row in reader:
        date_str = row.get('Date', '').strip()
        description = row.get('Description', '').strip()
        amount_str = row.get('Amount', '').strip()
        card_member = row.get('Card Member', '').strip()
        account_num = row.get('Account #', '').strip()
        reference = row.get('Reference', '').strip()
        amex_category = row.get('Category', '').strip()

        if not date_str or not amount_str:
            continue

        # Skip payment rows
        if 'AUTOPAY PAYMENT' in description or 'THANK YOU' in description:
            continue

        # Parse amount (AMEX credits are negative, need to flip for our convention)
        # In AMEX CSV: positive = charge, negative = credit/refund
        # Our convention: positive = income, negative = expense
        amount = -float(amount_str.replace(',', ''))

        # Parse date (MM/DD/YYYY)
        try:
            trans_date = datetime.strptime(date_str, '%m/%d/%Y').date()
        except ValueError:
            continue

        merchant = extract_merchant_from_description(description, ImportFormatType.amex_cc)

        # Build account source from account number
        account_source = f"AMEX{account_num}" if account_num else "AMEX"

        # Map AMEX category to our simplified categories (we'll do this in category inference)
        suggested_category = map_amex_category(amex_category) if amex_category else None

        transactions.append({
            'date': trans_date,
            'amount': amount,
            'description': description,
            'merchant': merchant,
            'account_source': account_source,
            'card_member': card_member,
            'reference_id': reference if reference else f"amex_{date_str}_{amount}",
            'amex_category': amex_category,  # Store original for category inference
            'suggested_category': suggested_category,
        })

    return transactions

def map_amex_category(amex_cat: str) -> Optional[str]:
    """Map AMEX category strings to our simplified categories"""
    amex_cat_lower = amex_cat.lower()

    if 'restaurant' in amex_cat_lower or 'bar & café' in amex_cat_lower:
        return 'Dining & Coffee'
    elif 'merchandise' in amex_cat_lower or 'retail' in amex_cat_lower or 'wholesale' in amex_cat_lower:
        return 'Shopping'
    elif 'entertainment' in amex_cat_lower:
        return 'Entertainment'
    elif 'health care' in amex_cat_lower:
        return 'Healthcare'
    elif 'education' in amex_cat_lower:
        return 'Education'
    elif 'government' in amex_cat_lower or 'toll' in amex_cat_lower:
        return 'Transportation'
    elif 'computer' in amex_cat_lower or 'internet' in amex_cat_lower:
        return 'Subscriptions'
    elif 'telecom' in amex_cat_lower or 'communications' in amex_cat_lower:
        return 'Utilities'

    return None

def parse_csv(csv_content: str, account_source: Optional[str] = None,
              format_hint: Optional[ImportFormatType] = None) -> Tuple[List[Dict], ImportFormatType]:
    """
    Parse CSV content and return transactions

    Args:
        csv_content: Raw CSV file content as string
        account_source: Optional account source to use (required for BOFA)
        format_hint: Optional format type hint from user or saved preferences

    Returns:
        Tuple of (transactions list, detected format type)
    """
    # Auto-detect format if not provided
    if format_hint is None:
        format_type = detect_format(csv_content)
    else:
        format_type = format_hint

    if format_type == ImportFormatType.bofa_bank:
        if not account_source:
            account_source = "BOFA-Unknown"
        transactions = parse_bofa_csv(csv_content, account_source)
    elif format_type == ImportFormatType.bofa_cc:
        if not account_source:
            account_source = "BOFA-CC"
        transactions = parse_bofa_cc_csv(csv_content, account_source)
    elif format_type == ImportFormatType.amex_cc:
        transactions = parse_amex_csv(csv_content)
    else:
        # Unknown format
        transactions = []

    return transactions, format_type
