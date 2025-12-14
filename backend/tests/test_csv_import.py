"""
Tests for FR-001: CSV Import
Comprehensive tests for all CSV import formats:
- BofA Bank (checking/savings)
- BofA Credit Card
- Amex Credit Card
- Inspira HSA
- Venmo

Tests both the new parser class system and the backwards-compatible wrapper.
"""

import pytest
from httpx import AsyncClient
from datetime import date
import io

# New parser system (preferred)
from app.parsers import ParserRegistry, ParsedTransaction

# Backwards-compat wrapper (deprecated but still tested)
from app.csv_parser import (
    detect_format,
    parse_csv,
    parse_bofa_csv,
    parse_bofa_cc_csv,
    parse_amex_csv,
    parse_inspira_hsa_csv,
    parse_venmo_csv,
    extract_merchant_from_description,
    map_amex_category,
)
from app.models import ImportFormatType


# =============================================================================
# Tests for New Parser Registry System
# =============================================================================


class TestParserRegistry:
    """Test the ParserRegistry class"""

    def test_all_parsers_registered(self):
        """All 7 parsers should be registered"""
        keys = ParserRegistry.get_format_keys()
        assert "bofa_bank" in keys
        assert "bofa_cc" in keys
        assert "amex_cc" in keys
        assert "inspira_hsa" in keys
        assert "venmo" in keys
        assert "qif" in keys
        assert "qfx" in keys
        assert len(keys) == 7

    def test_get_parser_by_key(self):
        """Get parser instance by format_key"""
        parser = ParserRegistry.get_parser("amex_cc")
        assert parser is not None
        assert parser.format_key == "amex_cc"
        assert parser.format_name == "American Express"

    def test_get_parser_unknown_key(self):
        """Unknown key returns None"""
        parser = ParserRegistry.get_parser("unknown_format")
        assert parser is None

    def test_detect_format_returns_parser(self):
        """detect_format returns parser instance and confidence"""
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,AMAZON,JOHN DOE,XXXXX-53004,50.00
"""
        parser, confidence = ParserRegistry.detect_format(csv_content)
        assert parser is not None
        assert parser.format_key == "amex_cc"
        assert confidence >= 0.9

    def test_detect_format_unknown(self):
        """Unknown format returns None parser"""
        csv_content = """Random,Headers,Here
1,2,3
"""
        parser, confidence = ParserRegistry.detect_format(csv_content)
        assert parser is None
        assert confidence == 0.0

    def test_get_format_names(self):
        """get_format_names returns key->name mapping"""
        names = ParserRegistry.get_format_names()
        assert names["amex_cc"] == "American Express"
        assert names["bofa_bank"] == "Bank of America Bank"
        assert names["venmo"] == "Venmo"


class TestBackwardsCompatWrapper:
    """Test that the csv_parser.py wrapper correctly delegates to ParserRegistry"""

    def test_wrapper_detect_format_uses_registry(self):
        """detect_format() should use ParserRegistry.detect_format()"""
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,AMAZON,JOHN DOE,XXXXX-53004,50.00
"""
        # Wrapper function
        wrapper_result = detect_format(csv_content)

        # Direct registry call
        parser, confidence = ParserRegistry.detect_format(csv_content)

        # Should produce the same format
        assert wrapper_result.value == parser.format_key

    def test_wrapper_parse_csv_matches_registry(self):
        """parse_csv() should produce same results as ParserRegistry"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,199.99,,,,,,,320251150001,Merchandise
"""
        # Wrapper function
        wrapper_txns, wrapper_format = parse_csv(csv_content)

        # Direct registry call
        parser = ParserRegistry.get_parser("amex_cc")
        registry_txns = parser.parse(csv_content)

        # Same count and amounts
        assert len(wrapper_txns) == len(registry_txns)
        assert wrapper_txns[0]["amount"] == registry_txns[0].amount
        assert wrapper_txns[0]["merchant"] == registry_txns[0].merchant

    def test_wrapper_parse_bofa_csv_matches_registry(self):
        """parse_bofa_csv() should delegate to BofaBankParser"""
        csv_content = """Date,Description,Amount,Running Bal.
11/15/2025,PAYROLL DEPOSIT,3500.00,4734.56
"""
        # Wrapper function
        wrapper_txns = parse_bofa_csv(csv_content, "BOFA-Test")

        # Direct registry call
        parser = ParserRegistry.get_parser("bofa_bank")
        registry_txns = parser.parse(csv_content, "BOFA-Test")

        assert len(wrapper_txns) == len(registry_txns)
        assert wrapper_txns[0]["amount"] == registry_txns[0].amount

    def test_wrapper_map_amex_category_matches_parser(self):
        """map_amex_category() should delegate to AmexCCParser.map_category()"""
        from app.parsers.formats.amex_cc import AmexCCParser

        # Wrapper function
        wrapper_result = map_amex_category("Restaurant-Dining")

        # Direct parser call
        parser = AmexCCParser()
        parser_result = parser.map_category("Restaurant-Dining")

        assert wrapper_result == parser_result == "Dining & Coffee"

    def test_wrapper_returns_dict_format(self):
        """Wrapper functions should return dicts (not ParsedTransaction)"""
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,TEST,JOHN DOE,XXXXX-53004,50.00
"""
        wrapper_txns, _ = parse_csv(csv_content)

        # Wrapper returns dicts
        assert isinstance(wrapper_txns[0], dict)
        assert "date" in wrapper_txns[0]
        assert "amount" in wrapper_txns[0]

        # Registry returns ParsedTransaction
        parser = ParserRegistry.get_parser("amex_cc")
        registry_txns = parser.parse(csv_content)
        assert isinstance(registry_txns[0], ParsedTransaction)


class TestParserClassesDirect:
    """Test parser classes directly (not through wrapper)"""

    def test_amex_parser_parse(self):
        """AmexCCParser.parse() returns ParsedTransaction objects"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,199.99,,,,,,,320251150001,Merchandise
