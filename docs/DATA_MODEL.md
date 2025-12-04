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
    Dashboard ||--o{ DashboardWidget : contains

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
        int account_tag_id FK "FK to account Tag"
        string card_member
        enum reconciliation_status "unreconciled|matched|manually_entered|ignored"
        string notes
        string reference_id "bank reference ID"
        string content_hash "SHA256 with account"
        string content_hash_no_account "SHA256 without account"
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

    Dashboard {
        int id PK
        datetime created_at
        datetime updated_at
        string name
        string description
        string view_mode "month|year"
        int pinned_year
        int pinned_month
        string filter_buckets "JSON array"
        string filter_accounts "JSON array"
        string filter_merchants "JSON array"
        bool is_default
        int position "sidebar order"
    }

    DashboardWidget {
        int id PK
        datetime created_at
        datetime updated_at
        int dashboard_id FK
        string widget_type
        int position
        bool visible
        string config "JSON"
        string filter_buckets "JSON array"
        string filter_accounts "JSON array"
        string filter_merchants "JSON array"
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
- **account_tag_id**: FK to the account Tag (for budgets and filtering by account)
- **content_hash**: SHA256 hash including account for same-account deduplication
- **content_hash_no_account**: SHA256 hash excluding account for cross-account detection
- **reference_id**: Bank's unique transaction identifier for duplicate detection

The dual-hash approach enables:
1. Primary dedup using `content_hash` (exact match within same account)
2. Cross-account detection using `content_hash_no_account` (warns if same transaction in different account)

Transactions have two types of tag relationships:
- **account_tag**: Single FK to an account namespace tag (1:1)
- **tags**: Many-to-many relationship via TransactionTag for buckets, occasions, etc.

### Tag
Namespaced tags for flexible transaction classification. Tags use a `namespace:value` format:
- **bucket**: Spending categories (groceries, dining, entertainment)
- **expense**: Expense types (recurring, one-time)
- **occasion**: Special events (vacation, christmas)

Each transaction can have multiple tags, but only one tag per namespace (bucket tags are mutually exclusive).

Tag values can be renamed via the PATCH endpoint; the namespace is immutable after creation. Value uniqueness is enforced within each namespace.

### TransactionTag
Junction table linking transactions to tags (many-to-many relationship).

### Budget
Monthly or yearly spending limits that can be set against any tag namespace:
- **Buckets**: Track spending by category (e.g., `bucket:groceries`, `bucket:dining`)
- **Occasions**: Track spending for events (e.g., `occasion:vacation`, `occasion:christmas`)
- **Accounts**: Track spending per account (e.g., `account:amex-gold`, `account:bofa-checking`)

Uses `namespace:value` format. Supports optional date ranges and rollover.

### TagRule
Auto-tagging rules applied to new transactions during import. Supports pattern matching on merchant, description, amount ranges, and account source. Rules are applied by priority (highest first).

### RecurringPattern
Detected recurring transactions (subscriptions, bills). Used to predict upcoming transactions and alert on missing expected charges.

### ImportFormat
Saved preferences for import sources. Remembers which CSV format to use for each account source.

### Dashboard
Named dashboard configurations that group widgets with shared settings. Key features:
- **name**: Display name shown in sidebar and selector
- **view_mode**: Default view ("month" or "year") for all widgets
- **pinned_year/pinned_month**: Optional fixed date defaults (otherwise uses current date)
- **filter_***: Dashboard-level filters applied to all widgets (JSON arrays of tag values)
- **is_default**: One dashboard is marked default and loads on homepage
- **position**: Order in sidebar navigation

Dashboards support filtering at two levels:
1. Dashboard-level filters apply to all widgets as defaults
2. Widget-level filters override dashboard filters when set

### DashboardWidget
Individual widgets within a dashboard. Each widget displays a specific visualization:
- **widget_type**: Type of chart/display (spending_chart, budget_progress, sankey, etc.)
- **position**: Order within the dashboard
- **visible**: Whether widget is shown
- **config**: Widget-specific configuration as JSON
- **filter_***: Widget-specific filters that override dashboard defaults

Widget types include: spending_chart, budget_progress, top_merchants, recent_transactions, month_over_month, anomalies, recurring, credit_cards, insights, sankey_chart, treemap_chart, calendar_heatmap.

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
