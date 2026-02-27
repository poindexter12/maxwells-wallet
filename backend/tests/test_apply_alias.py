"""Unit tests for the apply_alias_to_text helper in merchants router."""

from unittest.mock import MagicMock
from app.routers.merchants import apply_alias_to_text
from app.orm import MerchantAliasMatchType


def _make_alias(pattern: str, match_type: MerchantAliasMatchType) -> MagicMock:
    alias = MagicMock()
    alias.pattern = pattern
    alias.match_type = match_type
    return alias


class TestApplyAliasToText:
    def test_empty_text_returns_false(self):
        alias = _make_alias("AMZN", MerchantAliasMatchType.contains)
        assert apply_alias_to_text(alias, "") is False

    def test_none_text_returns_false(self):
        alias = _make_alias("AMZN", MerchantAliasMatchType.contains)
        assert apply_alias_to_text(alias, None) is False

    def test_exact_match(self):
        alias = _make_alias("Amazon", MerchantAliasMatchType.exact)
        assert apply_alias_to_text(alias, "amazon") is True
        assert apply_alias_to_text(alias, "Amazon Prime") is False

    def test_contains_match(self):
        alias = _make_alias("AMZN", MerchantAliasMatchType.contains)
        assert apply_alias_to_text(alias, "AMZN MKTP US") is True
        assert apply_alias_to_text(alias, "Target") is False

    def test_regex_match(self):
        alias = _make_alias(r"STARBUCKS.*\d+", MerchantAliasMatchType.regex)
        assert apply_alias_to_text(alias, "STARBUCKS #1234") is True
        assert apply_alias_to_text(alias, "Dunkin Donuts") is False

    def test_regex_invalid_pattern_returns_false(self):
        alias = _make_alias("[invalid(regex", MerchantAliasMatchType.regex)
        assert apply_alias_to_text(alias, "anything") is False
