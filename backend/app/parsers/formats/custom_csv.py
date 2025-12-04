"""
Custom CSV Parser - User-defined column mappings for any CSV format.

This parser reads configuration from a JSON object and applies user-defined
column mappings, date formats, amount conventions, and row filtering rules.

Unlike other parsers, this is NOT registered with @ParserRegistry.register.
Instead, it's instantiated dynamically with a CustomCsvConfig object.
"""

import csv
import io
import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from ..base import (
    AmountConfig,
    AmountSign,
    CSVFormatParser,
    ColumnMapping,
    DateConfig,
    ParsedTransaction,
)


@dataclass
class RowHandling:
    """Configuration for row filtering and skipping."""
    skip_header_rows: int = 0  # Rows to skip before CSV header (if find_header_row is False)
    skip_footer_rows: int = 0  # Rows to skip at end of file
    skip_patterns: List[str] = field(default_factory=list)  # Skip rows matching these patterns
    skip_empty_rows: bool = True  # Skip rows with empty date/amount
    find_header_row: bool = False  # Auto-find header row containing expected columns
    header_indicators: List[str] = field(default_factory=list)  # Columns that must be present in header


@dataclass
class CustomCsvConfig:
    """
    Configuration for custom CSV parsing.

    This config is stored as JSON in ImportFormat.custom_mappings.
    Columns can be specified by name (string) or index (int, 0-based).
    """
    # Identity
    name: str  # User-friendly name for this config
    account_source: str  # Default account source

    # Required column mappings (by name or 0-based index)
    date_column: Union[str, int]
    amount_column: Union[str, int]
    description_column: Union[str, int]

    # Optional column mappings
    merchant_column: Optional[Union[str, int]] = None
    reference_column: Optional[Union[str, int]] = None
    category_column: Optional[Union[str, int]] = None
    card_member_column: Optional[Union[str, int]] = None

    # Date parsing
    date_format: str = "%m/%d/%Y"

    # Amount parsing
    amount_sign_convention: str = "negative_prefix"  # negative_prefix, parentheses, plus_minus
    amount_currency_prefix: str = ""
    amount_invert_sign: bool = False
    amount_thousands_separator: str = ","

    # Row handling
    row_handling: RowHandling = field(default_factory=RowHandling)

    # Merchant extraction
    merchant_split_chars: str = ""  # Split description on these chars, take first part
    merchant_max_length: int = 50
    merchant_regex: str = ""  # Regex to extract merchant (group 1 is used)
    merchant_first_words: int = 0  # Take first N words from description (0 = disabled)

    @classmethod
    def from_json(cls, json_str: str) -> "CustomCsvConfig":
        """Parse config from JSON string."""
        data = json.loads(json_str)

        # Handle nested row_handling
        row_handling_data = data.pop("row_handling", {})
        row_handling = RowHandling(**row_handling_data)

        return cls(row_handling=row_handling, **data)

    def to_json(self) -> str:
        """Serialize config to JSON string."""
        data = {
            "name": self.name,
            "account_source": self.account_source,
            "date_column": self.date_column,
            "amount_column": self.amount_column,
            "description_column": self.description_column,
            "merchant_column": self.merchant_column,
            "reference_column": self.reference_column,
            "category_column": self.category_column,
            "card_member_column": self.card_member_column,
            "date_format": self.date_format,
            "amount_sign_convention": self.amount_sign_convention,
            "amount_currency_prefix": self.amount_currency_prefix,
            "amount_invert_sign": self.amount_invert_sign,
            "amount_thousands_separator": self.amount_thousands_separator,
            "row_handling": {
                "skip_header_rows": self.row_handling.skip_header_rows,
                "skip_footer_rows": self.row_handling.skip_footer_rows,
                "skip_patterns": self.row_handling.skip_patterns,
                "skip_empty_rows": self.row_handling.skip_empty_rows,
                "find_header_row": self.row_handling.find_header_row,
                "header_indicators": self.row_handling.header_indicators,
            },
            "merchant_split_chars": self.merchant_split_chars,
            "merchant_max_length": self.merchant_max_length,
            "merchant_regex": self.merchant_regex,
            "merchant_first_words": self.merchant_first_words,
        }
        return json.dumps(data, indent=2)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return json.loads(self.to_json())