"""
        parser = ParserRegistry.get_parser("amex_cc")
        transactions = parser.parse(csv_content)

        assert len(transactions) == 1
        assert isinstance(transactions[0], ParsedTransaction)
        assert transactions[0].amount == -199.99  # Inverted for expenses
        assert transactions[0].merchant == "AMAZON.COM"
        assert transactions[0].suggested_category == "Shopping"

    def test_bofa_bank_parser_parse(self):
        """BofaBankParser.parse() returns ParsedTransaction objects"""
        csv_content = """Date,Description,Amount,Running Bal.
11/15/2025,PAYROLL DEPOSIT,3500.00,4734.56
11/10/2025,AMAZON PURCHASE,-199.99,1234.56
"""
        parser = ParserRegistry.get_parser("bofa_bank")
        transactions = parser.parse(csv_content, "BOFA-Checking")

        assert len(transactions) == 2
        assert isinstance(transactions[0], ParsedTransaction)
        assert transactions[0].amount == 3500.00
        assert transactions[0].account_source == "BOFA-Checking"

    def test_venmo_parser_parse(self):
        """VenmoParser.parse() returns ParsedTransaction objects"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,1234567890,2025-09-05T04:06:46,Payment,Complete,Test note,John Doe,Jane Smith,- $35.00,
"""
        parser = ParserRegistry.get_parser("venmo")
        transactions = parser.parse(csv_content, "Venmo")

        assert len(transactions) == 1
        assert isinstance(transactions[0], ParsedTransaction)
        assert transactions[0].amount == -35.00
        assert transactions[0].description == "Test note"

    def test_inspira_parser_parse(self):
        """InspiraHSAParser.parse() returns ParsedTransaction objects"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for","Contribution year","Document attached","Trade Details","Investment rebalance","Is Investment Trans Type","Verification Status"
"12345","Contribution","01/15/2025","01/15/2025","Employer HSA","$500.00","","","","","","","",""
"""
        parser = ParserRegistry.get_parser("inspira_hsa")
        transactions = parser.parse(csv_content, "Inspira-HSA")

        assert len(transactions) == 1
        assert isinstance(transactions[0], ParsedTransaction)
        assert transactions[0].amount == 500.00
        assert transactions[0].reference_id == "12345"

    def test_parsed_transaction_to_dict(self):
        """ParsedTransaction.to_dict() for API compatibility"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,TEST MERCHANT,JOHN DOE,XXXXX-53004,50.00,,,,,,,REF123,Merchandise
"""
        parser = ParserRegistry.get_parser("amex_cc")
        transactions = parser.parse(csv_content)

        tx_dict = transactions[0].to_dict()
        assert isinstance(tx_dict, dict)
        assert tx_dict["date"] == date(2025, 11, 15)
        assert tx_dict["amount"] == -50.00
        assert tx_dict["merchant"] == "TEST MERCHANT"


# =============================================================================
# Unit Tests for CSV Parser Functions
# =============================================================================


class TestFormatDetection:
    """Test format auto-detection for all supported formats"""

    def test_detect_bofa_bank_format(self):
        """Detect BofA bank format by Running Bal. column"""
        csv_content = """Summary Bal.,$1234.56
Some header line

Date,Description,Amount,Running Bal.
11/15/2025,PAYROLL DEPOSIT,3500.00,4734.56
"""
        assert detect_format(csv_content) == ImportFormatType.bofa_bank

    def test_detect_bofa_cc_format(self):
        """Detect BofA CC format by Posted Date, Reference Number, Payee"""
        csv_content = """Posted Date,Reference Number,Payee,Address,Amount
11/26/2025,12345678901234567890,"Coffee Shop","",-5.50
"""
        assert detect_format(csv_content) == ImportFormatType.bofa_cc

    def test_detect_amex_format(self):
        """Detect Amex format by Card Member and Account # columns"""
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99
"""
        assert detect_format(csv_content) == ImportFormatType.amex_cc

    def test_detect_inspira_hsa_format(self):
        """Detect Inspira HSA format by Transaction ID, Transaction Type, Expense Category"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for"
