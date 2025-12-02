# Budgets

Set spending limits and track progress.

## Creating Budgets

Set budgets for any tag type:

- **Bucket budgets**: `groceries: $500/month`
- **Occasion budgets**: `vacation-2024: $2000`
- **Account budgets**: `dining-card: $300/month`

## Budget Properties

| Property | Description |
|----------|-------------|
| Name | Budget identifier |
| Tag | Which tag to track (namespace:value) |
| Amount | Spending limit |
| Period | `monthly` or `yearly` |
| Rollover | Carry unused amount to next period |

## Status Indicators

Budgets show real-time status:

| Status | Threshold | Color |
|--------|-----------|-------|
| On Track | < 80% | Green |
| Warning | 80-100% | Yellow |
| Exceeded | > 100% | Red |

## Alerts

The dashboard shows active alerts for budgets at warning or exceeded status.

## How Spending is Calculated

Budget spending includes:

- All transactions with the matching tag
- Only expenses (negative amounts)
- Transfers excluded

For monthly budgets, only the current month is counted. For yearly, the entire year.
