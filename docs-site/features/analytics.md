# Analytics

Insights into your spending patterns.

## Dashboard Widgets

### Monthly Summary

- Total income, expenses, net
- Spending by bucket (pie chart)
- Top merchants

### Daily Burn Rate

Shows if you're on track for the month:

- **Daily rate**: Average spending per day
- **Projected total**: Estimated month-end spending
- **Pace indicator**: Over/under compared to last month

### Unusual Activity

Flags anomalies requiring attention:

- **Large**: Transactions 2σ above your average
- **New**: First-time merchants
- **Over Avg**: Buckets with unusual spending

Click counts to jump to filtered transactions.

## Reports

### Month-over-Month

Compare current month to previous:

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
threshold = mean + (2 × standard deviation)
```

If your average expense is $45 with σ of $30, large = $105.
