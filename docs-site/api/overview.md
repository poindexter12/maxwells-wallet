# API Overview

Maxwell's Wallet provides a RESTful API built with FastAPI.

## Interactive Documentation

When running locally, interactive API documentation is available at:

- **Swagger UI**: [http://localhost:3001/docs](http://localhost:3001/docs)
- **ReDoc**: [http://localhost:3001/redoc](http://localhost:3001/redoc)
- **OpenAPI JSON**: [http://localhost:3001/openapi.json](http://localhost:3001/openapi.json)

## Base URL

All API endpoints are prefixed with `/api/v1/`.

## Authentication

The API uses JWT-based authentication. On first run, you'll create a user
account at `/setup`. After that, every request (except the auth and health
endpoints) must include a valid Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Obtain a token from `POST /api/v1/auth/login`. See
[Authentication](../getting-started/authentication.md) for the full login flow,
password reset, and token configuration.

## Endpoint Groups

| Group | Prefix | Description |
|-------|--------|-------------|
| Auth | `/api/v1/auth` | Setup, login, password, current user |
| Transactions | `/api/v1/transactions` | CRUD operations, filtering, tagging |
| Import | `/api/v1/import` | Import from CSV, QIF, QFX, OFX |
| Reports | `/api/v1/reports` | Analytics, summaries, insights |
| Budgets | `/api/v1/budgets` | Budget limits and tracking |
| Recurring | `/api/v1/recurring` | Recurring transaction detection |
| Tags | `/api/v1/tags` | Tag management (buckets, occasions, accounts) |
| Tag Rules | `/api/v1/tag-rules` | Automated categorization rules |
| Transfers | `/api/v1/transfers` | Transfer detection and linking |
| Merchants | `/api/v1/merchants` | Merchant name normalization |
| Accounts | `/api/v1/accounts` | Account management |
| Filters | `/api/v1/filters` | Saved search filters |
| Dashboards | `/api/v1/dashboards` | Multi-dashboard management |
| Settings | `/api/v1/settings` | App settings, locale, backup schedule |
| Assistant | `/api/v1/assistant` | AI assistant chat and approved actions |
| Admin | `/api/v1/admin` | Data management and backups |

## Common Response Patterns

### Success Responses

```json
// Single item
{
  "id": 1,
  "date": "2024-01-15",
  "amount": -45.67,
  "merchant": "Grocery Store"
}

// List
[
  {"id": 1, ...},
  {"id": 2, ...}
]

// Operation result
{
  "updated": 5,
  "message": "Success"
}
```

### Error Responses

```json
{
  "detail": "Transaction not found"
}
```

## Pagination

List endpoints support pagination with `skip` and `limit` parameters:

```
GET /api/v1/transactions?skip=0&limit=100
```

- `skip`: Number of items to skip (default: 0)
- `limit`: Maximum items to return (default: 100, max: 500)

## Filtering

Most list endpoints support filtering. Common filters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | date | Filter from date (YYYY-MM-DD) |
| `end_date` | date | Filter to date |
| `account` | string[] | Include accounts (OR logic) |
| `account_exclude` | string[] | Exclude accounts |
| `tag` | string[] | Include tags (namespace:value) |
| `search` | string | Search merchant/description |
| `amount_min` | float | Minimum amount |
| `amount_max` | float | Maximum amount |
| `is_transfer` | bool | Filter transfers |

Example:
```
GET /api/v1/transactions?start_date=2024-01-01&account=checking&amount_max=-100
```