class CustomCsvParser(CSVFormatParser):
    """
    CSV parser with user-defined column mappings.

    Unlike other parsers, this is instantiated with a CustomCsvConfig
    that defines how to parse the CSV file.

    Usage:
        config = CustomCsvConfig.from_json(json_string)
        parser = CustomCsvParser(config)
        transactions = parser.parse(csv_content)
    """

    format_key = "custom"
    format_name = "Custom CSV"

    def __init__(self, config: CustomCsvConfig):
        self.config = config

        # Build column mapping (we handle by-index columns ourselves)
        # Use placeholder names if columns are specified by index
        self.column_mapping = ColumnMapping(
            date_column=self._col_name(config.date_column, "date"),
            amount_column=self._col_name(config.amount_column, "amount"),
            description_column=self._col_name(config.description_column, "description"),
            reference_column=self._col_name(config.reference_column, "reference") if config.reference_column is not None else None,
            category_column=self._col_name(config.category_column, "category") if config.category_column is not None else None,
            card_member_column=self._col_name(config.card_member_column, "card_member") if config.card_member_column is not None else None,
        )

        # Build amount config
        sign_map = {
            "negative_prefix": AmountSign.NEGATIVE_PREFIX,
            "parentheses": AmountSign.PARENTHESES,
            "plus_minus": AmountSign.PLUS_MINUS_PREFIX,
        }
        self.amount_config = AmountConfig(
            sign_convention=sign_map.get(config.amount_sign_convention, AmountSign.NEGATIVE_PREFIX),
            currency_prefix=config.amount_currency_prefix,
            invert_sign=config.amount_invert_sign,
            thousands_separator=config.amount_thousands_separator,
        )

        # Build date config
        self.date_config = DateConfig(
            format=config.date_format,
            use_iso_format=config.date_format.lower() == "iso",
        )

        self.skip_header_rows = config.row_handling.skip_header_rows

        super().__init__()

    def _col_name(self, col: Union[str, int], default: str) -> str:
        """Get column name, handling both string names and int indexes."""
        if isinstance(col, str):
            return col
        return f"__idx_{col}"  # Placeholder for index-based columns

    def _get_value(self, row: Dict[str, str], col: Union[str, int]) -> str:
        """Get value from row by name or index."""
        if isinstance(col, str):
            return row.get(col, "").strip()
        # For index-based columns, we need to use the placeholder key
        return row.get(f"__idx_{col}", "").strip()

    def can_parse(self, csv_content: str) -> Tuple[bool, float]:
        """
        Custom parser doesn't auto-detect - it's explicitly selected.
        Returns low confidence so it never wins auto-detection.
        """
        return False, 0.0

    def preprocess_content(self, csv_content: str) -> str:
        """Skip header and footer rows, optionally auto-detecting header row."""
        lines = csv_content.split('\n')

        # Find header row if configured
        if self.config.row_handling.find_header_row and self.config.row_handling.header_indicators:
            start = 0
            for i, line in enumerate(lines):
                # Check if this line contains all header indicators
                if all(indicator in line for indicator in self.config.row_handling.header_indicators):
                    start = i
                    break
        else:
            start = self.config.row_handling.skip_header_rows

        # Skip footer rows (calculate as positive index from end)
        if self.config.row_handling.skip_footer_rows > 0:
            end = len(lines) - self.config.row_handling.skip_footer_rows
        else:
            end = len(lines)

        if end <= start:
            return ""

        return '\n'.join(lines[start:end])

    def should_skip_row(self, row: Dict[str, str]) -> bool:
        """Check if row should be skipped based on config."""
        # Check skip patterns
        for pattern in self.config.row_handling.skip_patterns:
            row_text = ",".join(str(v) for v in row.values())
            if pattern.startswith("regex:"):
                if re.search(pattern[6:], row_text, re.IGNORECASE):
                    return True
            elif pattern.lower() in row_text.lower():
                return True

        # Check for empty required fields
        if self.config.row_handling.skip_empty_rows:
            date_val = self._get_value(row, self.config.date_column)
            amount_val = self._get_value(row, self.config.amount_column)
            if not date_val or not amount_val:
                return True

        return False

    def extract_merchant(self, row: Dict[str, str], description: str) -> str:
        """Extract merchant from dedicated column or description."""
        # If there's a dedicated merchant column, use it
        if self.config.merchant_column is not None:
            merchant = self._get_value(row, self.config.merchant_column)
            if merchant:
                return merchant[:self.config.merchant_max_length].strip()

        # Otherwise, extract from description
        merchant = description

        # Try regex extraction first
        if self.config.merchant_regex:
            match = re.search(self.config.merchant_regex, description)
            if match:
                merchant = match.group(1) if match.groups() else match.group(0)
                return merchant[:self.config.merchant_max_length].strip()

        # Try first N words extraction
        if self.config.merchant_first_words > 0:
            words = description.split()
            merchant = ' '.join(words[:self.config.merchant_first_words])
            return merchant[:self.config.merchant_max_length].strip()

        # Split on configured characters
        if self.config.merchant_split_chars:
            for char in self.config.merchant_split_chars:
                if char in merchant:
                    merchant = merchant.split(char)[0]
                    break

        return merchant[:self.config.merchant_max_length].strip()

    def get_default_account_source(self, csv_content: str, row: Dict[str, str]) -> str:
        """Return configured account source."""
        return self.config.account_source

    def parse(self, csv_content: str, account_source: Optional[str] = None) -> List[ParsedTransaction]:
        """
        Parse CSV with custom column mappings.

        Handles both named columns and index-based columns.
        """
        transactions = []

        # Preprocess content (skip header/footer rows)
        content = self.preprocess_content(csv_content)
        if not content.strip():
            return []

        lines = content.split('\n')
        if not lines:
            return []

        # Check if we're using index-based columns
        uses_indexes = isinstance(self.config.date_column, int)

        if uses_indexes:
            # Parse without header - create synthetic column names
            reader = csv.reader(io.StringIO(content))
            rows = list(reader)

            # Create dict rows with index-based keys
            for row_values in rows:
                if not row_values:
                    continue

                row = {f"__idx_{i}": v for i, v in enumerate(row_values)}

                if self.should_skip_row(row):
                    continue

                transaction = self._parse_row(row, csv_content, account_source)
                if transaction:
                    transactions.append(transaction)
        else:
            # Use DictReader for named columns
            reader = csv.DictReader(io.StringIO(content))

            for row in reader:
                if self.should_skip_row(row):
                    continue

                transaction = self._parse_row(row, csv_content, account_source)
                if transaction:
                    transactions.append(transaction)

        return transactions

    def _parse_row(
        self,
        row: Dict[str, str],
        csv_content: str,
        account_source: Optional[str]
    ) -> Optional[ParsedTransaction]:
        """Parse a single row into a transaction."""
        # Parse date
        date_str = self._get_value(row, self.config.date_column)
        trans_date = self.parse_date(date_str)
        if trans_date is None:
            return None

        # Parse amount
        amount_str = self._get_value(row, self.config.amount_column)
        amount = self.parse_amount(amount_str)
        if amount is None:
            return None

        # Get description
        description = self._get_value(row, self.config.description_column)

        # Extract merchant
        merchant = self.extract_merchant(row, description)

        # Determine account source
        effective_account = account_source or self.get_default_account_source(csv_content, row)

        # Get reference ID
        reference_id = ""
        if self.config.reference_column is not None:
            reference_id = self._get_value(row, self.config.reference_column)
        if not reference_id:
            reference_id = f"custom_{trans_date}_{amount}"

        # Get optional fields
        card_member = None
        if self.config.card_member_column is not None:
            card_member = self._get_value(row, self.config.card_member_column)

        source_category = None
        if self.config.category_column is not None:
            source_category = self._get_value(row, self.config.category_column)

        return ParsedTransaction(
            date=trans_date,
            amount=amount,
            description=description,
            merchant=merchant,
            account_source=effective_account,
            reference_id=reference_id,
            card_member=card_member if card_member else None,
            source_category=source_category if source_category else None,
        )


