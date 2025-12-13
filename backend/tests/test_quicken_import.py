"""
Tests for Quicken format imports: QIF and QFX/OFX

Tests cover:
- QIF (Quicken Interchange Format) text-based parsing
- QFX/OFX (Open Financial Exchange) XML-based parsing
- Format auto-detection
- API endpoint integration
"""

import pytest
from httpx import AsyncClient
from datetime import date
import io

from app.parsers import ParserRegistry, ParsedTransaction
from app.csv_parser import detect_format, parse_csv, parse_qif, parse_qfx
from app.models import ImportFormatType


# =============================================================================
# Sample Test Data
# =============================================================================

SAMPLE_QIF_BANK = """!Type:Bank
D12/15/2024
T-150.00
PAMAZON.COM
MORDER #123-456
LOnline Shopping
^
D12/10/2024
T1500.00
PPAYROLL
MBI-WEEKLY SALARY
LIncome:Salary
^
D12/05/2024
T-45.50
PSTARBUCKS
MCoffee
LFood:Dining
N1001
^
"""

SAMPLE_QIF_CCARD = """!Type:CCard
D12/15/2024
T-75.00
PWALMART
MGroceries
LGroceries
^
D12/10/2024
T500.00
PPAYMENT - THANK YOU
^
"""

SAMPLE_QIF_MULTI_ACCOUNT = """!Account
NChecking
TBank
^
!Type:Bank
D12/15/2024
T-100.00
PGAS STATION
^
!Account
NCredit Card
TCCard
^
!Type:CCard
D12/15/2024
T-50.00
PSTORE
^
"""

SAMPLE_QFX = """OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0</CODE></STATUS>
<DTSERVER>20241215120000</DTSERVER>
<LANGUAGE>ENG</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD</CURDEF>
<BANKACCTFROM>
<BANKID>123456789</BANKID>
<ACCTID>987654321</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20241201</DTSTART>
<DTEND>20241215</DTEND>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20241215</DTPOSTED>
<TRNAMT>-150.00</TRNAMT>
<FITID>2024121500001</FITID>
<NAME>AMAZON.COM</NAME>
<MEMO>ORDER #123-456</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20241210</DTPOSTED>
<TRNAMT>1500.00</TRNAMT>
<FITID>2024121000001</FITID>
<NAME>PAYROLL</NAME>
<MEMO>BI-WEEKLY SALARY</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20241205</DTPOSTED>
<TRNAMT>-45.50</TRNAMT>
<FITID>2024120500001</FITID>
<NAME>STARBUCKS</NAME>
<CHECKNUM>1001</CHECKNUM>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
"""

SAMPLE_QFX_CCARD = """<?xml version="1.0" encoding="utf-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0</CODE></STATUS>
<DTSERVER>20241215120000[-5:EST]</DTSERVER>
</SONRS>
</SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<CURDEF>USD</CURDEF>
<CCACCTFROM>
<ACCTID>1234567890</ACCTID>
</CCACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20241215120000[-5:EST]</DTPOSTED>
<TRNAMT>-75.00</TRNAMT>
<FITID>CC20241215001</FITID>
<NAME>WALMART</NAME>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20241210</DTPOSTED>
<TRNAMT>500.00</TRNAMT>
<FITID>CC20241210001</FITID>
<NAME>PAYMENT THANK YOU</NAME>
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>
"""


# =============================================================================
# Parser Registry Tests
# =============================================================================


class TestQuickenParsersRegistration:
    """Test QIF and QFX parsers are registered correctly"""

    def test_qif_parser_registered(self):
        """QIF parser should be registered"""
        keys = ParserRegistry.get_format_keys()
        assert "qif" in keys

    def test_qfx_parser_registered(self):
        """QFX parser should be registered"""
        keys = ParserRegistry.get_format_keys()
        assert "qfx" in keys

    def test_get_qif_parser(self):
        """Can get QIF parser by key"""
        parser = ParserRegistry.get_parser("qif")
        assert parser is not None
        assert parser.format_key == "qif"
        assert parser.format_name == "Quicken QIF"

    def test_get_qfx_parser(self):
        """Can get QFX parser by key"""
        parser = ParserRegistry.get_parser("qfx")
        assert parser is not None
        assert parser.format_key == "qfx"
        assert parser.format_name == "Quicken QFX/OFX"