"12345","Contribution","01/15/2025","01/15/2025","HSA Contribution","$500.00","","Myself"
"""
        assert detect_format(csv_content) == ImportFormatType.inspira_hsa

    def test_detect_venmo_format_by_header(self):
        """Detect Venmo format by Account Statement header"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
"""
        assert detect_format(csv_content) == ImportFormatType.venmo

    def test_detect_venmo_format_by_columns(self):
        """Detect Venmo format by ID, Datetime, From, To columns"""
        csv_content = """,ID,Datetime,Type,Status,Note,From,To,Amount (total)
,1234567890,2025-09-05T04:06:46,Payment,Complete,Test payment,John Doe,Jane Smith,- $35.00
"""
        assert detect_format(csv_content) == ImportFormatType.venmo

    def test_detect_unknown_format(self):
        """Unknown format for unrecognized CSV structure"""
        csv_content = """Column1,Column2,Column3
value1,value2,value3
"""
        assert detect_format(csv_content) == ImportFormatType.unknown


class TestBofaBankParser:
    """Test BofA bank (checking/savings) CSV parsing"""

    def test_parse_basic_transactions(self):
        """Parse standard BofA bank transactions"""
        csv_content = """Summary Bal.,$1234.56
Some header

Date,Description,Amount,Running Bal.
11/15/2025,PAYROLL DEPOSIT,3500.00,4734.56
11/10/2025,AMAZON PURCHASE,-199.99,1234.56
11/05/2025,ATM WITHDRAWAL,-200.00,1434.55
"""
        transactions = parse_bofa_csv(csv_content, "BOFA-Checking")

        assert len(transactions) == 3
        assert transactions[0]["amount"] == 3500.00
        assert transactions[0]["date"] == date(2025, 11, 15)
        assert transactions[0]["account_source"] == "BOFA-Checking"
        assert transactions[1]["amount"] == -199.99
        assert transactions[2]["amount"] == -200.00

    def test_parse_with_commas_in_amounts(self):
        """Handle amounts with commas (e.g., 1,234.56)"""
        csv_content = """Date,Description,Amount,Running Bal.
11/15/2025,LARGE DEPOSIT,"10,000.00","11,234.56"
11/10/2025,BIG PURCHASE,"-1,500.00","1,234.56"
"""
        transactions = parse_bofa_csv(csv_content, "BOFA-Savings")

        assert len(transactions) == 2
        assert transactions[0]["amount"] == 10000.00
        assert transactions[1]["amount"] == -1500.00

    def test_skip_summary_rows(self):
        """Skip balance summary rows"""
        csv_content = """Date,Description,Amount,Running Bal.
Beginning balance on 11/01/2025,,,1000.00
11/15/2025,DEPOSIT,500.00,1500.00
Ending balance on 11/30/2025,,,1500.00
"""
        transactions = parse_bofa_csv(csv_content, "BOFA-Test")

        assert len(transactions) == 1
        assert transactions[0]["amount"] == 500.00

    def test_merchant_extraction(self):
        """Extract merchant from BofA descriptions"""
        csv_content = """Date,Description,Amount,Running Bal.
11/15/2025,VENMO DES:PAYMENT ID:XXXXX78391 INDN:JOHN DOE CO,-50.00,950.00
11/10/2025,HAEMONETICS DES:PAYROLL ID:XXXXX9028 INDN:DOE JOHN,3500.00,1000.00
11/05/2025,T-MOBILE DES:PCS SVC ID:6527371,-85.00,1050.00
"""
        transactions = parse_bofa_csv(csv_content, "BOFA-Checking")

        assert transactions[0]["merchant"] == "VENMO"
        assert transactions[1]["merchant"] == "HAEMONETICS"
        assert transactions[2]["merchant"] == "T-MOBILE"


class TestBofaCCParser:
    """Test BofA Credit Card CSV parsing"""

    def test_parse_basic_transactions(self):
        """Parse standard BofA CC transactions"""
        csv_content = """Posted Date,Reference Number,Payee,Address,Amount
11/26/2025,74863985329012411622105,"Coffee Shop Downtown","123 Main St",-5.50
11/25/2025,24138935328002638002967,"Gas Station","456 Oak Ave",-45.00
11/21/2025,32583204320112100065939,"PAYMENT - THANK YOU","",3846.96
"""
        transactions = parse_bofa_cc_csv(csv_content, "BOFA-CC-1234")

        assert len(transactions) == 3
        assert transactions[0]["amount"] == -5.50
        assert transactions[0]["merchant"] == "Coffee Shop Downtown"
        assert transactions[1]["amount"] == -45.00
        assert transactions[2]["amount"] == 3846.96  # Payment is positive

    def test_reference_number_used_as_id(self):
        """Use reference number as transaction ID"""
        csv_content = """Posted Date,Reference Number,Payee,Address,Amount
11/26/2025,12345678901234567890,"Test Store","",-25.00
"""
        transactions = parse_bofa_cc_csv(csv_content, "BOFA-CC")

        assert transactions[0]["reference_id"] == "12345678901234567890"

    def test_payee_with_comma_in_name(self):
        """Handle payees with commas in the name"""
        csv_content = """Posted Date,Reference Number,Payee,Address,Amount
