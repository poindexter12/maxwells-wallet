# User Needs & Goals

## Primary Goal
Track personal finances with ability to import bank statements and categorize spending to understand monthly trends.

## User Profile
- **Use Case**: Personal finance tracking
- **Primary Sources**: Bank of America and American Express statements
- **Focus**: Understanding spending patterns, income vs expenses, categorization

## Core Needs

### 1. Data Import
- Import CSV files from multiple sources (BOFA, AMEX)
- Handle different CSV formats automatically
- Avoid duplicate entries when re-importing
- Save format preferences for faster future imports

### 2. Transaction Management
- View all transactions in one place
- Search and filter transactions
- Manually add/edit transactions as needed
- Track which account each transaction came from
- Know who made the transaction (card member)

### 3. Categorization
- Auto-categorize transactions based on merchant/description
- Manually override categories when needed
- Learn from past categorizations
- Use existing AMEX categories as starting point
- Simple category system (no subcategories needed for v0)

### 4. Reconciliation
- Review unreconciled/uncategorized transactions
- Bulk categorize similar transactions
- Mark transactions as reconciled
- Ignore internal transfers between accounts
- Fast workflow to process many transactions

### 5. Analysis & Reporting
- Monthly spending summary
- Income vs expenses comparison
- Spending by category breakdown
- Historical trends (6+ months)
- Top merchants/vendors
- Visual charts and graphs

## User Workflow

### Typical Monthly Process
1. Download CSV files from BOFA and AMEX
2. Import files into app (auto-detection handles format)
3. Review unreconciled transactions
4. Categorize transactions (aided by auto-inference)
5. Mark as reconciled
6. View dashboard to understand monthly spending
7. Identify trends and patterns

### Frequency
- **Import**: Monthly or as needed
- **Reconciliation**: After each import
- **Review**: Ad-hoc checking of dashboard and trends

## Pain Points to Solve
- ❌ Manual categorization is tedious
- ❌ Different banks have different CSV formats
- ❌ Need to avoid duplicate imports
- ❌ Want to see trends over time, not just current month
- ❌ Need to track multiple accounts and card members
- ❌ Want quick bulk operations for efficiency

## Success Criteria
- ✅ Can import BOFA and AMEX CSVs without manual reformatting
- ✅ Auto-categorization is accurate >80% of the time
- ✅ Can reconcile a month's transactions in <10 minutes
- ✅ Dashboard clearly shows where money is going
- ✅ Can see spending trends over multiple months
- ✅ No duplicate transactions when re-importing
- ✅ Fast, responsive UI for daily use
