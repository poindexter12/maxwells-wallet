"""
Property-based (fuzz) tests using Hypothesis.

These tests generate thousands of random inputs per run to discover edge cases
that example-based tests miss — particularly in parsers and encoding utilities
where input variations are combinatorial.
"""

import math
from datetime import date

from hypothesis import given, assume
from hypothesis import strategies as st

from app.parsers.base import CSVFormatParser, AmountConfig, AmountSign, DateConfig, ColumnMapping
from app.utils.pagination import encode_cursor, decode_cursor
from app.utils.hashing import compute_transaction_content_hash


# ---------------------------------------------------------------------------
# Strategies (reusable generators)
# ---------------------------------------------------------------------------

# Amounts as they'd appear in CSV: optional sign, optional $, digits, optional decimals
amount_strings = st.from_regex(
    r"-?\$?\d{1,7}(,\d{3})*(\.?\d{0,2})?",
    fullmatch=True,
)

# Valid date range for financial transactions (1990–2099)
valid_dates = st.dates(min_value=date(1990, 1, 1), max_value=date(2099, 12, 31))

# Reasonable transaction IDs
valid_ids = st.integers(min_value=1, max_value=2**53)

# Printable descriptions (no control chars)
descriptions = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=0,
    max_size=200,
)


# ---------------------------------------------------------------------------
# Helper: instantiate a minimal concrete parser for testing base class methods
# ---------------------------------------------------------------------------

class StubParser(CSVFormatParser):
    """Concrete subclass for testing base class parse_amount / parse_date."""

    format_key = "stub"
    format_name = "Stub"
    column_mapping = ColumnMapping(
        date_column="Date",
        amount_column="Amount",
        description_column="Description",
    )
    amount_config = AmountConfig()
    date_config = DateConfig()

    def can_parse(self, csv_content):
        return False, 0.0


# ==========================================================================
# parse_amount
# ==========================================================================


class TestParseAmountProperties:
    """Property-based tests for CSVFormatParser.parse_amount()."""

    def setup_method(self):
        self.parser = StubParser()

    @given(st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False))
    def test_roundtrip_negative_prefix(self, value):
        """Formatting a float as a string and parsing it back yields the same value."""
        self.parser.amount_config = AmountConfig(sign_convention=AmountSign.NEGATIVE_PREFIX)
        formatted = f"{value:.2f}"
        result = self.parser.parse_amount(formatted)
        assert result is not None
        assert math.isclose(result, round(value, 2), abs_tol=0.005)

    @given(st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False))
    def test_roundtrip_parentheses(self, value):
        """Parenthesized negative amounts parse correctly."""
        self.parser.amount_config = AmountConfig(sign_convention=AmountSign.PARENTHESES)
        if value < 0:
            formatted = f"({abs(value):.2f})"
        else:
            formatted = f"{value:.2f}"
        result = self.parser.parse_amount(formatted)
        assert result is not None
        assert math.isclose(result, round(value, 2), abs_tol=0.005)

    @given(st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False))
    def test_roundtrip_plus_minus(self, value):
        """+ / - prefixed amounts parse correctly."""
        self.parser.amount_config = AmountConfig(sign_convention=AmountSign.PLUS_MINUS_PREFIX)
        if value < 0:
            formatted = f"- {abs(value):.2f}"
        else:
            formatted = f"+ {value:.2f}"
        result = self.parser.parse_amount(formatted)
        assert result is not None
        assert math.isclose(result, round(value, 2), abs_tol=0.005)

    @given(st.floats(min_value=0.01, max_value=1e9, allow_nan=False, allow_infinity=False))
    def test_currency_prefix_stripped(self, value):
        """Dollar sign is stripped before parsing."""
        self.parser.amount_config = AmountConfig(currency_prefix="$")
        formatted = f"${value:.2f}"
        result = self.parser.parse_amount(formatted)
        assert result is not None
        assert math.isclose(result, round(value, 2), abs_tol=0.005)

    @given(st.integers(min_value=1_000, max_value=999_999_999))
    def test_thousands_separator_stripped(self, value):
        """Comma thousands separators are removed before parsing."""
        self.parser.amount_config = AmountConfig(thousands_separator=",")
        formatted = f"{value:,.2f}"
        result = self.parser.parse_amount(formatted)
        assert result is not None
        assert math.isclose(result, value, abs_tol=0.005)

    @given(st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False))
    def test_invert_sign_flips(self, value):
        """invert_sign=True negates the parsed value."""
        self.parser.amount_config = AmountConfig(invert_sign=True)
        formatted = f"{value:.2f}"
        result = self.parser.parse_amount(formatted)
        assert result is not None
        expected = -round(value, 2)
        assert math.isclose(result, expected, abs_tol=0.005)

    def test_empty_string_returns_none(self):
        result = self.parser.parse_amount("")
        assert result is None

    @given(st.text(alphabet="abcdefghijklmnopqrstuvwxyz!@#%^&*", min_size=1, max_size=20))
    def test_non_numeric_returns_none(self, garbage):
        """Completely non-numeric strings return None, never raise."""
        assume(not any(c.isdigit() for c in garbage))
        result = self.parser.parse_amount(garbage)
        assert result is None


# ==========================================================================
# parse_date
# ==========================================================================


