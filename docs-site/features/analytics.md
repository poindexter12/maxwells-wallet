# Analytics

Insights into your spending patterns with customizable dashboards and advanced visualizations.

## Multi-Dashboard Support

Create multiple named dashboards for different views:

- **Monthly Overview** - Standard spending summary
- **Yearly Trends** - Long-term patterns
- **AMEX Deep Dive** - Single account focus

### Dashboard Features

- **View Mode Toggle**: Switch between monthly and yearly views
- **Dashboard Filters**: Apply bucket/account/merchant filters to all widgets
- **Clone Dashboard**: Duplicate a dashboard as a starting point
- **Set Default**: Choose which dashboard loads on the homepage

## Dashboard Widgets

### Core Widgets

| Widget | Description |
|--------|-------------|
| Summary | Total income, expenses, net for period |
| Velocity | Daily burn rate and month-end projection |
| Spending Chart | Pie/bar chart of spending by bucket |
| Budget Progress | Progress bars for active budgets |
| Top Merchants | Highest spending merchants |
| Recent Transactions | Latest activity |
| Month-over-Month | Compare to previous period |
| Anomalies | Unusual activity counts |
| Recurring | Detected subscriptions |
| Credit Cards | Balances and due dates |
| Insights | AI-generated observations |

### Advanced Visualizations

| Widget | Description |
|--------|-------------|
| Sankey Chart | Money flow from income → accounts → spending categories |
| Treemap Chart | Hierarchical spending breakdown (bucket → merchant) |
| Calendar Heatmap | Daily spending intensity over the month |

### Widget Filtering

Each widget can have its own filters that override dashboard defaults:

- **Bucket filter**: Show only specific spending categories
- **Account filter**: Show only specific accounts
- **Merchant filter**: Show only specific merchants

## Daily Burn Rate

Shows if you're on track for the month:

- **Daily rate**: Average spending per day so far
- **Projected total**: Estimated month-end spending at current pace
- **Pace indicator**: Over/under compared to last month

## Unusual Activity

Flags anomalies requiring attention:

| Type | Detection Method |
|------|------------------|
| **Large** | Transactions 2σ above your average |
| **New** | First-time merchants |
| **Over Avg** | Buckets with unusual spending |

Click counts to jump to filtered transactions.

## Reports

### Month-over-Month

Compare current period to previous:

- Dollar and percentage changes
- Per-bucket comparison
- Biggest increases/decreases

### Spending Trends

Track income/expenses over 6+ months:

- Line chart visualization
- Group by month, category, account, or tag

### Anomaly Detection

Statistical analysis using 3-month baseline:

| Type | Detection Method |
|------|------------------|
| Large transactions | Z-score > threshold (default 2.0) |
| New merchants | First occurrence |
| Unusual categories | Spending far above average |

## Dynamic Thresholds

"Large" is personalized to your spending:

```
threshold = mean + (2 × standard_deviation)
```

If your average expense is $45 with σ of $30, large = $105.

## Year vs Month View

Toggle between views to see:

- **Month view**: Current month details, daily patterns
- **Year view**: Full year summary, monthly trends

The view mode is saved per-dashboard, so you can have a "Monthly" dashboard and a "Yearly" dashboard.