11/26/2025,12345678901234567890,"Restaurant Name, Location","123 St",-85.78
"""
        transactions = parse_bofa_cc_csv(csv_content, "BOFA-CC")

        assert transactions[0]["merchant"] == "Restaurant Name"
        assert transactions[0]["description"] == "Restaurant Name, Location"


class TestAmexParser:
    """Test Amex Credit Card CSV parsing"""

    def test_parse_basic_transactions(self):
        """Parse standard Amex transactions"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,12.50,,,,,,,320251100001,Restaurant-Dining
"""
        transactions = parse_amex_csv(csv_content)

        assert len(transactions) == 2
        # Amex amounts are flipped: positive in CSV becomes negative (expense)
        assert transactions[0]["amount"] == -199.99
        assert transactions[1]["amount"] == -12.50
        assert transactions[0]["card_member"] == "JOHN DOE"
        assert transactions[0]["account_source"] == "AMEXXXXXX-53004"

    def test_skip_payment_rows(self):
        """Skip AUTOPAY PAYMENT and THANK YOU rows"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AUTOPAY PAYMENT - THANK YOU,JOHN DOE,XXXXX-53004,-500.00,,,,,,,320251150001,
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,12.50,,,,,,,320251100001,Restaurant
"""
        transactions = parse_amex_csv(csv_content)

        assert len(transactions) == 1
        assert transactions[0]["description"] == "STARBUCKS"

    def test_category_mapping(self):
        """Map Amex categories to simplified categories"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,WHOLE FOODS,JOHN DOE,XXXXX-53004,85.00,,,,,,,320251150001,Merchandise & Supplies-Groceries
11/10/2025,OLIVE GARDEN,JOHN DOE,XXXXX-53004,45.00,,,,,,,320251100001,Restaurant-Bar & Café
"""
        transactions = parse_amex_csv(csv_content)

        # Category mapping happens via suggested_category
        assert transactions[0].get("suggested_category") == "Shopping"
        assert transactions[1].get("suggested_category") == "Dining & Coffee"

    def test_merchant_extraction_from_description(self):
        """Extract merchant from Amex multi-space descriptions"""
        merchant = extract_merchant_from_description(
            "TARGET              ENCINITAS           CA", ImportFormatType.amex_cc
        )
        assert merchant == "TARGET"

        merchant2 = extract_merchant_from_description(
            "AplPay STARBUCKS    800-782-7282        WA", ImportFormatType.amex_cc
        )
        assert merchant2 == "AplPay STARBUCKS"


class TestInspiraHSAParser:
    """Test Inspira HSA CSV parsing"""

    def test_parse_basic_transactions(self):
        """Parse standard Inspira HSA transactions"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for","Contribution year","Document attached","Trade Details","Investment rebalance","Is Investment Trans Type","Verification Status"
"12345","Contribution","01/15/2025","01/15/2025","Employer HSA Contribution","$500.00","","Myself","2025","","","","",""
"12346","Debit Card","01/20/2025","01/20/2025","CVS PHARMACY","($29.44)","Medical","Myself","","","","","",""
"""
        transactions = parse_inspira_hsa_csv(csv_content, "Inspira-HSA")

        assert len(transactions) == 2
        assert transactions[0]["amount"] == 500.00
        assert transactions[0]["date"] == date(2025, 1, 15)
        assert transactions[1]["amount"] == -29.44
        assert transactions[1]["date"] == date(2025, 1, 20)

    def test_amount_parsing_with_parentheses(self):
        """Parse amounts with parentheses for negatives"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for","Contribution year","Document attached","Trade Details","Investment rebalance","Is Investment Trans Type","Verification Status"
"001","Debit","01/01/2025","01/01/2025","PHARMACY","($100.50)","Medical","","","","","","",""
"002","Credit","01/02/2025","01/02/2025","REFUND","$25.00","","","","","","","",""
"003","Debit","01/03/2025","01/03/2025","DOCTOR OFFICE","($1,234.56)","Medical","","","","","","",""
"""
        transactions = parse_inspira_hsa_csv(csv_content, "Inspira-HSA")

        assert transactions[0]["amount"] == -100.50
        assert transactions[1]["amount"] == 25.00
        assert transactions[2]["amount"] == -1234.56

    def test_medical_category_suggestion(self):
        """Suggest Healthcare category for Medical expense category"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for","Contribution year","Document attached","Trade Details","Investment rebalance","Is Investment Trans Type","Verification Status"
"001","Debit","01/01/2025","01/01/2025","PHARMACY","($50.00)","Medical","","","","","","",""
"""
        transactions = parse_inspira_hsa_csv(csv_content, "Inspira-HSA")

        assert transactions[0]["suggested_category"] == "Healthcare"

    def test_transaction_id_used_as_reference(self):
        """Use Transaction ID as reference_id"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for","Contribution year","Document attached","Trade Details","Investment rebalance","Is Investment Trans Type","Verification Status"