# =============================================================================
# QIF Format Detection Tests
# =============================================================================


class TestQIFFormatDetection:
    """Test QIF format auto-detection"""

    def test_detect_qif_bank_format(self):
        """Detect QIF format by !Type:Bank header"""
        parser, confidence = ParserRegistry.detect_format(SAMPLE_QIF_BANK)
        assert parser is not None
        assert parser.format_key == "qif"
        assert confidence >= 0.9

    def test_detect_qif_ccard_format(self):
        """Detect QIF format by !Type:CCard header"""
        parser, confidence = ParserRegistry.detect_format(SAMPLE_QIF_CCARD)
        assert parser is not None
        assert parser.format_key == "qif"
        assert confidence >= 0.9

    def test_detect_format_wrapper_qif(self):
        """detect_format() wrapper returns correct type for QIF"""
        result = detect_format(SAMPLE_QIF_BANK)
        assert result == ImportFormatType.qif


# =============================================================================
# QFX/OFX Format Detection Tests
# =============================================================================


class TestQFXFormatDetection:
    """Test QFX/OFX format auto-detection"""

    def test_detect_qfx_by_ofx_tag(self):
        """Detect QFX format by <OFX> tag"""
        parser, confidence = ParserRegistry.detect_format(SAMPLE_QFX)
        assert parser is not None
        assert parser.format_key == "qfx"
        assert confidence >= 0.9

    def test_detect_qfx_by_ofxheader(self):
        """Detect QFX format by OFXHEADER"""
        content = "OFXHEADER:100\nDATA:OFXSGML\n<OFX></OFX>"
        parser, confidence = ParserRegistry.detect_format(content)
        assert parser is not None
        assert parser.format_key == "qfx"

    def test_detect_qfx_by_stmttrn(self):
        """Detect QFX format by <STMTTRN> element"""
        content = "<STMTTRN><TRNAMT>-50.00</TRNAMT></STMTTRN>"
        parser, confidence = ParserRegistry.detect_format(content)
        assert parser is not None
        assert parser.format_key == "qfx"

    def test_detect_format_wrapper_qfx(self):
        """detect_format() wrapper returns correct type for QFX"""
        result = detect_format(SAMPLE_QFX)
        assert result == ImportFormatType.qfx


# =============================================================================
# QIF Parsing Tests
# =============================================================================


class TestQIFParser:
    """Test QIF file parsing"""

    def test_parse_basic_qif_transactions(self):
        """Parse basic QIF bank transactions"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(SAMPLE_QIF_BANK, "QIF-Test")

        assert len(transactions) == 3

        # First transaction (expense)
        assert transactions[0].date == date(2024, 12, 15)
        assert transactions[0].amount == -150.00
        assert transactions[0].merchant == "AMAZON.COM"
        assert "ORDER #123-456" in transactions[0].description

        # Second transaction (income)
        assert transactions[1].date == date(2024, 12, 10)
        assert transactions[1].amount == 1500.00
        assert transactions[1].merchant == "PAYROLL"

        # Third transaction (with check number)
        assert transactions[2].date == date(2024, 12, 5)
        assert transactions[2].amount == -45.50
        assert "qif_2024-12-05_1001" in transactions[2].reference_id

    def test_parse_qif_credit_card(self):
        """Parse QIF credit card transactions"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(SAMPLE_QIF_CCARD, "QIF-CC")

        assert len(transactions) == 2
        assert transactions[0].amount == -75.00
        assert transactions[0].merchant == "WALMART"
        assert transactions[1].amount == 500.00  # Payment

    def test_parse_qif_with_category(self):
        """Parse QIF with category field"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(SAMPLE_QIF_BANK)

        # First transaction has category "Online Shopping"
        assert transactions[0].source_category == "Online Shopping"

    def test_parse_qif_multi_account(self):
        """Parse QIF with multiple accounts"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(SAMPLE_QIF_MULTI_ACCOUNT)

        # Should parse transactions from both accounts
        assert len(transactions) == 2

    def test_qif_date_formats(self):
        """Parse various QIF date formats"""
        qif_content = """!Type:Bank
D01/05/2024
T-50.00
PTEST1
^
D1/5/24
T-25.00
PTEST2
^
D12/31'2024
T-75.00
PTEST3
^
"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(qif_content)

        assert len(transactions) == 3
        assert transactions[0].date == date(2024, 1, 5)
        assert transactions[1].date == date(2024, 1, 5)
        assert transactions[2].date == date(2024, 12, 31)

    def test_qif_amount_with_commas(self):
        """Parse QIF amounts with thousands separators"""
        qif_content = """!Type:Bank
