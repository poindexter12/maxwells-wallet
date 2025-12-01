"""
Extensible CSV Parser System

This package provides a class-based, extensible parser system for importing
financial transactions from various CSV formats.

Usage:
    from app.parsers import ParserRegistry

    # Auto-detect format and parse
    parser, confidence = ParserRegistry.detect_format(csv_content)
    if parser:
        transactions = parser.parse(csv_content, account_source="My Account")

    # Or get specific parser by key
    parser = ParserRegistry.get_parser("amex_cc")
    transactions = parser.parse(csv_content)

Adding a new format:
    1. Create a new file in parsers/formats/
    2. Subclass CSVFormatParser
    3. Set format_key, format_name, column_mapping
    4. Implement can_parse()
    5. Decorate with @ParserRegistry.register

    That's it - no other changes needed!

Example:
    @ParserRegistry.register
    class MyBankParser(CSVFormatParser):
        format_key = "my_bank"
        format_name = "My Bank"
        column_mapping = ColumnMapping(...)

        def can_parse(self, csv_content: str) -> tuple[bool, float]:
            if "My Bank" in csv_content[:500]:
                return True, 0.9
            return False, 0.0
"""

from .base import (
    CSVFormatParser,
    ColumnMapping,
    AmountConfig,
    DateConfig,
    AmountSign,
    ParsedTransaction,
)
from .registry import ParserRegistry

# Import all format parsers to trigger registration
from . import formats

__all__ = [
    "CSVFormatParser",
    "ColumnMapping",
    "AmountConfig",
    "DateConfig",
    "AmountSign",
    "ParsedTransaction",
    "ParserRegistry",
]