"HSA-2025-001","Contribution","01/15/2025","01/15/2025","Contribution","$100.00","","","","","","","",""
"""
        transactions = parse_inspira_hsa_csv(csv_content, "Inspira-HSA")

        assert transactions[0]["reference_id"] == "HSA-2025-001"


class TestVenmoParser:
    """Test Venmo CSV parsing"""

    def test_parse_basic_transactions(self):
        """Parse standard Venmo transactions"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip),Amount (tax),Amount (fee),Tax Rate,Tax Exempt,Funding Source,Destination,Beginning Balance,Ending Balance,Statement Period Venmo Fees,Terminal Location,Year to Date Venmo Fees,Disclaimer
,,,,,,,,,,,,,,,,$0.00,,,,,
,4414733187055562320,2025-09-05T04:06:46,Payment,Complete,Test payment note,John Doe,Jane Smith,- $35.00,,0,,0,,"BANK OF AMERICA, N.A. Personal Checking *1234",,,,,Venmo,,
,4414733955578223988,2025-09-05T04:08:18,Payment,Complete,Another payment,Jane Smith,John Doe,+ $50.00,,0,,0,,,Venmo balance,,,,Venmo,,
"""
        transactions = parse_venmo_csv(csv_content, "Venmo")

        assert len(transactions) == 2
        assert transactions[0]["amount"] == -35.00  # Sent money
        assert transactions[0]["merchant"] == "Jane Smith"  # Recipient
        assert transactions[1]["amount"] == 50.00  # Received money
        assert transactions[1]["merchant"] == "Jane Smith"  # Sender

    def test_skip_incomplete_transactions(self):
        """Skip transactions with non-Complete status"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,1234567890,2025-09-05T04:06:46,Payment,Complete,Completed payment,John Doe,Jane Smith,- $35.00,
,1234567891,2025-09-05T04:08:18,Payment,Pending,Pending payment,John Doe,Jane Smith,- $25.00,
,1234567892,2025-09-05T04:10:00,Payment,Failed,Failed payment,John Doe,Jane Smith,- $15.00,
"""
        transactions = parse_venmo_csv(csv_content, "Venmo")

        assert len(transactions) == 1
        assert transactions[0]["amount"] == -35.00

    def test_skip_balance_rows(self):
        """Skip rows without transaction ID"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,,,,,,,,,,,,,,,,$0.00,,,,,
,1234567890,2025-09-05T04:06:46,Payment,Complete,Test,John Doe,Jane Smith,- $35.00,
,,,,,,,,,,,,,,,,,$100.00,$0.00,,
"""
        transactions = parse_venmo_csv(csv_content, "Venmo")

        assert len(transactions) == 1

    def test_parse_charge_type_transactions(self):
        """Parse Charge type transactions (requests for payment)"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,4414733955578223988,2025-09-05T04:08:18,Charge,Complete,Invoice for services,Jane Smith,John Doe,- $30.00,
"""
        transactions = parse_venmo_csv(csv_content, "Venmo")

        assert len(transactions) == 1
        assert transactions[0]["amount"] == -30.00

    def test_note_used_as_description(self):
        """Use Note field as transaction description"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,1234567890,2025-09-05T04:06:46,Payment,Complete,Dinner split at Italian restaurant,John Doe,Jane Smith,- $35.00,
"""
        transactions = parse_venmo_csv(csv_content, "Venmo")

        assert transactions[0]["description"] == "Dinner split at Italian restaurant"

    def test_fallback_description_when_no_note(self):
        """Build description from type/from/to when note is empty"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,1234567890,2025-09-05T04:06:46,Payment,Complete,,John Doe,Jane Smith,- $35.00,
"""
        transactions = parse_venmo_csv(csv_content, "Venmo")

        assert "Payment" in transactions[0]["description"]
        assert "John Doe" in transactions[0]["description"]

    def test_iso_datetime_parsing(self):
        """Parse ISO format datetime correctly"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,1234567890,2025-11-28T16:32:56,Payment,Complete,Test,John Doe,Jane Smith,- $35.00,
"""
        transactions = parse_venmo_csv(csv_content, "Venmo")

        assert transactions[0]["date"] == date(2025, 11, 28)

    def test_skip_standard_transfer_type(self):
        """Parse Standard Transfer type (Venmo to bank transfers)"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,4476008609638829232,2025-11-28T17:10:06,Standard Transfer,Issued,,,,- $558.00,
