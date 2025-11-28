# Data Model

## Entity Relationship Diagram

```mermaid
erDiagram
    ImportSession ||--o{ Transaction : contains
    Transaction }o--o| Category : "categorized by"
    Budget }o--|| Category : "tracks"
    CategoryRule }o--o| Category : "assigns"
    RecurringPattern }o--o| Category : "tracks"

    ImportSession {
        int id PK
        datetime created_at
        datetime updated_at
        string filename
        enum format_type "bofa_bank|bofa_cc|amex_cc|unknown"
        string account_source
        int transaction_count
        int duplicate_count
        float total_amount
        date date_range_start
        date date_range_end
        string status "completed|rolled_back"
    }

    Transaction {
        int id PK
        datetime created_at
        datetime updated_at
        date date
        float amount "positive=income negative=expense"
        string description "raw bank description"
        string merchant "cleaned merchant name"
        string account_source "e.g. BOFA-CC AMEX-53004"
        string card_member
        string category FK
        enum reconciliation_status "unreconciled|matched|manually_entered|ignored"
        string notes
        string reference_id "bank reference ID"
        int import_session_id FK
    }

    Category {
        int id PK
        datetime created_at
        datetime updated_at
        string name UK
        string description
    }

    Budget {
        int id PK
        datetime created_at
        datetime updated_at
        string category
        float amount "budget limit"
        enum period "monthly|yearly"
        date start_date
        date end_date
        bool rollover_enabled
    }

    CategoryRule {
        int id PK
        datetime created_at
        datetime updated_at
        string name
        string category
        int priority "higher = applied first"
        bool enabled
        string merchant_pattern "substring or regex"
        string description_pattern
        float amount_min
        float amount_max
        string account_source
        bool match_all "true=AND false=OR"
        int match_count
        datetime last_matched_date
    }

    RecurringPattern {
        int id PK
        datetime created_at
        datetime updated_at
        string merchant
        string category
        float amount_min
        float amount_max
        enum frequency "weekly|biweekly|monthly|quarterly|yearly"
        int day_of_month
        int day_of_week "0=Monday"
        date last_seen_date
        date next_expected_date
        float confidence_score "0-1"
        enum status "active|paused|ended"
    }

    ImportFormat {
        int id PK
        datetime created_at
        datetime updated_at
        string account_source UK
        enum format_type
        string custom_mappings "JSON"
    }
```

## Model Descriptions

### ImportSession
Tracks each CSV import batch for auditing and rollback capability. When transactions are imported, they're linked to a session. Deleting a session can remove all its transactions (admin operation with confirmation).

### Transaction
Core entity representing financial transactions from bank/credit card statements. Key fields:
- **amount**: Positive = income, Negative = expense
- **description**: Raw description from bank CSV
- **merchant**: Cleaned/extracted merchant name for categorization
- **account_source**: Identifies the source account (e.g., "BOFA-CC", "AMEX-53004")
- **reference_id**: Bank's unique transaction identifier for duplicate detection

### Category
Simple category definitions. Transactions reference categories by name (not FK) for flexibility.

### Budget
Monthly or yearly spending limits per category. Supports optional date ranges and rollover.

### CategoryRule
Auto-categorization rules applied to new transactions during import. Supports pattern matching on merchant, description, amount ranges, and account source. Rules are applied by priority (highest first).

### RecurringPattern
Detected recurring transactions (subscriptions, bills). Used to predict upcoming transactions and alert on missing expected charges.

### ImportFormat
Saved preferences for import sources. Remembers which CSV format to use for each account source.

## Import Format Types

| Format | Headers | Notes |
|--------|---------|-------|
| `bofa_bank` | Date,Description,Amount,Running Bal. | BofA checking/savings |
| `bofa_cc` | Posted Date,Reference Number,Payee,Address,Amount | BofA credit card |
| `amex_cc` | Date,Description,Card Member,Account #,Amount,... | American Express |

## Amount Conventions

- **Positive amounts**: Income (deposits, refunds, payments received)
- **Negative amounts**: Expenses (purchases, withdrawals, fees)

This convention is applied during import parsing. Source CSVs may use different conventions which are normalized during import.
