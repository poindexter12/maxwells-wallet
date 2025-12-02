# Import

Import transactions from various file formats.

## Supported Formats

### CSV Formats

| Source | Auto-detected By |
|--------|------------------|
| Bank of America (Checking) | "Running Bal." column |
| Bank of America (Credit Card) | "Posted Date" + "Reference Number" |
| American Express | "Card Member" + "Account #" |
| Venmo | Venmo-specific headers |
| Inspira HSA | Inspira-specific headers |

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
