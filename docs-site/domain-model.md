# Domain Model

Understanding Maxwell's Wallet's data model and business concepts.

## Core Entities

### Transaction

The central entity representing a financial transaction.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Primary key |
| `date` | date | Transaction date |
| `amount` | float | Negative = expense, positive = income |
| `merchant` | string | Normalized merchant name |
| `description` | string | Original bank description |
| `account_source` | string | Source account identifier |
| `account_tag_id` | int | FK to account Tag |
| `reconciliation_status` | enum | unreconciled, matched, ignored, manually_entered |
| `is_transfer` | bool | Internal transfer flag |
| `content_hash` | string | SHA256 with account for same-account dedup |
| `content_hash_no_account` | string | SHA256 without account for cross-account detection |

### TransactionSplit

Allows splitting a single transaction across multiple buckets.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Primary key |
| `transaction_id` | int | FK to Transaction |
| `tag_id` | int | FK to Tag (bucket) |
| `amount` | float | Portion allocated to this bucket |
| `notes` | string | Optional description |

When a transaction has splits, the original bucket tag is ignored and splits determine categorization.

### Tag

Flexible categorization system with namespaces.

| Namespace | Purpose | Cardinality |
|-----------|---------|-------------|
| `bucket` | Spending category | One per transaction (or splits) |
| `occasion` | Events/trips | Many per transaction |
| `account` | Source account | One per transaction |

### Budget

Spending limits with tracking.

| Field | Description |
|-------|-------------|
| `tag_namespace` | Which namespace to track (bucket, occasion, account) |
| `tag_value` | Which tag value |
| `amount` | Spending limit |
| `period` | monthly or yearly |

### Dashboard

Named dashboard configuration with shared settings.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Primary key |
| `name` | string | Display name |
| `description` | string | Optional description |
| `view_mode` | string | "month" or "year" |
| `pinned_year` | int | Optional fixed year |
| `pinned_month` | int | Optional fixed month |
| `filter_buckets` | JSON | Dashboard-level bucket filter |
| `filter_accounts` | JSON | Dashboard-level account filter |
| `filter_merchants` | JSON | Dashboard-level merchant filter |
| `is_default` | bool | Loads on homepage |
| `position` | int | Sidebar order |

### DashboardWidget

Individual widget within a dashboard.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Primary key |
| `dashboard_id` | int | FK to Dashboard |
| `widget_type` | string | Type of visualization |
| `title` | string | Display title |
| `position` | int | Order in dashboard |
| `width` | string | Layout width |
| `is_visible` | bool | Show/hide toggle |
| `config` | JSON | Widget-specific settings |
| `filter_buckets` | JSON | Widget-level bucket filter (overrides dashboard) |
| `filter_accounts` | JSON | Widget-level account filter |
| `filter_merchants` | JSON | Widget-level merchant filter |

**Widget Types:**
`summary`, `velocity`, `spending_chart`, `budget_progress`, `top_merchants`, `recent_transactions`, `month_over_month`, `anomalies`, `recurring`, `credit_cards`, `insights`, `sankey_chart`, `treemap_chart`, `calendar_heatmap`

## Bounded Contexts

### Import Context

Responsible for parsing external files and creating transactions.

- File format detection (AMEX, BofA, Venmo, Inspira HSA, QIF/QFX/OFX)
- Dual-hash duplicate detection (same-account and cross-account)
- Merchant alias application
- Bucket tag inference
- Required account selection

### Dashboard Context

Manages multi-dashboard configuration and widgets.

- Dashboard CRUD with clone/set-default
- Widget layout and visibility
- Per-widget and per-dashboard filtering
- View mode (month/year) switching

### Analytics Context

Generates insights from transaction data.

- Monthly/yearly summaries
- Advanced visualizations (Sankey, Treemap, Heatmap)
- Trend analysis
- Anomaly detection
- Budget status calculation

### Organization Context

Manages categorization and tagging.

- Tag CRUD
- Category rules (pattern-based auto-categorization)
- Merchant aliases
- Transfer detection
- Split transactions

## Business Rules

### Duplicate Detection

Dual-hash approach for reliable deduplication:

```
content_hash = SHA256(date + amount + description + account)
content_hash_no_account = SHA256(date + amount + description)
```

- **Same-account duplicates**: Rejected using `content_hash`
- **Cross-account matches**: Warning using `content_hash_no_account`

### Split Transaction Allocation

When a transaction is split:

1. Original bucket tag is ignored
2. Each split allocates a portion to a bucket
3. Split amounts must sum to transaction amount
4. Budget calculations use split amounts

### Transfer Identification

A transaction is marked as transfer if:

- Merchant matches transfer patterns (AUTOPAY, ACH, WIRE, etc.)
- OR manually marked by user

Transfers are excluded from spending calculations.

### Budget Status

```
if spent < limit * 0.8:
    status = "on_track"
elif spent < limit:
    status = "warning"
else:
    status = "exceeded"
```

### Widget Filter Inheritance

Filters cascade from dashboard to widget:

1. Dashboard filters apply to all widgets as defaults
2. Widget filters override dashboard filters when set
3. Empty widget filter = use dashboard filter

### Large Transaction Threshold

Calculated from 3-month expense baseline:

```
threshold = mean + (2 × standard_deviation)
```

This captures approximately the 95th percentile of spending.
