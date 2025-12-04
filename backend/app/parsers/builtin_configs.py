"""
Built-in CSV format configurations.

These are pre-defined configurations for common bank/financial CSV formats.
They replace the old class-based parsers with data-driven configs that use
the same CustomCsvParser under the hood.

Note on category handling:
- category_column is used to EXTRACT raw category values from the source CSV
- No category MAPPING is done here - that's a separate concern handled elsewhere
- The extracted value is stored as source_category in ParsedTransaction
- Category mapping (source -> internal) should happen during import confirmation
"""

from .formats.custom_csv import CustomCsvConfig, RowHandling


# Bank of America - Checking/Savings
BOFA_BANK_CONFIG = CustomCsvConfig(
    name="Bank of America (Checking/Savings)",
    account_source="BOFA-Checking",
    date_column="Date",
    amount_column="Amount",
    description_column="Description",
    date_format="%m/%d/%Y",
    amount_sign_convention="negative_prefix",
    row_handling=RowHandling(
        find_header_row=True,
        header_indicators=["Date", "Description", "Amount"],
        skip_patterns=["balance"],
    ),
    merchant_first_words=2,  # Take first 2 words as merchant
)


# Bank of America - Credit Card
BOFA_CC_CONFIG = CustomCsvConfig(
    name="Bank of America (Credit Card)",
    account_source="BOFA-CC",
    date_column="Posted Date",
    amount_column="Amount",
    description_column="Payee",
    reference_column="Reference Number",
    date_format="%m/%d/%Y",
    amount_sign_convention="negative_prefix",
    row_handling=RowHandling(
        find_header_row=True,
        header_indicators=["Posted Date", "Reference Number", "Payee"],
    ),
    merchant_split_chars=",",  # Split on comma, take first part
)


# American Express
AMEX_CC_CONFIG = CustomCsvConfig(
    name="American Express",
    account_source="AMEX",
    date_column="Date",
    amount_column="Amount",
    description_column="Description",
    reference_column="Reference",
    category_column="Category",
    card_member_column="Card Member",
    date_format="%m/%d/%Y",
    amount_sign_convention="negative_prefix",
    amount_invert_sign=True,  # AMEX: positive = charge, we want negative for expenses
    row_handling=RowHandling(
        find_header_row=True,
        header_indicators=["Date", "Card Member", "Account #"],
        skip_patterns=["AUTOPAY PAYMENT", "THANK YOU"],
    ),
    merchant_split_chars="  ",  # Split on double-space
)


# Inspira HSA
INSPIRA_HSA_CONFIG = CustomCsvConfig(
    name="Inspira HSA",
    account_source="Inspira-HSA",
    date_column="Posted Date",
    amount_column="Amount",
    description_column="Description",
    reference_column="Transaction ID",
    category_column="Expense Category",
    date_format="%m/%d/%Y",
    amount_sign_convention="parentheses",
    amount_currency_prefix="$",
    row_handling=RowHandling(
        find_header_row=True,
        header_indicators=["Transaction ID", "Transaction Type", "Posted Date"],
    ),
    merchant_first_words=1,  # First word as merchant
)


# Venmo
VENMO_CONFIG = CustomCsvConfig(
    name="Venmo",
    account_source="Venmo",
    date_column="Datetime",
    amount_column="Amount (total)",
    description_column="Note",
    reference_column="ID",
    date_format="iso",  # Venmo uses ISO format
    amount_sign_convention="plus_minus",
    amount_currency_prefix="$",
    row_handling=RowHandling(
        find_header_row=True,
        header_indicators=["ID", "Datetime", "Type", "Status", "Note"],
        skip_patterns=["Standard Transfer"],  # Skip transfers to bank
    ),
)


# All built-in configs
BUILTIN_CONFIGS = {
    "bofa_bank": BOFA_BANK_CONFIG,
    "bofa_cc": BOFA_CC_CONFIG,
    "amex_cc": AMEX_CC_CONFIG,
    "inspira_hsa": INSPIRA_HSA_CONFIG,
    "venmo": VENMO_CONFIG,
}


def get_builtin_config(format_key: str) -> CustomCsvConfig | None:
    """Get a built-in config by format key."""
    return BUILTIN_CONFIGS.get(format_key)


def get_all_builtin_configs() -> dict[str, CustomCsvConfig]:
    """Get all built-in configs."""
    return BUILTIN_CONFIGS.copy()


def get_builtin_config_names() -> dict[str, str]:
    """Get mapping of format_key -> display name."""
    return {key: config.name for key, config in BUILTIN_CONFIGS.items()}
