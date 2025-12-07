# Import

Import transactions from various file formats.

## CSV Auto-Detection

Maxwell's Wallet automatically detects your CSV format based on header signatures. Just upload your file and the system will:

1. Analyze the header row to identify the bank/source
2. Apply the correct parsing rules
3. Extract transactions with proper date and amount formatting

No manual format selection required for supported formats.

## Supported Formats

### CSV Formats

| Source | Auto-detected By |
|--------|------------------|
| Bank of America (Checking) | "Running Bal." column |
| Bank of America (Credit Card) | "Posted Date" + "Reference Number" |
| American Express | "Card Member" + "Account #" |
| Chase | Chase-specific headers |
| Venmo | Venmo-specific headers |
| Inspira HSA | Inspira-specific headers |
| Custom CSV | User-defined column mapping |

### Quicken Formats

- **QIF** - Quicken Interchange Format
- **QFX** - Quicken Financial Exchange (OFX-based)
- **OFX** - Open Financial Exchange

## Import Workflow

1. **Upload**: Select file(s) to import
2. **Preview**: Review detected transactions and format
3. **Confirm**: Import transactions to database

## Batch Import

Upload multiple files at once:

- Each file is parsed independently
- Cross-file duplicate detection
- Mixed formats supported (e.g., BofA + Amex)

## Duplicate Detection

Duplicates are identified by content hash:

- Date
- Amount
- Description
- Account

Existing transactions with matching hashes are skipped.

## Merchant Aliases

During import, merchant names are normalized using your configured aliases. This ensures "AMAZON.COM*123ABC" and "AMAZON MKTPLACE" both become "Amazon".