D12/15/2024
T-1,234.56
PLARGE PURCHASE
^
D12/10/2024
T10,000.00
PBIG DEPOSIT
^
"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(qif_content)

        assert transactions[0].amount == -1234.56
        assert transactions[1].amount == 10000.00

    def test_qif_returns_parsed_transaction_objects(self):
        """QIF parser returns ParsedTransaction objects"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(SAMPLE_QIF_BANK)

        assert all(isinstance(t, ParsedTransaction) for t in transactions)

    def test_qif_account_source_default(self):
        """QIF uses account type as default source"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(SAMPLE_QIF_BANK)

        # Should default to QIF-Bank when no account_source provided
        assert transactions[0].account_source == "QIF-Bank"

    def test_qif_account_source_override(self):
        """Account source can be overridden"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(SAMPLE_QIF_BANK, "My-Checking")

        assert transactions[0].account_source == "My-Checking"


# =============================================================================
# QFX/OFX Parsing Tests
# =============================================================================


class TestQFXParser:
    """Test QFX/OFX file parsing"""

    def test_parse_basic_qfx_transactions(self):
        """Parse basic QFX transactions"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(SAMPLE_QFX, "QFX-Test")

        assert len(transactions) == 3

        # First transaction (debit)
        assert transactions[0].date == date(2024, 12, 15)
        assert transactions[0].amount == -150.00
        assert transactions[0].merchant == "AMAZON.COM"
        assert "ORDER #123-456" in transactions[0].description

        # Second transaction (credit/income)
        assert transactions[1].date == date(2024, 12, 10)
        assert transactions[1].amount == 1500.00
        assert transactions[1].merchant == "PAYROLL"

        # Third transaction
        assert transactions[2].date == date(2024, 12, 5)
        assert transactions[2].amount == -45.50

    def test_qfx_fitid_as_reference(self):
        """FITID used as reference ID for deduplication"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(SAMPLE_QFX)

        # FITID should be in reference_id
        assert "2024121500001" in transactions[0].reference_id
        assert "2024121000001" in transactions[1].reference_id

    def test_parse_qfx_credit_card(self):
        """Parse QFX credit card format"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(SAMPLE_QFX_CCARD)

        assert len(transactions) == 2
        assert transactions[0].amount == -75.00
        assert transactions[1].amount == 500.00

    def test_qfx_date_with_timezone(self):
        """Parse QFX dates with timezone offset"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(SAMPLE_QFX_CCARD)

        # Date should be parsed despite [-5:EST] suffix
        assert transactions[0].date == date(2024, 12, 15)

    def test_qfx_account_extraction(self):
        """Extract account info from QFX"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(SAMPLE_QFX)

        # Should extract and mask account ID
        assert "QFX" in transactions[0].account_source
        assert "4321" in transactions[0].account_source  # Last 4 digits

    def test_qfx_account_source_override(self):
        """Account source can be overridden"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(SAMPLE_QFX, "My-Bank-Account")

        assert transactions[0].account_source == "My-Bank-Account"

    def test_qfx_returns_parsed_transaction_objects(self):
        """QFX parser returns ParsedTransaction objects"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(SAMPLE_QFX)

        assert all(isinstance(t, ParsedTransaction) for t in transactions)


# =============================================================================
# Wrapper Function Tests
# =============================================================================


