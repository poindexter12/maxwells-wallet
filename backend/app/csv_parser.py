"""
CSV Parser - Backwards Compatibility Wrapper

This module provides backwards-compatible function interfaces that delegate
to the new class-based parser system in app.parsers.

DEPRECATED: These functions are maintained for backwards compatibility.
New code should use app.parsers.ParserRegistry directly.

Example (new way):
    from app.parsers import ParserRegistry

    parser, confidence = ParserRegistry.detect_format(csv_content)
    transactions = parser.parse(csv_content, account_source)

Example (legacy way, still works):
    from app.csv_parser import parse_csv, detect_format

    format_type = detect_format(csv_content)
    transactions, detected_format = parse_csv(csv_content, account_source)
"""

from typing import Dict, List, Optional, Tuple

from app.models import ImportFormatType
from app.parsers import ParserRegistry


def detect_format(csv_content: str) -> ImportFormatType:
    """
    Auto-detect CSV format.

    DEPRECATED: Use ParserRegistry.detect_format() instead.

    Returns:
        ImportFormatType enum value
    """
    parser, confidence = ParserRegistry.detect_format(csv_content)
    if parser:
        try:
            return ImportFormatType(parser.format_key)
        except ValueError:
            return ImportFormatType.unknown
    return ImportFormatType.unknown


def extract_merchant_from_description(description: str, format_type: ImportFormatType) -> str:
    """
    Extract merchant name from description based on format.

    DEPRECATED: Use parser.extract_merchant() instead.
    """
    parser = ParserRegistry.get_parser(format_type.value)
    if parser:
        return parser.extract_merchant({}, description)
    return description[:50].strip()


def parse_bofa_csv(csv_content: str, account_source: str) -> List[Dict]:
    """
    Parse Bank of America CSV format.

    DEPRECATED: Use ParserRegistry.get_parser("bofa_bank").parse() instead.
    """
    parser = ParserRegistry.get_parser("bofa_bank")
    if parser:
        transactions = parser.parse(csv_content, account_source)
        return [t.to_dict() for t in transactions]
    return []


def parse_bofa_cc_csv(csv_content: str, account_source: str) -> List[Dict]:
    """
    Parse Bank of America Credit Card CSV format.

    DEPRECATED: Use ParserRegistry.get_parser("bofa_cc").parse() instead.
    """
    parser = ParserRegistry.get_parser("bofa_cc")
    if parser:
        transactions = parser.parse(csv_content, account_source)
        return [t.to_dict() for t in transactions]
    return []


def parse_amex_csv(csv_content: str) -> List[Dict]:
    """
    Parse American Express CSV format.

    DEPRECATED: Use ParserRegistry.get_parser("amex_cc").parse() instead.
    """
    parser = ParserRegistry.get_parser("amex_cc")
    if parser:
        transactions = parser.parse(csv_content)
        return [t.to_dict() for t in transactions]
    return []


def map_amex_category(amex_cat: str) -> Optional[str]:
    """
    Map AMEX category strings to our simplified categories.

    DEPRECATED: Use AmexCCParser.map_category() instead.
    """
    parser = ParserRegistry.get_parser("amex_cc")
    if parser:
        return parser.map_category(amex_cat)
    return None


def parse_inspira_hsa_csv(csv_content: str, account_source: str) -> List[Dict]:
    """
    Parse Inspira HSA CSV format.

    DEPRECATED: Use ParserRegistry.get_parser("inspira_hsa").parse() instead.
    """
    parser = ParserRegistry.get_parser("inspira_hsa")
    if parser:
        transactions = parser.parse(csv_content, account_source)
        return [t.to_dict() for t in transactions]
    return []


def parse_venmo_csv(csv_content: str, account_source: str) -> List[Dict]:
    """
    Parse Venmo CSV format.

    DEPRECATED: Use ParserRegistry.get_parser("venmo").parse() instead.
    """
    parser = ParserRegistry.get_parser("venmo")
    if parser:
        transactions = parser.parse(csv_content, account_source)
        return [t.to_dict() for t in transactions]
    return []


def parse_qif(content: str, account_source: Optional[str] = None) -> List[Dict]:
    """
    Parse Quicken Interchange Format (QIF) content.

    DEPRECATED: Use ParserRegistry.get_parser("qif").parse() instead.
    """
    parser = ParserRegistry.get_parser("qif")
    if parser:
        transactions = parser.parse(content, account_source)
        return [t.to_dict() for t in transactions]
    return []


def parse_qfx(content: str, account_source: Optional[str] = None) -> List[Dict]:
    """
    Parse QFX/OFX (Open Financial Exchange) content.

    DEPRECATED: Use ParserRegistry.get_parser("qfx").parse() instead.
    """
    parser = ParserRegistry.get_parser("qfx")
    if parser:
        transactions = parser.parse(content, account_source)
        return [t.to_dict() for t in transactions]
    return []


def parse_csv(
    csv_content: str,
    account_source: Optional[str] = None,
    format_hint: Optional[ImportFormatType] = None
) -> Tuple[List[Dict], ImportFormatType]:
    """
    Parse CSV content and return transactions.

    DEPRECATED: Use ParserRegistry directly:
        parser, confidence = ParserRegistry.detect_format(csv_content)
        transactions = parser.parse(csv_content, account_source)

    Args:
        csv_content: Raw CSV file content as string
        account_source: Optional account source to use
        format_hint: Optional format type hint

    Returns:
        Tuple of (transactions list, detected format type)
    """
    # Determine which parser to use
    if format_hint is not None and format_hint != ImportFormatType.unknown:
        parser = ParserRegistry.get_parser(format_hint.value)
        format_type = format_hint
    else:
        parser, confidence = ParserRegistry.detect_format(csv_content)
        if parser:
            try:
                format_type = ImportFormatType(parser.format_key)
            except ValueError:
                format_type = ImportFormatType.unknown
        else:
            format_type = ImportFormatType.unknown

    if parser is None:
        return [], format_type

    # Parse using the new parser
    parsed_transactions = parser.parse(csv_content, account_source)

    # Convert to dict format for backwards compatibility
    transactions = [t.to_dict() for t in parsed_transactions]

    return transactions, format_type
