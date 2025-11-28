# Data Model

## Entity Relationship Diagram

```mermaid
erDiagram
    ImportSession ||--o{ Transaction : contains
    Transaction }o--o{ Tag : "tagged with"
    TransactionTag }|--|| Transaction : links
    TransactionTag }|--|| Tag : links
    Budget }o--|| Tag : "tracks"
    TagRule }o--o| Tag : "assigns"
    RecurringPattern }o--o| Tag : "tracks"

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
        enum reconciliation_status "unreconciled|matched|manually_entered|ignored"
        string notes
        string reference_id "bank reference ID"
        int import_session_id FK
    }

    Tag {
        int id PK
        datetime created_at
        datetime updated_at
        string namespace "e.g. bucket, expense, occasion"
        string value "e.g. groceries, vacation"
        string description
        UNIQUE namespace_value "namespace + value"
    }

    TransactionTag {
        int id PK
        int transaction_id FK
        int tag_id FK
        datetime created_at
        UNIQUE transaction_tag "transaction_id + tag_id"
    }

    Budget {
        int id PK
        datetime created_at
        datetime updated_at
        string tag "namespace:value format"
        float amount "budget limit"
        enum period "monthly|yearly"
        date start_date
        date end_date
        bool rollover_enabled
    }

    TagRule {
        int id PK
        datetime created_at
        datetime updated_at
        string name
        string tag "namespace:value format"
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
        string category "legacy field"
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
- **merchant**: Cleaned/extracted merchant name for tagging
- **account_source**: Identifies the source account (e.g., "BOFA-CC", "AMEX-53004")
- **reference_id**: Bank's unique transaction identifier for duplicate detection

### Tag
Namespaced tags for flexible transaction classification. Tags use a `namespace:value` format:
- **bucket**: Spending categories (groceries, dining, entertainment)
- **expense**: Expense types (recurring, one-time)
- **occasion**: Special events (vacation, christmas)

Each transaction can have multiple tags, but only one tag per namespace (bucket tags are mutually exclusive).

### TransactionTag
Junction table linking transactions to tags (many-to-many relationship).

### Budget
Monthly or yearly spending limits per tag. Uses `namespace:value` format (e.g., `bucket:groceries`). Supports optional date ranges and rollover.

### TagRule
Auto-tagging rules applied to new transactions during import. Supports pattern matching on merchant, description, amount ranges, and account source. Rules are applied by priority (highest first).

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

## Tag Namespaces

| Namespace | Purpose | Example Values | Auto-created |
|-----------|---------|----------------|--------------|
| `bucket` | Spending categories | groceries, dining, entertainment, utilities | No |
| `account` | Bank accounts/cards with display names | bofa-checking, amex-gold | Yes, on import |
| `expense` | Expense classification | recurring, one-time, refund | No |
| `occasion` | Special events | vacation, christmas, birthday | No |

Tags are stored in `namespace:value` format throughout the system.

### Built-in Namespaces
The following namespaces are built-in and cannot be deleted:
- `bucket`, `account`, `occasion`, `expense`

Custom namespaces can be created through the Tags page.

### Account Tags
Account tags are automatically created during CSV import based on `account_source`. The tag value is the normalized account source (lowercase, dashes for spaces), and the description field serves as the display name shown in the UI.

Example:
- Import with `account_source = "BOFA-Checking"`
- Creates tag: `account:bofa-checking` with description "BOFA-Checking"
- User can edit description to "Bank of America Checking" in Admin → Accounts