class TestQuickenWrapperFunctions:
    """Test backwards-compatible wrapper functions"""

    def test_parse_qif_wrapper(self):
        """parse_qif() wrapper function works"""
        transactions = parse_qif(SAMPLE_QIF_BANK, "Test-Account")

        assert len(transactions) == 3
        assert isinstance(transactions[0], dict)
        assert transactions[0]["amount"] == -150.00

    def test_parse_qfx_wrapper(self):
        """parse_qfx() wrapper function works"""
        transactions = parse_qfx(SAMPLE_QFX, "Test-Account")

        assert len(transactions) == 3
        assert isinstance(transactions[0], dict)
        assert transactions[0]["amount"] == -150.00

    def test_parse_csv_handles_qif(self):
        """parse_csv() handles QIF format"""
        transactions, format_type = parse_csv(SAMPLE_QIF_BANK)

        assert format_type == ImportFormatType.qif
        assert len(transactions) == 3

    def test_parse_csv_handles_qfx(self):
        """parse_csv() handles QFX format"""
        transactions, format_type = parse_csv(SAMPLE_QFX)

        assert format_type == ImportFormatType.qfx
        assert len(transactions) == 3

    def test_parse_csv_with_qif_format_hint(self):
        """parse_csv() respects QIF format hint"""
        transactions, format_type = parse_csv(SAMPLE_QIF_BANK, format_hint=ImportFormatType.qif)

        assert format_type == ImportFormatType.qif
        assert len(transactions) == 3


# =============================================================================
# API Integration Tests
# =============================================================================


