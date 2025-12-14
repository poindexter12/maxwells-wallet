"""
Tests for content hashing utilities used in transaction deduplication.
"""

from datetime import date

from app.utils.hashing import (
    compute_transaction_content_hash,
    compute_transaction_hash_from_dict,
)


class TestContentHashing:
    """Tests for content hash computation"""

    def test_compute_hash_returns_64_char_hex(self):
        """Hash should be 64-character SHA256 hex string"""
        result = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="amex",
        )
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_hash_is_deterministic(self):
        """Same inputs should always produce the same hash"""
        args = {
            "date": date(2025, 11, 15),
            "amount": 199.99,
            "description": "AMAZON PURCHASE",
            "account_source": "amex",
        }
        hash1 = compute_transaction_content_hash(**args)
        hash2 = compute_transaction_content_hash(**args)
        assert hash1 == hash2

    def test_hash_normalization_case_insensitive(self):
        """Description and account_source should be case-insensitive"""
        hash_upper = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="AMEX",
        )
        hash_lower = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="amazon purchase",
            account_source="amex",
        )
        assert hash_upper == hash_lower

    def test_hash_normalization_strips_whitespace(self):
        """Description and account_source should have whitespace stripped"""
        hash_clean = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="amex",
        )
        hash_whitespace = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="  AMAZON PURCHASE  ",
            account_source="  amex  ",
        )
        assert hash_clean == hash_whitespace

    def test_hash_amount_rounded_to_two_decimals(self):
        """Amount should be rounded to 2 decimal places"""
        hash1 = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="test",
            account_source="test",
        )
        hash2 = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.990000001,
            description="test",
            account_source="test",
        )
        assert hash1 == hash2

    def test_different_inputs_produce_different_hashes(self):
        """Different transactions should produce different hashes"""
        base_args = {
            "date": date(2025, 11, 15),
            "amount": 199.99,
            "description": "AMAZON PURCHASE",
            "account_source": "amex",
        }
        base_hash = compute_transaction_content_hash(**base_args)

        # Different date
        diff_date = compute_transaction_content_hash(
            date=date(2025, 11, 16), amount=199.99, description="AMAZON PURCHASE", account_source="amex"
        )
        assert diff_date != base_hash

        # Different amount
        diff_amount = compute_transaction_content_hash(
            date=date(2025, 11, 15), amount=200.00, description="AMAZON PURCHASE", account_source="amex"
        )
        assert diff_amount != base_hash

        # Different description
        diff_desc = compute_transaction_content_hash(
            date=date(2025, 11, 15), amount=199.99, description="WALMART PURCHASE", account_source="amex"
        )
        assert diff_desc != base_hash

        # Different account
        diff_account = compute_transaction_content_hash(
            date=date(2025, 11, 15), amount=199.99, description="AMAZON PURCHASE", account_source="bofa"
        )
        assert diff_account != base_hash


class TestHashFromDict:
    """Tests for dict-based hash computation"""

    def test_compute_hash_from_dict_success(self):
        """Should compute hash from valid dict"""
        txn_data = {
            "date": date(2025, 11, 15),
            "amount": 199.99,
            "description": "AMAZON PURCHASE",
            "account_source": "amex",
        }
        result = compute_transaction_hash_from_dict(txn_data)
        assert result is not None
        assert len(result) == 64

    def test_compute_hash_from_dict_matches_direct(self):
        """Dict method should produce same hash as direct method"""
        txn_data = {
            "date": date(2025, 11, 15),
            "amount": 199.99,
            "description": "AMAZON PURCHASE",
            "account_source": "amex",
        }
        dict_hash = compute_transaction_hash_from_dict(txn_data)
        direct_hash = compute_transaction_content_hash(**txn_data)
        assert dict_hash == direct_hash

    def test_compute_hash_from_dict_missing_date(self):
        """Should return None if date is missing"""
        txn_data = {
            "amount": 199.99,
            "description": "AMAZON PURCHASE",
            "account_source": "amex",
        }
        assert compute_transaction_hash_from_dict(txn_data) is None

    def test_compute_hash_from_dict_missing_amount(self):
        """Should return None if amount is missing"""
        txn_data = {
            "date": date(2025, 11, 15),
            "description": "AMAZON PURCHASE",
            "account_source": "amex",
        }
        assert compute_transaction_hash_from_dict(txn_data) is None

    def test_compute_hash_from_dict_missing_description(self):
        """Should return None if description is missing"""
        txn_data = {
            "date": date(2025, 11, 15),
            "amount": 199.99,
            "account_source": "amex",
        }
        assert compute_transaction_hash_from_dict(txn_data) is None

    def test_compute_hash_from_dict_missing_account_source(self):
        """Should return None if account_source is missing"""
        txn_data = {
            "date": date(2025, 11, 15),
            "amount": 199.99,
            "description": "AMAZON PURCHASE",
        }
        assert compute_transaction_hash_from_dict(txn_data) is None

    def test_compute_hash_from_dict_empty_dict(self):
        """Should return None for empty dict"""
        assert compute_transaction_hash_from_dict({}) is None

    def test_compute_hash_from_dict_extra_fields_ignored(self):
        """Extra fields in dict should be ignored"""
        txn_data = {
            "date": date(2025, 11, 15),
            "amount": 199.99,
            "description": "AMAZON PURCHASE",
            "account_source": "amex",
            "extra_field": "should be ignored",
            "category": "shopping",
        }
        result = compute_transaction_hash_from_dict(txn_data)
        assert result is not None
        assert len(result) == 64


class TestCrossAccountHashing:
    """Tests for cross-account duplicate detection hashing"""

    def test_hash_without_account_excludes_account(self):
        """Hash without account should be same for different accounts"""
        hash_acct1 = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="AMEX-53004",
            include_account=False,
        )
        hash_acct2 = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="BOFA-Checking",
            include_account=False,
        )
        assert hash_acct1 == hash_acct2

    def test_hash_with_account_differs_by_account(self):
        """Hash with account should differ for different accounts"""
        hash_acct1 = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="AMEX-53004",
            include_account=True,
        )
        hash_acct2 = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="BOFA-Checking",
            include_account=True,
        )
        assert hash_acct1 != hash_acct2

    def test_dict_hash_without_account(self):
        """Dict method should support include_account parameter"""
        txn_data = {
            "date": date(2025, 11, 15),
            "amount": 199.99,
            "description": "AMAZON PURCHASE",
            "account_source": "amex",
        }
        hash_with = compute_transaction_hash_from_dict(txn_data, include_account=True)
        hash_without = compute_transaction_hash_from_dict(txn_data, include_account=False)
        assert hash_with != hash_without
        assert len(hash_with) == 64
        assert len(hash_without) == 64

    def test_hash_without_account_still_differs_by_content(self):
        """Hash without account should still differ by date/amount/description"""
        base_hash = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="any",
            include_account=False,
        )

        # Different date
        diff_date = compute_transaction_content_hash(
            date=date(2025, 11, 16),
            amount=199.99,
            description="AMAZON PURCHASE",
            account_source="any",
            include_account=False,
        )
        assert diff_date != base_hash

        # Different amount
        diff_amount = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=200.00,
            description="AMAZON PURCHASE",
            account_source="any",
            include_account=False,
        )
        assert diff_amount != base_hash

        # Different description
        diff_desc = compute_transaction_content_hash(
            date=date(2025, 11, 15),
            amount=199.99,
            description="WALMART PURCHASE",
            account_source="any",
            include_account=False,
        )
        assert diff_desc != base_hash
