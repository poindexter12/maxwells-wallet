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
| `reconciliation_status` | enum | unreconciled, matched, ignored, manually_entered |
| `is_transfer` | bool | Internal transfer flag |
| `content_hash` | string | SHA256 for deduplication |

### Tag

Flexible categorization system with namespaces.

| Namespace | Purpose | Cardinality |
|-----------|---------|-------------|
| `bucket` | Spending category | One per transaction |
| `occasion` | Events/trips | Many per transaction |
| `account` | Source account | One per transaction |

### Budget

Spending limits with tracking.

| Field | Description |
|-------|-------------|
| `tag_namespace` | Which namespace to track |
| `tag_value` | Which tag value |
| `amount` | Spending limit |
| `period` | monthly or yearly |

## Bounded Contexts

### Import Context

Responsible for parsing external files and creating transactions.

- File format detection
- Duplicate detection via content hash
- Merchant alias application
- Bucket tag inference

### Analytics Context

Generates insights from transaction data.

- Monthly summaries
- Trend analysis
- Anomaly detection
- Budget status calculation

### Organization Context

Manages categorization and tagging.

- Tag CRUD
- Category rules
- Merchant aliases
- Transfer detection

## Business Rules

### Duplicate Detection

Transactions are considered duplicates if they share the same content hash:

```
hash = SHA256(date + amount + description + account)
```

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

### Large Transaction Threshold

Calculated from 3-month expense baseline:

```
threshold = mean + (2 × standard_deviation)
```

This captures approximately the 95th percentile of spending.
