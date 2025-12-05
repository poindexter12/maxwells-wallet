# Data Directory Instructions

## CRITICAL: Never use raw data in tests

The `raw/` directory contains **real personal financial data** and is gitignored. Never reference files from `raw/` in tests or commit them to the repository.

## Directory Structure

```
data/
├── raw/              # Gitignored - real financial CSVs go here
├── anonymized/       # Tracked in git - anonymized versions for testing
├── anonymize.py      # Script to create anonymized versions
├── .gitignore        # Ignores raw/ directory
└── CLAUDE.md         # This file
```

## When you find a new raw file that needs testing

1. **Always anonymize it first** using the script:
   ```bash
   # Install dependencies (one-time)
   pip install scrubadub faker

   # Then run
   cd data
   python anonymize.py --status         # See what's pending
   python anonymize.py                   # Process all pending files
   python anonymize.py --force           # Reprocess everything
   ```

2. **Or anonymize a single file:**
   ```bash
   python anonymize.py raw/MyBank/statement.csv anonymized/mybank_anon.csv
   ```

3. **Update tests to use the anonymized version**, e.g.:
   - `raw/Inspira HSA/Health_Savings_Account*.csv` → `anonymized/inspira_hsa_anon.csv`
   - `raw/Venmo/VenmoStatement_*.csv` → `anonymized/venmo_anon.csv`

## What the anonymize script does

- Detects PII using `scrubadub` with custom detectors for bank-specific patterns
- Replaces merchants, names, account numbers, locations with consistent fakes
- Uses seeded `Faker` for reproducible fake data
- Tracks processed files in `anonymized/manifest.json` to skip unchanged files
- Supports BofA, AMEX, and generic CSV formats

## Anonymized files in this repo

| File | Source Format | Notes |
|------|---------------|-------|
| `bofa_bank_anon.csv` | BofA checking | Has summary section before headers |
| `bofa_cc_anon.csv` | BofA credit card | Simple format |
| `amex_cc_anon.csv` | AMEX credit card | Has card member, extended details |
| `inspira_hsa_anon.csv` | Inspira HSA | Medical expense categories |
| `venmo_anon.csv` | Venmo | Account info rows before header |

## Adding new anonymized files

When creating a new anonymized file manually (if the script doesn't work for a format):

1. Replace all personal information:
   - Names → fake names (e.g., "Jane Smith", "John Doe")
   - Merchants → generic names (e.g., "WELLNESS CLINIC", "EXAMPLE STORE")
   - Locations → generic cities (e.g., "ANYTOWN", "RIVERSIDE")
   - Account numbers → sequential IDs
   - Phone numbers → fake numbers
   - Bank account info → "EXAMPLE BANK, N.A. *1234"

2. Keep the file structure/format identical to the original
3. Preserve date formats, amount formats, and column names exactly
4. Add to git: `git add anonymized/new_file_anon.csv`
