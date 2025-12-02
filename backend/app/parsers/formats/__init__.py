"""
Format parser implementations.

Each module in this package defines a parser for a specific file format.
Parsers self-register via the @ParserRegistry.register decorator when imported.
"""

# Import all format parsers to trigger registration
# CSV formats
from . import bofa_bank
from . import bofa_cc
from . import amex_cc
from . import inspira_hsa
from . import venmo

# Quicken formats (non-CSV)
from . import qif
from . import qfx