"""
        transactions = parse_venmo_csv(csv_content, "Venmo")

        # Standard Transfer with "Issued" status should be skipped (not Complete)
        assert len(transactions) == 0


class TestAmexCategoryMapping:
    """Test Amex category to simplified category mapping"""

    def test_restaurant_mapping(self):
        assert map_amex_category("Restaurant-Dining") == "Dining & Coffee"
        assert map_amex_category("Bar & Café") == "Dining & Coffee"

    def test_merchandise_mapping(self):
        assert map_amex_category("Merchandise & Supplies") == "Shopping"
        assert map_amex_category("Retail Stores") == "Shopping"
        assert map_amex_category("Wholesale Clubs") == "Shopping"

    def test_entertainment_mapping(self):
        assert map_amex_category("Entertainment") == "Entertainment"

    def test_healthcare_mapping(self):
        assert map_amex_category("Health Care Services") == "Healthcare"

    def test_education_mapping(self):
        assert map_amex_category("Education") == "Education"

    def test_transportation_mapping(self):
        assert map_amex_category("Government Services-Toll") == "Transportation"

    def test_subscriptions_mapping(self):
        assert map_amex_category("Computer Supplies") == "Subscriptions"
        assert map_amex_category("Internet Services") == "Subscriptions"

    def test_utilities_mapping(self):
        assert map_amex_category("Telecommunications") == "Utilities"
        assert map_amex_category("Communications") == "Utilities"

    def test_unknown_category_returns_none(self):
        assert map_amex_category("Random Unknown Category") is None


class TestParseCsvIntegration:
    """Test the main parse_csv() function with format auto-detection"""

    def test_auto_detect_and_parse_bofa_bank(self):
        """Auto-detect BofA bank and parse"""
        csv_content = """Date,Description,Amount,Running Bal.
11/15/2025,DEPOSIT,500.00,1500.00
"""
        transactions, format_type = parse_csv(csv_content, account_source="BOFA-Test")

        assert format_type == ImportFormatType.bofa_bank
        assert len(transactions) == 1

    def test_auto_detect_and_parse_amex(self):
        """Auto-detect Amex and parse"""
        csv_content = """Date,Description,Card Member,Account #,Amount
11/15/2025,STORE,JOHN DOE,XXXXX-53004,50.00
"""
        transactions, format_type = parse_csv(csv_content)

        assert format_type == ImportFormatType.amex_cc
        assert len(transactions) == 1

    def test_format_hint_overrides_detection(self):
        """Format hint overrides auto-detection"""
        csv_content = """Date,Description,Amount,Running Bal.
11/15/2025,DEPOSIT,500.00,1500.00
"""
        # Force Amex format (will fail to parse properly, but tests hint override)
        transactions, format_type = parse_csv(csv_content, format_hint=ImportFormatType.amex_cc)

        assert format_type == ImportFormatType.amex_cc

    def test_unknown_format_returns_empty(self):
        """Unknown format returns empty transaction list"""
        csv_content = """Random,Headers,Here
1,2,3
"""
        transactions, format_type = parse_csv(csv_content)

        assert format_type == ImportFormatType.unknown
        assert len(transactions) == 0


# =============================================================================
# API Integration Tests for CSV Import
# =============================================================================


class TestCSVImport:
    """FR-001: CSV Import"""

    @pytest.mark.asyncio
    async def test_preview_amex_csv(self, client: AsyncClient, seed_categories):
        """FR-001.4: Import Preview - AMEX format"""
        # Sample AMEX CSV content
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
11/05/2025,TARGET,JANE DOE,XXXXX-53012,-45.50,,,,,,,320251050001,Merchandise
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = await client.post("/api/v1/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()

        # FR-001.2: Format Detection
        assert data["detected_format"] == "amex_cc"

        # FR-001.4: Preview requirements
        assert "transactions" in data
        assert "transaction_count" in data
        assert "total_amount" in data

        # Verify transactions parsed correctly
        assert len(data["transactions"]) == 3
        assert data["transaction_count"] == 3

    @pytest.mark.asyncio
    async def test_preview_bofa_csv(self, client: AsyncClient, seed_categories):
        """FR-001.4: Import Preview - BOFA format"""
        csv_content = """Summary Bal.,$1234.56
Line 1
Line 2

