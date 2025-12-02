# Reports API

Analytics, summaries, and spending insights.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reports/monthly-summary` | Month overview |
| GET | `/api/v1/reports/trends` | Spending over time |
| GET | `/api/v1/reports/top-merchants` | Top spending merchants |
| GET | `/api/v1/reports/account-summary` | Per-account totals |
| GET | `/api/v1/reports/bucket-summary` | Per-bucket totals |
| GET | `/api/v1/reports/month-over-month` | Month comparison |
| GET | `/api/v1/reports/spending-velocity` | Daily burn rate |
| GET | `/api/v1/reports/anomalies` | Unusual transactions |

## Monthly Summary

```
GET /api/v1/reports/monthly-summary?year=2024&month=1
```

### Response

```json
{
  "total_income": 5000.00,
  "total_expenses": 3500.00,
  "net": 1500.00,
  "transaction_count": 145,
  "bucket_breakdown": {
    "groceries": {"amount": 450.00, "count": 12},
    "dining": {"amount": 280.00, "count": 8}
  },
  "top_merchants": [
    {"merchant": "Amazon", "amount": 350.00}
  ]
}
```

## Anomaly Detection

```
GET /api/v1/reports/anomalies?year=2024&month=1&threshold=2.0
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `year` | int | required | Year |
| `month` | int | required | Month (1-12) |
| `threshold` | float | 2.0 | Sensitivity (std deviations) |

### Response

```json
{
  "summary": {
    "total_anomalies": 5,
    "large_transaction_count": 2,
    "new_merchant_count": 2,
    "unusual_bucket_count": 1,
    "large_threshold_amount": 125.50
  },
  "anomalies": {
    "large_transactions": [...],
    "new_merchants": [...],
    "unusual_buckets": [...]
  }
}
```

The `large_threshold_amount` shows the calculated dollar threshold for "large" transactions (mean + threshold × std dev).
