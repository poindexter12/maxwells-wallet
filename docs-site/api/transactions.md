# Transactions API

CRUD operations and filtering for transactions.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/transactions` | List transactions |
| GET | `/api/v1/transactions/count` | Count matching transactions |
| GET | `/api/v1/transactions/{id}` | Get single transaction |
| POST | `/api/v1/transactions` | Create transaction |
| PATCH | `/api/v1/transactions/{id}` | Update transaction |
| DELETE | `/api/v1/transactions/{id}` | Delete transaction |
| POST | `/api/v1/transactions/bulk-update` | Bulk update |
| POST | `/api/v1/transactions/{id}/tags` | Add tag |
| DELETE | `/api/v1/transactions/{id}/tags/{tag}` | Remove tag |
| GET | `/api/v1/transactions/export` | Export to CSV |

## List Transactions

```
GET /api/v1/transactions?skip=0&limit=100
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `skip` | int | Offset (default: 0) |
| `limit` | int | Max results (default: 100, max: 500) |
| `start_date` | date | Filter from date |
| `end_date` | date | Filter to date |
| `account` | string[] | Include accounts |
| `account_exclude` | string[] | Exclude accounts |
| `tag` | string[] | Include tags (namespace:value) |
| `tag_exclude` | string[] | Exclude tags |
| `search` | string | Search text |
| `search_regex` | bool | Use regex matching |
| `amount_min` | float | Minimum amount |
| `amount_max` | float | Maximum amount |
| `is_transfer` | bool | Filter by transfer status |
| `reconciliation_status` | string | unreconciled, matched, ignored |

### Response

```json
[
  {
    "id": 1,
    "date": "2024-01-15",
    "amount": -45.67,
    "merchant": "Grocery Store",
    "description": "GROCERY STORE #123",
    "account_source": "checking",
    "reconciliation_status": "unreconciled",
    "is_transfer": false,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

## Export to CSV

```
GET /api/v1/transactions/export?start_date=2024-01-01
```

Returns a CSV file with all matching transactions.