Date,Description,Amount,Running Bal.
11/15/2025,AMAZON PAYMENT,-199.99,1034.57
11/10/2025,STARBUCKS PURCHASE,-12.50,1234.56
11/05/2025,PAYROLL DEPOSIT,3500.00,1247.06
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"account_source": "BOFA-1234"}

        response = await client.post("/api/v1/import/preview", files=files, data=data_payload)

        assert response.status_code == 200
        data = response.json()

        # FR-001.2: Format Detection
        assert data["detected_format"] == "bofa_bank"

        # FR-001.3: BOFA requires account source
        assert "transactions" in data
        assert len(data["transactions"]) == 3

    @pytest.mark.asyncio
    async def test_preview_bofa_cc_csv(self, client: AsyncClient, seed_categories):
        """FR-001.4: Import Preview - BOFA Credit Card format"""
        csv_content = """Posted Date,Reference Number,Payee,Address,Amount
11/26/2025,74863985329012411622105,"Mantarraya Cafe Puntarenas,Co","",-85.78
11/25/2025,24138935328002638002967,"THE ROASTERY PUNTARENAS","",-70.18
11/21/2025,32583204320112100065939,"PAYMENT - THANK YOU","",3846.96
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"account_source": "BOFA-CC-1234"}

        response = await client.post("/api/v1/import/preview", files=files, data=data_payload)

        assert response.status_code == 200
        data = response.json()

        # FR-001.2: Format Detection
        assert data["detected_format"] == "bofa_cc"

        # Verify transactions parsed correctly
        assert "transactions" in data
        assert len(data["transactions"]) == 3
        assert data["transaction_count"] == 3

        # Verify amounts (negative for charges, positive for payments)
        amounts = [t["amount"] for t in data["transactions"]]
        assert -85.78 in amounts
        assert 3846.96 in amounts  # Payment should be positive

    @pytest.mark.asyncio
    async def test_confirm_import(self, client: AsyncClient, seed_categories):
        """FR-001.4 & FR-001.5: Confirm import and duplicate detection"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        # First import
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"format_type": "amex_cc"}

        confirm_response = await client.post("/api/v1/import/confirm", files=files, data=data_payload)
        assert confirm_response.status_code == 200
        confirm_data = confirm_response.json()

        assert confirm_data["imported"] == 2
        assert confirm_data["duplicates"] == 0

        # Second import (should detect duplicates)
        files2 = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload2 = {"format_type": "amex_cc"}

        confirm_response2 = await client.post("/api/v1/import/confirm", files=files2, data=data_payload2)
        assert confirm_response2.status_code == 200
        confirm_data2 = confirm_response2.json()

        # FR-001.5: Duplicate Detection
        assert confirm_data2["duplicates"] == 2
        assert confirm_data2["imported"] == 0

    @pytest.mark.asyncio
    async def test_format_preferences(self, client: AsyncClient, seed_categories):
        """FR-001.6: Format Preferences - Save and retrieve"""
        # Get saved formats
        response = await client.get("/api/v1/import/formats")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_invalid_csv_format(self, client: AsyncClient):
        """FR-001.2: Handle unknown formats gracefully"""
        csv_content = """Invalid,CSV,Format
1,2,3
4,5,6
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = await client.post("/api/v1/import/preview", files=files)

        # Should handle gracefully, not crash
        assert response.status_code in [200, 400]

    @pytest.mark.asyncio
    async def test_category_mapping_from_amex(self, client: AsyncClient, seed_categories):
        """FR-001.3: Map AMEX category to simplified categories"""
        csv_content = """Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
11/15/2025,AMAZON.COM,JOHN DOE,XXXXX-53004,-199.99,,,,,,,320251150001,Merchandise
11/10/2025,STARBUCKS,JOHN DOE,XXXXX-53004,-12.50,,,,,,,320251100001,Restaurant-Dining
"""

        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = await client.post("/api/v1/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()

        # Verify transactions have bucket tags assigned
        transactions = data["transactions"]
        # Category field now contains title-cased bucket value
        assert any(txn.get("category") or txn.get("bucket") for txn in transactions)

    @pytest.mark.asyncio
    async def test_preview_inspira_hsa_csv(self, client: AsyncClient, seed_categories):
        """FR-001.4: Import Preview - Inspira HSA format"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for","Contribution year","Document attached","Trade Details","Investment rebalance","Is Investment Trans Type","Verification Status"
"12345","Contribution","01/15/2025","01/15/2025","Employer HSA Contribution","$500.00","","Myself","2025","","","","",""
"12346","Debit Card","01/20/2025","01/20/2025","CVS PHARMACY","($29.44)","Medical","Myself","","","","","",""
"12347","Debit Card","01/25/2025","01/25/2025","WALGREENS","($15.99)","Medical","Family","","","","","",""
"""

        files = {"file": ("hsa_export.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"account_source": "Inspira-HSA"}

        response = await client.post("/api/v1/import/preview", files=files, data=data_payload)

        assert response.status_code == 200
        data = response.json()

        # FR-001.2: Format Detection
        assert data["detected_format"] == "inspira_hsa"

        # Verify transactions parsed correctly
        assert "transactions" in data
        assert len(data["transactions"]) == 3
        assert data["transaction_count"] == 3

        # Verify amounts (contribution positive, debits negative)
        amounts = [t["amount"] for t in data["transactions"]]
        assert 500.00 in amounts
        assert -29.44 in amounts
        assert -15.99 in amounts

    @pytest.mark.asyncio
    async def test_preview_venmo_csv(self, client: AsyncClient, seed_categories):
        """FR-001.4: Import Preview - Venmo format"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip),Amount (tax),Amount (fee),Tax Rate,Tax Exempt,Funding Source,Destination,Beginning Balance,Ending Balance,Statement Period Venmo Fees,Terminal Location,Year to Date Venmo Fees,Disclaimer
