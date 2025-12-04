# Dashboards

Create and manage multiple dashboard views tailored to different analysis needs.

## Overview

Dashboards let you organize widgets into named views. Each dashboard can have its own:

- **View mode**: Month or year perspective
- **Filters**: Scope all widgets to specific buckets, accounts, or merchants
- **Layout**: Which widgets to show and in what order

## Creating Dashboards

1. Click the dashboard selector in the navigation bar
2. Click "New Dashboard"
3. Enter a name and optional description
4. Choose default view mode (month/year)
5. Optionally set dashboard-level filters

## Dashboard Actions

### Clone

Duplicate an existing dashboard to use as a starting point. The clone includes all widget configurations.

### Set Default

Choose which dashboard loads when you visit the homepage. Only one dashboard can be the default.

### Delete

Remove a dashboard and all its widgets. You cannot delete the last remaining dashboard.

## Dashboard Filters

Apply filters at the dashboard level to scope all widgets:

| Filter | Effect |
|--------|--------|
| **Bucket** | Only show transactions in selected categories |
| **Account** | Only show transactions from selected accounts |
| **Merchant** | Only show transactions from selected merchants |

Widgets can override dashboard filters with their own filter settings.

## View Modes

### Month View

- Current month's transactions
- Daily patterns and burn rate
- Budget progress for the month

### Year View

- Full year overview
- Monthly trend comparisons
- Annual budget tracking

The view mode is saved per-dashboard, so you can have a "Monthly Overview" and a "Yearly Trends" dashboard.

## Widget Management

Each dashboard has its own set of widgets. See [Analytics](analytics.md) for available widget types.

### Customizing Widgets

1. Go to Dashboard → Configure
2. Toggle widget visibility
3. Drag to reorder
4. Click a widget to edit its filters

### Widget Filters

Each widget can have its own filters that override dashboard defaults:

```
Dashboard filter: bucket = ["groceries", "dining"]
Widget filter:    bucket = ["groceries"]
Result:           Widget shows only groceries
```

If a widget has no filter set, it inherits the dashboard filter.

## Example Dashboards

### Monthly Overview (Default)

Standard view for day-to-day tracking:

- Summary widget
- Daily burn rate
- Budget progress
- Recent transactions
- Top merchants

### Credit Card Focus

Track credit card spending:

- Filter: account = ["amex", "visa"]
- Widgets: spending chart, budget progress, credit cards

### Year-End Review

Annual summary:

- View mode: year
- Sankey chart (income flow)
- Treemap (spending breakdown)
- Month-over-month trends

### Vacation Tracking

Trip expense tracking:

- Filter: occasion = ["vacation-2025"]
- Widgets: summary, top merchants, spending chart