# ============================================================================
# Helper functions for auto-detection
# ============================================================================

# Common date formats to try during auto-detection
DATE_FORMATS = [
    ("%m/%d/%Y", "MM/DD/YYYY"),
    ("%d/%m/%Y", "DD/MM/YYYY"),
    ("%Y-%m-%d", "YYYY-MM-DD"),
    ("%m-%d-%Y", "MM-DD-YYYY"),
    ("%d-%m-%Y", "DD-MM-YYYY"),
    ("%Y/%m/%d", "YYYY/MM/DD"),
    ("%m/%d/%y", "MM/DD/YY"),
    ("%d/%m/%y", "DD/MM/YY"),
]


def detect_date_format(sample_values: List[str]) -> Optional[Tuple[str, str]]:
    """
    Detect date format from sample values.

    Returns tuple of (strptime_format, display_name) or None.
    """
    for strptime_fmt, display_name in DATE_FORMATS:
        matches = 0
        for value in sample_values:
            value = value.strip()
            if not value:
                continue
            try:
                datetime.strptime(value, strptime_fmt)
                matches += 1
            except ValueError:
                pass

        # If most samples match, we found the format
        if matches >= len([v for v in sample_values if v.strip()]) * 0.8:
            return (strptime_fmt, display_name)

    return None