,,,,,,,,,,,,,,,,$0.00,,,,,
,4414733187055562320,2025-09-05T04:06:46,Payment,Complete,Dinner split,John Doe,Jane Smith,- $35.00,,0,,0,,"BANK OF AMERICA, N.A. Personal Checking *1234",,,,,Venmo,,
,4414733955578223988,2025-09-05T04:08:18,Payment,Complete,Rent payment,Jane Smith,John Doe,+ $500.00,,0,,0,,,Venmo balance,,,,Venmo,,
,4414734273322117992,2025-09-05T04:08:56,Payment,Complete,Coffee run,John Doe,Bob Wilson,- $12.50,,0,,0,,"BANK OF AMERICA, N.A. Personal Checking *1234",,,,,Venmo,,
"""

        files = {"file": ("venmo_statement.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"account_source": "Venmo"}

        response = await client.post("/api/v1/import/preview", files=files, data=data_payload)

        assert response.status_code == 200
        data = response.json()

        # FR-001.2: Format Detection
        assert data["detected_format"] == "venmo"

        # Verify transactions parsed correctly
        assert "transactions" in data
        assert len(data["transactions"]) == 3
        assert data["transaction_count"] == 3

        # Verify amounts (sent = negative, received = positive)
        amounts = [t["amount"] for t in data["transactions"]]
        assert -35.00 in amounts
        assert 500.00 in amounts
        assert -12.50 in amounts

    @pytest.mark.asyncio
    async def test_confirm_inspira_hsa_import(self, client: AsyncClient, seed_categories):
        """FR-001.5: Confirm import for Inspira HSA"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for","Contribution year","Document attached","Trade Details","Investment rebalance","Is Investment Trans Type","Verification Status"
"HSA-001","Contribution","01/15/2025","01/15/2025","Contribution","$250.00","","","","","","","",""
"HSA-002","Debit Card","01/20/2025","01/20/2025","PHARMACY","($50.00)","Medical","","","","","","",""
"""

        files = {"file": ("hsa.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"format_type": "inspira_hsa", "account_source": "Inspira-HSA"}

        response = await client.post("/api/v1/import/confirm", files=files, data=data_payload)

        assert response.status_code == 200
        data = response.json()

        assert data["imported"] == 2
        assert data["duplicates"] == 0

    @pytest.mark.asyncio
    async def test_confirm_venmo_import(self, client: AsyncClient, seed_categories):
        """FR-001.5: Confirm import for Venmo"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip),Amount (tax),Amount (fee),Tax Rate,Tax Exempt,Funding Source,Destination,Beginning Balance,Ending Balance,Statement Period Venmo Fees,Terminal Location,Year to Date Venmo Fees,Disclaimer
,1234567890,2025-10-01T12:00:00,Payment,Complete,Test payment,John Doe,Jane Smith,- $25.00,,0,,0,,,Venmo balance,,,,Venmo,,
,1234567891,2025-10-02T14:30:00,Payment,Complete,Refund,Jane Smith,John Doe,+ $10.00,,0,,0,,,Venmo balance,,,,Venmo,,
"""

        files = {"file": ("venmo.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"format_type": "venmo", "account_source": "Venmo"}

        response = await client.post("/api/v1/import/confirm", files=files, data=data_payload)

        assert response.status_code == 200
        data = response.json()

        assert data["imported"] == 2
        assert data["duplicates"] == 0

    @pytest.mark.asyncio
    async def test_venmo_duplicate_detection(self, client: AsyncClient, seed_categories):
        """FR-001.5: Venmo duplicate detection by transaction ID"""
        csv_content = """Account Statement - (@johndoe) ,,,,,,,,,,,,,,,,,,,,,
Account Activity,,,,,,,,,,,,,,,,,,,,,
,ID,Datetime,Type,Status,Note,From,To,Amount (total),Amount (tip)
,9999888877776666,2025-10-01T12:00:00,Payment,Complete,Unique transaction,John Doe,Jane Smith,- $100.00,
"""

        # First import
        files = {"file": ("venmo.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"format_type": "venmo", "account_source": "Venmo"}

        response1 = await client.post("/api/v1/import/confirm", files=files, data=data_payload)
        assert response1.status_code == 200
        assert response1.json()["imported"] == 1

        # Second import of same transaction
        files2 = {"file": ("venmo.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response2 = await client.post("/api/v1/import/confirm", files=files2, data=data_payload)
        assert response2.status_code == 200
        assert response2.json()["duplicates"] == 1
        assert response2.json()["imported"] == 0

    @pytest.mark.asyncio
    async def test_inspira_duplicate_detection(self, client: AsyncClient, seed_categories):
        """FR-001.5: Inspira HSA duplicate detection by transaction ID"""
        csv_content = """"Transaction ID","Transaction Type","Origination Date","Posted Date","Description","Amount","Expense Category","Expenses for","Contribution year","Document attached","Trade Details","Investment rebalance","Is Investment Trans Type","Verification Status"
"UNIQUE-HSA-99999","Contribution","01/15/2025","01/15/2025","Test","$100.00","","","","","","","",""
"""

        # First import
        files = {"file": ("hsa.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data_payload = {"format_type": "inspira_hsa", "account_source": "Inspira-HSA"}

        response1 = await client.post("/api/v1/import/confirm", files=files, data=data_payload)
        assert response1.status_code == 200
        assert response1.json()["imported"] == 1

        # Second import of same transaction
        files2 = {"file": ("hsa.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response2 = await client.post("/api/v1/import/confirm", files=files2, data=data_payload)
        assert response2.status_code == 200
        assert response2.json()["duplicates"] == 1
        assert response2.json()["imported"] == 0
