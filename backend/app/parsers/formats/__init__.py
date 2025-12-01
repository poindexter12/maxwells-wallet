"""
Format parser implementations.

Each module in this package defines a parser for a specific CSV format.
Parsers self-register via the @ParserRegistry.register decorator when imported.
"""

# Import all format parsers to trigger registration
from . import bofa_bank
from . import bofa_cc
from . import amex_cc
from . import inspira_hsa
from . import venmo