class TestQuickenAPIImport:
    """Test API endpoints for QIF/QFX import"""

    @pytest.mark.asyncio
    async def test_preview_qif_file(self, client: AsyncClient, seed_categories):
        """Preview QIF file import"""
        files = {"file": ("bank.qif", io.BytesIO(SAMPLE_QIF_BANK.encode()), "text/plain")}

        response = await client.post("/api/v1/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()

        assert data["detected_format"] == "qif"
        assert data["transaction_count"] == 3
        assert len(data["transactions"]) == 3

    @pytest.mark.asyncio
    async def test_preview_qfx_file(self, client: AsyncClient, seed_categories):
        """Preview QFX file import"""
        files = {"file": ("bank.qfx", io.BytesIO(SAMPLE_QFX.encode()), "text/plain")}

        response = await client.post("/api/v1/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()

        assert data["detected_format"] == "qfx"
        assert data["transaction_count"] == 3

    @pytest.mark.asyncio
    async def test_preview_ofx_file(self, client: AsyncClient, seed_categories):
        """Preview OFX file import (same as QFX)"""
        files = {"file": ("bank.ofx", io.BytesIO(SAMPLE_QFX.encode()), "text/plain")}

        response = await client.post("/api/v1/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()

        assert data["detected_format"] == "qfx"

    @pytest.mark.asyncio
    async def test_confirm_qif_import(self, client: AsyncClient, seed_categories):
        """Confirm QIF file import"""
        files = {"file": ("bank.qif", io.BytesIO(SAMPLE_QIF_BANK.encode()), "text/plain")}
        data_payload = {"format_type": "qif", "account_source": "QIF-Checking"}

        response = await client.post("/api/v1/import/confirm", files=files, data=data_payload)

        assert response.status_code == 200
        data = response.json()

        assert data["imported"] == 3
        assert data["duplicates"] == 0

    @pytest.mark.asyncio
    async def test_confirm_qfx_import(self, client: AsyncClient, seed_categories):
        """Confirm QFX file import"""
        files = {"file": ("bank.qfx", io.BytesIO(SAMPLE_QFX.encode()), "text/plain")}
        data_payload = {"format_type": "qfx", "account_source": "QFX-Checking"}

        response = await client.post("/api/v1/import/confirm", files=files, data=data_payload)

        assert response.status_code == 200
        data = response.json()

        assert data["imported"] == 3
        assert data["duplicates"] == 0

    @pytest.mark.asyncio
    async def test_qfx_duplicate_detection_by_fitid(self, client: AsyncClient, seed_categories):
        """QFX FITID enables reliable duplicate detection"""
        # Create unique test data with unique FITID
        unique_qfx = """<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20241220</DTPOSTED>
<TRNAMT>-99.99</TRNAMT>
<FITID>UNIQUE_FITID_TEST_123</FITID>
<NAME>TEST MERCHANT</NAME>
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
"""
        # First import
        files = {"file": ("test.qfx", io.BytesIO(unique_qfx.encode()), "text/plain")}
        data_payload = {"format_type": "qfx", "account_source": "QFX-Test"}

        response1 = await client.post("/api/v1/import/confirm", files=files, data=data_payload)
        assert response1.status_code == 200
        assert response1.json()["imported"] == 1

        # Second import should detect duplicate
        files2 = {"file": ("test.qfx", io.BytesIO(unique_qfx.encode()), "text/plain")}
        response2 = await client.post("/api/v1/import/confirm", files=files2, data=data_payload)
        assert response2.status_code == 200
        assert response2.json()["duplicates"] == 1
        assert response2.json()["imported"] == 0

    @pytest.mark.asyncio
    async def test_reject_unsupported_extension(self, client: AsyncClient):
        """Reject files with unsupported extensions"""
        files = {"file": ("data.txt", io.BytesIO(b"some content"), "text/plain")}

        response = await client.post("/api/v1/import/preview", files=files)

        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "IMPORT_UNSUPPORTED_FORMAT"


# =============================================================================
# Edge Cases and Error Handling
# =============================================================================


class TestQuickenEdgeCases:
    """Test edge cases and error handling"""

    def test_qif_empty_file(self):
        """Handle empty QIF file"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse("")

        assert len(transactions) == 0

    def test_qif_header_only(self):
        """Handle QIF with header only, no transactions"""
        content = "!Type:Bank\n"
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(content)

        assert len(transactions) == 0

    def test_qif_missing_amount(self):
        """Skip QIF records with missing amount"""
        content = """!Type:Bank
D12/15/2024
PTEST MERCHANT
^
D12/10/2024
T-50.00
PVALID TRANSACTION
^
"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(content)

        # Only the valid transaction should be parsed
        assert len(transactions) == 1
        assert transactions[0].amount == -50.00

    def test_qif_missing_date(self):
        """Skip QIF records with missing date"""
        content = """!Type:Bank
T-50.00
PTEST MERCHANT
^
D12/10/2024
T-25.00
PVALID TRANSACTION
^
"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(content)

        assert len(transactions) == 1
        assert transactions[0].date == date(2024, 12, 10)

    def test_qfx_empty_file(self):
        """Handle empty QFX file"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse("")

        assert len(transactions) == 0

    def test_qfx_no_transactions(self):
        """Handle QFX with no STMTTRN elements"""
        content = "<OFX><BANKTRANLIST></BANKTRANLIST></OFX>"
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(content)

        assert len(transactions) == 0

    def test_qfx_malformed_amount(self):
        """Handle malformed amounts in QFX"""
        content = """<OFX><BANKTRANLIST>
<STMTTRN>
<DTPOSTED>20241215</DTPOSTED>
<TRNAMT>invalid</TRNAMT>
<FITID>TEST1</FITID>
<NAME>TEST</NAME>
</STMTTRN>
<STMTTRN>
<DTPOSTED>20241215</DTPOSTED>
<TRNAMT>-50.00</TRNAMT>
<FITID>TEST2</FITID>
<NAME>VALID</NAME>
</STMTTRN>
</BANKTRANLIST></OFX>
"""
        parser = ParserRegistry.get_parser("qfx")
        transactions = parser.parse(content)

        # Only valid transaction should be parsed
        assert len(transactions) == 1
        assert transactions[0].amount == -50.00

    def test_qif_file_without_ending_caret(self):
        """Handle QIF file that doesn't end with ^"""
        content = """!Type:Bank
D12/15/2024
T-50.00
PTEST
"""
        parser = ParserRegistry.get_parser("qif")
        transactions = parser.parse(content)

        # Should still parse the transaction
        assert len(transactions) == 1