def detect_amount_format(sample_values: List[str]) -> Dict[str, Any]:
    """
    Detect amount format from sample values.

    Returns dict with detected settings.
    """
    result = {
        "sign_convention": "negative_prefix",
        "currency_prefix": "",
        "invert_sign": False,
    }

    # Check for common patterns
    has_parens = any("(" in v and ")" in v for v in sample_values if v.strip())
    has_plus_minus = any(v.strip().startswith(("+", "- ", "+ ")) for v in sample_values if v.strip())
    has_dollar = any("$" in v for v in sample_values if v.strip())

    if has_parens:
        result["sign_convention"] = "parentheses"
    elif has_plus_minus:
        result["sign_convention"] = "plus_minus"

    if has_dollar:
        result["currency_prefix"] = "$"

    return result


def analyze_csv_columns(csv_content: str, skip_rows: int = 0) -> Dict[str, Any]:
    """
    Analyze CSV content and return column info with auto-detection hints.

    Returns:
        {
            "headers": ["col1", "col2", ...],
            "sample_rows": [[val1, val2, ...], ...],
            "column_hints": {
                "col1": {"likely_type": "date", "detected_format": "MM/DD/YYYY"},
                "col2": {"likely_type": "amount", "detected_settings": {...}},
                ...
            }
        }
    """
    lines = csv_content.split('\n')
    if skip_rows > 0:
        lines = lines[skip_rows:]

    if not lines:
        return {"headers": [], "sample_rows": [], "column_hints": {}}

    reader = csv.reader(io.StringIO('\n'.join(lines)))
    rows = list(reader)

    if not rows:
        return {"headers": [], "sample_rows": [], "column_hints": {}}

    headers = rows[0]
    data_rows = rows[1:11]  # Sample first 10 data rows

    column_hints = {}
    for i, header in enumerate(headers):
        samples = [row[i] if i < len(row) else "" for row in data_rows]
        hint = _analyze_column(header, samples)
        column_hints[header] = hint

    # Generate suggested config based on analysis
    suggested_config = suggest_config(headers, column_hints)

    return {
        "headers": headers,
        "sample_rows": data_rows[:5],  # Return first 5 for preview
        "column_hints": column_hints,
        "suggested_config": suggested_config,
    }


