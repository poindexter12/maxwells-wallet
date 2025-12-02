# Import API

Import transactions from files.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/import/preview` | Preview without saving |
| POST | `/api/v1/import/confirm` | Save to database |
| GET | `/api/v1/import/formats` | List saved format preferences |
| POST | `/api/v1/import/batch/upload` | Upload multiple files |
| POST | `/api/v1/import/batch/confirm` | Confirm batch import |

## Preview Import

```
POST /api/v1/import/preview
Content-Type: multipart/form-data
```

### Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | CSV, QIF, QFX, or OFX file |
| `account_source` | string | No | Account name |
| `format_hint` | string | No | Override auto-detection |

### Response

```json
{
  "detected_format": "bofa_bank",
  "transaction_count": 45,
  "total_amount": -1234.56,
  "transactions": [
    {
      "date": "2024-01-15",
      "amount": -45.67,
      "merchant": "GROCERY STORE",
      "description": "GROCERY STORE #123",
      "suggested_bucket": "groceries",
      "is_duplicate": false
    }
  ]
}
```

## Confirm Import

```
POST /api/v1/import/confirm
Content-Type: multipart/form-data
```

### Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Same file as preview |
| `account_source` | string | No | Account name |
| `format_type` | string | Yes | Confirmed format |
| `save_format` | bool | No | Remember for future |

### Response

```json
{
  "imported_count": 42,
  "duplicate_count": 3,
  "import_session_id": 15
}
```

## Supported Formats

| Format Type | Description |
|-------------|-------------|
| `bofa_bank` | Bank of America checking/savings |
| `bofa_cc` | Bank of America credit card |
| `amex_cc` | American Express |
| `venmo` | Venmo export |
| `inspira_hsa` | Inspira HSA |
| `qif` | Quicken Interchange Format |
| `ofx` | Open Financial Exchange |