class TestParseDateProperties:
    """Property-based tests for CSVFormatParser.parse_date()."""

    def setup_method(self):
        self.parser = StubParser()

    @given(valid_dates)
    def test_roundtrip_mmddyyyy(self, d):
        """Dates formatted as MM/DD/YYYY parse back to the original date."""
        self.parser.date_config = DateConfig(format="%m/%d/%Y")
        formatted = d.strftime("%m/%d/%Y")
        result = self.parser.parse_date(formatted)
        assert result == d

    @given(valid_dates)
    def test_roundtrip_iso(self, d):
        """ISO-formatted dates roundtrip correctly."""
        self.parser.date_config = DateConfig(use_iso_format=True)
        formatted = d.isoformat()
        result = self.parser.parse_date(formatted)
        assert result == d

    @given(valid_dates)
    def test_whitespace_tolerance(self, d):
        """Leading/trailing whitespace doesn't break date parsing."""
        self.parser.date_config = DateConfig(format="%m/%d/%Y")
        formatted = f"  {d.strftime('%m/%d/%Y')}  "
        result = self.parser.parse_date(formatted)
        assert result == d

    def test_empty_string_returns_none(self):
        result = self.parser.parse_date("")
        assert result is None

    @given(st.text(alphabet="abcdefghijklmnopqrstuvwxyz!@#%^&*", min_size=1, max_size=20))
    def test_garbage_returns_none(self, garbage):
        """Completely invalid date strings return None, never raise."""
        result = self.parser.parse_date(garbage)
        assert result is None


# ==========================================================================
# Cursor encode / decode roundtrip
# ==========================================================================


class TestCursorProperties:
    """Property-based tests for pagination cursor encoding."""

    @given(valid_dates, valid_ids)
    def test_roundtrip(self, d, txn_id):
        """encode → decode always recovers the original (date, id) pair."""
        cursor = encode_cursor(d, txn_id)
        result = decode_cursor(cursor)
        assert result is not None
        assert result == (d, txn_id)

    @given(valid_dates, valid_ids)
    def test_deterministic(self, d, txn_id):
        """Same inputs always produce the same cursor string."""
        assert encode_cursor(d, txn_id) == encode_cursor(d, txn_id)

    @given(valid_dates, valid_ids, valid_dates, valid_ids)
    def test_distinct_inputs_produce_distinct_cursors(self, d1, id1, d2, id2):
        """Different (date, id) pairs produce different cursors."""
        assume((d1, id1) != (d2, id2))
        assert encode_cursor(d1, id1) != encode_cursor(d2, id2)

    @given(st.text(min_size=0, max_size=50))
    def test_decode_never_raises(self, garbage):
        """decode_cursor returns None (not an exception) for invalid input."""
        result = decode_cursor(garbage)
        assert result is None or (isinstance(result[0], date) and isinstance(result[1], int))


# ==========================================================================
# Content hashing
# ==========================================================================


class TestContentHashProperties:
    """Property-based tests for transaction content hashing."""

    @given(valid_dates, st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False), descriptions, descriptions)
    def test_deterministic(self, d, amount, desc, account):
        """Same inputs always produce the same hash."""
        h1 = compute_transaction_content_hash(d, amount, desc, account)
        h2 = compute_transaction_content_hash(d, amount, desc, account)
        assert h1 == h2

    @given(valid_dates, st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False), descriptions, descriptions)
    def test_hash_length(self, d, amount, desc, account):
        """SHA256 hex digest is always 64 characters."""
        h = compute_transaction_content_hash(d, amount, desc, account)
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    @given(
        valid_dates,
        st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False),
        st.text(alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z"), max_codepoint=127), min_size=0, max_size=200),
    )
    def test_case_insensitive(self, d, amount, desc):
        """Description and account are lowercased, so case doesn't affect hash.

        Restricted to ASCII: Unicode case folding is not a perfect roundtrip
        (e.g. U+0149 'ŉ' uppercases to 'ʼN' which lowercases to 'ʼn' ≠ 'ŉ').
        Financial transaction descriptions are ASCII in practice.
        """
        h1 = compute_transaction_content_hash(d, amount, desc.lower(), "checking")
        h2 = compute_transaction_content_hash(d, amount, desc.upper(), "CHECKING")
        assert h1 == h2

    @given(valid_dates, st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False), descriptions)
    def test_whitespace_insensitive(self, d, amount, desc):
        """Leading/trailing whitespace on description doesn't affect hash."""
        h1 = compute_transaction_content_hash(d, amount, desc, "acct")
        h2 = compute_transaction_content_hash(d, amount, f"  {desc}  ", "  acct  ")
        assert h1 == h2

    @given(
        valid_dates,
        st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False),
        descriptions,
        descriptions,
    )
    def test_include_account_changes_hash(self, d, amount, desc, account):
        """include_account=True vs False produces different hashes (when account is non-empty)."""
        assume(account.strip() != "")
        h_with = compute_transaction_content_hash(d, amount, desc, account, include_account=True)
        h_without = compute_transaction_content_hash(d, amount, desc, account, include_account=False)
        assert h_with != h_without

    @given(valid_dates, st.floats(min_value=-1e9, max_value=1e9, allow_nan=False, allow_infinity=False), descriptions, descriptions)
    def test_amount_rounding(self, d, amount, desc, account):
        """Amounts that differ by < 0.005 produce the same hash (2-decimal rounding)."""
        h1 = compute_transaction_content_hash(d, amount, desc, account)
        # Add a tiny epsilon that doesn't change the 2-decimal representation
        h2 = compute_transaction_content_hash(d, round(amount, 2), desc, account)
        assert h1 == h2