def _analyze_column(header: str, samples: List[str]) -> Dict[str, Any]:
    """Analyze a single column and return type hints."""
    header_lower = header.lower()

    # Check header name for hints - more comprehensive keyword lists
    date_keywords = ["date", "posted", "transaction date", "trans date", "datetime", "time"]
    amount_keywords = ["amount", "debit", "credit", "total", "sum", "balance", "price", "cost", "value"]
    desc_keywords = ["description", "memo", "payee", "merchant", "name", "narrative", "note", "details", "transaction"]
    ref_keywords = ["reference", "ref", "id", "transaction id", "check", "confirmation", "number", "conf"]
    category_keywords = ["category", "type", "classification", "expense type", "spending category"]
    account_keywords = ["account", "card", "member", "cardholder"]

    hint = {"likely_type": "unknown", "confidence": 0.0}

    # Check header keywords
    if any(kw in header_lower for kw in date_keywords):
        hint["likely_type"] = "date"
        hint["confidence"] = 0.7
    elif any(kw in header_lower for kw in amount_keywords):
        hint["likely_type"] = "amount"
        hint["confidence"] = 0.7
    elif any(kw in header_lower for kw in desc_keywords):
        hint["likely_type"] = "description"
        hint["confidence"] = 0.7
    elif any(kw in header_lower for kw in ref_keywords):
        hint["likely_type"] = "reference"
        hint["confidence"] = 0.6
    elif any(kw in header_lower for kw in category_keywords):
        hint["likely_type"] = "category"
        hint["confidence"] = 0.6
    elif any(kw in header_lower for kw in account_keywords):
        hint["likely_type"] = "account"
        hint["confidence"] = 0.5

    # Try to detect date format from sample data
    date_result = detect_date_format(samples)
    if date_result:
        hint["likely_type"] = "date"
        hint["detected_format"] = date_result[0]
        hint["format_display"] = date_result[1]
        hint["confidence"] = max(hint.get("confidence", 0), 0.85)

    # Try to detect amount format from sample data
    if hint["likely_type"] in ("amount", "unknown"):
        non_empty = [s for s in samples if s.strip()]
        numeric_count = 0
        for s in samples:
            cleaned = re.sub(r'[,$\s\(\)\+\-]', '', s)
            try:
                float(cleaned)
                numeric_count += 1
            except ValueError:
                pass

        if non_empty and numeric_count >= len(non_empty) * 0.8:
            amount_settings = detect_amount_format(samples)
            hint["likely_type"] = "amount"
            hint["detected_settings"] = amount_settings
            hint["confidence"] = max(hint.get("confidence", 0), 0.8)

    # If still unknown, analyze text characteristics for description detection
    if hint["likely_type"] == "unknown":
        non_empty = [s for s in samples if s.strip()]
        if non_empty:
            avg_len = sum(len(s) for s in non_empty) / len(non_empty)
            unique_ratio = len(set(non_empty)) / len(non_empty)

            # Description columns tend to have longer, varied text
            if avg_len > 15 and unique_ratio > 0.7:
                hint["likely_type"] = "description"
                hint["confidence"] = 0.5
            # Shorter varied text might be merchant
            elif avg_len > 3 and avg_len <= 30 and unique_ratio > 0.5:
                hint["likely_type"] = "merchant"
                hint["confidence"] = 0.4

    return hint


def suggest_config(headers: List[str], column_hints: Dict[str, Any]) -> Dict[str, Any]:
    """
    Suggest a CustomCsvConfig based on analyzed column hints.

    Returns a dict that can be used to create a CustomCsvConfig.
    """
    config = {
        "name": "Custom CSV Format",
        "account_source": "Custom",
        "date_column": None,
        "amount_column": None,
        "description_column": None,
        "date_format": "%m/%d/%Y",
        "amount_sign_convention": "negative_prefix",
    }

    # Find best candidates for each required column type
    date_candidates = []
    amount_candidates = []
    desc_candidates = []

    for header in headers:
        hint = column_hints.get(header, {})
        likely_type = hint.get("likely_type", "unknown")
        confidence = hint.get("confidence", 0)

        if likely_type == "date":
            date_candidates.append((header, confidence, hint))
        elif likely_type == "amount":
            amount_candidates.append((header, confidence, hint))
        elif likely_type in ("description", "merchant"):
            desc_candidates.append((header, confidence, hint))

    # Sort by confidence and pick best
    date_candidates.sort(key=lambda x: x[1], reverse=True)
    amount_candidates.sort(key=lambda x: x[1], reverse=True)
    desc_candidates.sort(key=lambda x: x[1], reverse=True)

    if date_candidates:
        config["date_column"] = date_candidates[0][0]
        date_hint = date_candidates[0][2]
        if "detected_format" in date_hint:
            config["date_format"] = date_hint["detected_format"]

    if amount_candidates:
        config["amount_column"] = amount_candidates[0][0]
        amount_hint = amount_candidates[0][2]
        if "detected_settings" in amount_hint:
            settings = amount_hint["detected_settings"]
            config["amount_sign_convention"] = settings.get("sign_convention", "negative_prefix")
            if settings.get("currency_prefix"):
                config["amount_currency_prefix"] = settings["currency_prefix"]

    if desc_candidates:
        config["description_column"] = desc_candidates[0][0]

    # Find optional columns
    for header in headers:
        hint = column_hints.get(header, {})
        likely_type = hint.get("likely_type", "unknown")

        if likely_type == "reference" and "reference_column" not in config:
            config["reference_column"] = header
        elif likely_type == "category" and "category_column" not in config:
            config["category_column"] = header
        elif likely_type == "account" and "card_member_column" not in config:
            config["card_member_column"] = header

    # Calculate completeness score
    required_found = sum([
        config["date_column"] is not None,
        config["amount_column"] is not None,
        config["description_column"] is not None,
    ])
    config["_completeness"] = required_found / 3.0

    return config
