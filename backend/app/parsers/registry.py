"""
Parser registry with decorator-based registration.

Provides automatic format detection and parser discovery.
"""

from typing import Dict, List, Optional, Tuple, Type
from .base import CSVFormatParser


class ParserRegistry:
    """
    Registry for CSV format parsers.

    Parsers register themselves using the @register decorator:

        @ParserRegistry.register
        class MyParser(CSVFormatParser):
            format_key = "my_format"
            ...

    Usage:
        # Detect format and get parser
        parser, confidence = ParserRegistry.detect_format(csv_content)

        # Get parser by key
        parser = ParserRegistry.get_parser("amex_cc")

        # List all registered parsers
        for key, parser in ParserRegistry.get_all():
            print(f"{key}: {parser.format_name}")
    """

    _parsers: Dict[str, Type[CSVFormatParser]] = {}

    @classmethod
    def register(cls, parser_class: Type[CSVFormatParser]) -> Type[CSVFormatParser]:
        """
        Decorator to register a parser class.

        Example:
            @ParserRegistry.register
            class AmexCCParser(CSVFormatParser):
                format_key = "amex_cc"
                ...
        """
        if not parser_class.format_key:
            raise ValueError(f"Parser {parser_class.__name__} must define format_key")

        if parser_class.format_key in cls._parsers:
            raise ValueError(
                f"Duplicate format_key '{parser_class.format_key}' - "
                f"already registered by {cls._parsers[parser_class.format_key].__name__}"
            )

        cls._parsers[parser_class.format_key] = parser_class
        return parser_class

    @classmethod
    def get_parser(cls, format_key: str) -> Optional[CSVFormatParser]:
        """Get parser instance by format key."""
        parser_class = cls._parsers.get(format_key)
        if parser_class:
            return parser_class()
        return None

    @classmethod
    def detect_format(cls, csv_content: str) -> Tuple[Optional[CSVFormatParser], float]:
        """
        Auto-detect CSV format by checking all registered parsers.

        Returns:
            Tuple of (parser instance, confidence) or (None, 0.0) if no match
        """
        best_parser = None
        best_confidence = 0.0

        for parser_class in cls._parsers.values():
            parser = parser_class()
            can_parse, confidence = parser.can_parse(csv_content)

            if can_parse and confidence > best_confidence:
                best_parser = parser
                best_confidence = confidence

        return best_parser, best_confidence

    @classmethod
    def get_all(cls) -> List[Tuple[str, Type[CSVFormatParser]]]:
        """Get all registered parsers as (key, class) tuples."""
        return list(cls._parsers.items())

    @classmethod
    def get_format_keys(cls) -> List[str]:
        """Get all registered format keys."""
        return list(cls._parsers.keys())

    @classmethod
    def get_format_names(cls) -> Dict[str, str]:
        """Get mapping of format_key -> format_name for all parsers."""
        return {key: parser_class.format_name for key, parser_class in cls._parsers.items()}

    @classmethod
    def clear(cls):
        """Clear all registered parsers (useful for testing)."""
        cls._parsers = {}
