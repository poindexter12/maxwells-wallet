# Functional Requirements

## FR-001: CSV Import

### FR-001.1: File Upload
- **Requirement**: User can upload CSV files through web interface
- **Acceptance Criteria**:
  - Accept .csv file format only
  - File size limit: reasonable for monthly statements
  - Drag-and-drop or file picker
  - Show upload progress if needed

### FR-001.2: Format Detection
- **Requirement**: System auto-detects CSV format (BOFA vs AMEX)
- **Acceptance Criteria**:
  - Detect BOFA format by presence of summary header rows
  - Detect AMEX format by "Card Member" and "Account #" columns
  - Handle unknown formats gracefully
  - Allow manual format override

### FR-001.3: Data Parsing
- **Requirement**: Parse CSV and extract transaction data
- **BOFA Parsing**:
  - Skip summary header rows
  - Extract: Date, Description, Amount, Running Balance
  - Derive merchant from description
  - Require user to specify account source
- **AMEX Parsing**:
  - Extract: Date, Description, Card Member, Account #, Amount, Category, Reference
  - Use merchant from Description field
  - Auto-detect account from Account # column
  - Map AMEX category to simplified categories

### FR-001.4: Import Preview
- **Requirement**: Show preview before confirming import
- **Acceptance Criteria**:
  - Display first 10-100 transactions
  - Show detected format type
  - Show total count and amount
  - Allow user to cancel or confirm

### FR-001.5: Duplicate Detection
- **Requirement**: Prevent duplicate transaction imports
- **Acceptance Criteria**:
  - Detect duplicates by: date + amount + reference_id
  - Skip duplicates automatically
  - Report count of skipped duplicates
  - Never create duplicate transactions

### FR-001.6: Format Preferences
- **Requirement**: Save import format preferences per account
- **Acceptance Criteria**:
  - Option to "remember this format for this account"
  - Auto-apply saved format on future imports
  - User can update/delete saved preferences

## FR-002: Transaction Management

### FR-002.1: List Transactions
- **Requirement**: View all transactions in paginated list
- **Acceptance Criteria**:
  - Show 100 transactions per page
  - Sort by date (newest first) by default
  - Display: date, merchant, description, category, account, amount
  - Color code income (green) vs expenses (red)

### FR-002.2: Search & Filter
- **Requirement**: Search and filter transactions
- **Filters**:
  - Text search (merchant or description)
  - Category dropdown
  - Account source dropdown
  - Reconciliation status
  - Date range
- **Acceptance Criteria**:
  - Filters apply immediately or on button click
  - Multiple filters can be combined
  - Clear filters option

### FR-002.3: Manual Entry
- **Requirement**: Manually add transactions
- **Acceptance Criteria**:
  - Form with all transaction fields
  - Date picker for transaction date
  - Mark as "manually_entered" status
  - Validate required fields

### FR-002.4: Edit Transaction
- **Requirement**: Edit existing transactions
- **Acceptance Criteria**:
  - Inline editing for category
  - Full edit form for other fields
  - Update timestamp on save
  - Preserve original data for audit

### FR-002.5: Delete Transaction
- **Requirement**: Delete transactions
- **Acceptance Criteria**:
  - Confirmation dialog
  - Soft delete or hard delete (TBD)
  - Cannot undo (or can undo)

## FR-003: Category Inference

### FR-003.1: Auto-Categorization
- **Requirement**: Automatically suggest categories for transactions
- **Algorithm**:
  1. Check user's past categorization history for same merchant
  2. Check AMEX category if available
  3. Use keyword matching on merchant/description
  4. Return top 3 suggestions with confidence scores
- **Acceptance Criteria**:
  - Suggest category on import
  - Allow manual override
  - Learn from user corrections

### FR-003.2: Category Management
- **Requirement**: Manage list of categories
- **Default Categories**:
  - Income, Groceries, Dining & Coffee, Shopping, Utilities
  - Transportation, Entertainment, Healthcare, Education
  - Housing, Subscriptions, Other
- **Acceptance Criteria**:
  - Add new categories
  - Edit category names
  - Delete unused categories
  - Cannot delete category in use

### FR-003.3: Keyword Rules
- **Requirement**: Match merchants to categories by keywords
- **Examples**:
  - "Starbucks", "coffee" → Dining & Coffee
  - "Target", "Walmart" → Shopping
  - "Payroll", "deposit" → Income
  - "Netflix", "Spotify" → Subscriptions

## FR-004: Reconciliation

### FR-004.1: Unreconciled View
- **Requirement**: Show only unreconciled transactions
- **Acceptance Criteria**:
  - Filter by reconciliation_status = "unreconciled"
  - Show count of unreconciled items
  - Sort by date

### FR-004.2: Bulk Operations
- **Requirement**: Perform bulk operations on selected transactions
- **Operations**:
  - Bulk categorize
  - Bulk mark as reconciled
  - Bulk ignore
- **Acceptance Criteria**:
  - Checkbox selection
  - Select all option
  - Apply operation to all selected
  - Show count of affected items

### FR-004.3: Quick Categorize
- **Requirement**: Fast categorization workflow
- **Acceptance Criteria**:
  - Inline category dropdown per row
  - Keyboard shortcuts (future)
  - Remember merchant categorization
  - One-click reconcile button

### FR-004.4: Status Transitions
- **Status Values**:
  - unreconciled (default for imports)
  - matched (reconciled)
  - manually_entered (user-created)
  - ignored (internal transfers, etc.)
- **Acceptance Criteria**:
  - Change status with one click
  - Visual indicators for each status

## FR-005: Reports & Analytics

### FR-005.1: Monthly Summary
- **Requirement**: Show current month financial summary
- **Metrics**:
  - Total income
  - Total expenses
  - Net (income - expenses)
  - Transaction count
- **Acceptance Criteria**:
  - Updates in real-time as transactions added
  - Shows current month by default
  - Can select different month/year

### FR-005.2: Category Breakdown
- **Requirement**: Show spending by category
- **Visualizations**:
  - Pie chart of category distribution
  - Table with amounts and percentages
- **Acceptance Criteria**:
  - Only show expense categories (exclude income)
  - Sort by amount (largest first)
  - Show percentage of total

### FR-005.3: Spending Trends
- **Requirement**: Show spending trends over time
- **Visualizations**:
  - Line chart: income, expenses, net over 6+ months
  - Month-over-month comparison
- **Acceptance Criteria**:
  - Configurable date range
  - Clear legend and labels
  - Responsive chart sizing

### FR-005.4: Top Merchants
- **Requirement**: Show top spending by merchant
- **Acceptance Criteria**:
  - List top 10 merchants by total spending
  - Show amount and transaction count
  - Period selection (current month, last 3 months, etc.)

### FR-005.5: Account Summary
- **Requirement**: Show activity by account
- **Metrics per account**:
  - Total income
  - Total expenses
  - Net
  - Transaction count
- **Acceptance Criteria**:
  - List all accounts
  - Show overall totals

## FR-006: Data Export

### FR-006.1: Export Transactions
- **Requirement**: Export filtered transactions to CSV
- **Acceptance Criteria**:
  - Export applies current filters
  - Include all transaction fields
  - Standard CSV format
  - Download as file

## FR-007: Advanced Analytics (v0.2)

### FR-007.1: Month-over-Month Comparison
- **Requirement**: Compare current month spending to previous month
- **Purpose**: Identify spending trends and changes to find savings opportunities
- **Acceptance Criteria**:
  - Calculate income, expense, and net changes ($ and %)
  - Category-level breakdown showing increases/decreases
  - Identify biggest category changes
  - Display spending trend indicator (increasing/decreasing)
  - Show insights: biggest increase, biggest decrease
- **API**: `GET /api/v1/reports/month-over-month`
- **Status**: ✅ Implemented (2025-11-27)

### FR-007.2: Spending Velocity (Daily Burn Rate)
- **Requirement**: Calculate daily spending rate and project monthly total
- **Purpose**: Know early in the month if on track to overspend
- **Acceptance Criteria**:
  - Calculate daily spending rate (total expenses / days elapsed)
  - Project monthly total based on current pace
  - Compare projection to previous month
  - Determine pace: over_budget, under_budget, on_track
  - Show days remaining and projected remaining spending
  - Handle both current and past months correctly
- **API**: `GET /api/v1/reports/spending-velocity`
- **Status**: ✅ Implemented (2025-11-27)

### FR-007.3: Anomaly Detection
- **Requirement**: Detect unusual transactions that may indicate waste or errors
- **Purpose**: Catch unexpected charges, forgotten subscriptions, budget leaks
- **Acceptance Criteria**:
  - **Large Transactions**: Detect purchases > threshold std deviations from mean
  - **New Merchants**: Flag first-time purchases at new stores
  - **Unusual Categories**: Detect category spending significantly above average
  - Use 6-month baseline for statistical analysis
  - Configurable threshold (default: 2.0 standard deviations)
  - Sort anomalies by severity (z-score)
  - Provide clear explanations for each anomaly
- **API**: `GET /api/v1/reports/anomalies`
- **Status**: ✅ Implemented (2025-11-27)

### FR-007.4: Dashboard Integration
- **Requirement**: Display advanced analytics on main dashboard
- **Acceptance Criteria**:
  - Show month-over-month % changes on summary cards
  - Daily burn rate card with progress bar and pace indicator
  - Unusual activity card showing anomaly counts and top items
  - Color-coded indicators (green=good, red=bad)
  - Auto-refresh on page load
- **Status**: ✅ Implemented (2025-11-27)

## FR-008: Budget Tracking (v0.3)

### FR-008.1: Budget Creation
- **Requirement**: Create and manage spending budgets by category
- **Purpose**: Set limits and track spending against budget goals
- **Acceptance Criteria**:
  - Create budget with category, amount, period (monthly/yearly)
  - Optional rollover (unused budget carries to next period)
  - Support specific date ranges (start_date, end_date)
  - Full CRUD operations (create, read, update, delete)
  - Prevent duplicate budgets for same category/period
- **API**: `POST /api/v1/budgets`, `GET /api/v1/budgets`, `PATCH /api/v1/budgets/{id}`, `DELETE /api/v1/budgets/{id}`
- **Status**: ✅ Implemented (2025-11-28)

### FR-008.2: Budget Status Tracking
- **Requirement**: Monitor actual spending against budget limits
- **Purpose**: Know in real-time if on track, approaching limit, or over budget
- **Acceptance Criteria**:
  - Calculate actual spending vs budget for specified period
  - Status indicators: on_track (<80%), warning (80-100%), exceeded (>100%)
  - Show remaining budget amount and percentage used
  - Support monthly and yearly periods
  - Query by specific year/month or current period
- **API**: `GET /api/v1/budgets/status/current`
- **Status**: ✅ Implemented (2025-11-28)

### FR-008.3: Budget Alerts
- **Requirement**: Identify budgets in warning or exceeded status
- **Purpose**: Proactively notify of budget issues
- **Acceptance Criteria**:
  - Return only budgets at 80%+ usage (warning or exceeded)
  - Sort by severity (exceeded first)
  - Include all budget status details
  - Filter by period (current month/year by default)
- **API**: `GET /api/v1/budgets/alerts/active`
- **Status**: ✅ Implemented (2025-11-28)

### FR-008.4: Budget Dashboard UI
- **Requirement**: Visual budget tracking interface
- **Features**:
  - Alert cards for warning/exceeded budgets
  - Grid view of all budget statuses with progress bars
  - Color-coded status indicators
  - Modal form for create/edit
  - Real-time updates
- **Status**: ✅ Implemented (2025-11-28)

## FR-009: Category Rules Engine (v0.3)

### FR-009.1: Rule Creation
- **Requirement**: Define automated category assignment rules
- **Purpose**: Automatically categorize transactions based on patterns
- **Acceptance Criteria**:
  - Rule conditions: merchant pattern, description pattern, amount range, account source
  - Match logic: ANY (OR) or ALL (AND)
  - Priority-based execution (higher priority = applied first)
  - Enable/disable rules
  - Full CRUD operations
  - Require at least one matching condition
- **API**: `POST /api/v1/category-rules`, `GET /api/v1/category-rules`, `PATCH /api/v1/category-rules/{id}`, `DELETE /api/v1/category-rules/{id}`
- **Status**: ✅ Implemented (2025-11-28)

### FR-009.2: Pattern Matching
- **Requirement**: Match transactions against rule conditions
- **Matching Logic**:
  - Merchant pattern: case-insensitive substring match
  - Description pattern: case-insensitive substring match
  - Amount range: min <= amount <= max (optional bounds)
  - Account source: exact match
  - Combine conditions with AND/OR logic
- **Acceptance Criteria**:
  - Apply highest priority matching rule first
  - Skip disabled rules
  - Track match count and last match date
  - Only match uncategorized transactions
- **Status**: ✅ Implemented (2025-11-28)

### FR-009.3: Rule Testing
- **Requirement**: Preview rule matches before applying
- **Purpose**: Validate rule effectiveness without modifying data
- **Acceptance Criteria**:
  - Show count of matching transactions
  - Preview sample matches (up to 5)
  - Test against current transaction database
  - No side effects (read-only)
- **API**: `POST /api/v1/category-rules/{id}/test`
- **Status**: ✅ Implemented (2025-11-28)

### FR-009.4: Bulk Rule Application
- **Requirement**: Apply all active rules to transactions
- **Purpose**: Batch categorize uncategorized transactions
- **Acceptance Criteria**:
  - Apply rules in priority order
  - Only update uncategorized transactions (category = null)
  - Return count of matched transactions
  - Update rule statistics (match_count, last_matched_date)
- **API**: `POST /api/v1/category-rules/apply`
- **Status**: ✅ Implemented (2025-11-28)

### FR-009.5: Rules Management UI
- **Requirement**: Interactive rules management interface
- **Features**:
  - List all rules with conditions and stats
  - Create/edit modal with all condition fields
  - Toggle enabled/disabled
  - Test rule preview
  - Apply all rules button
  - Visual match logic indicator (AND/OR)
- **Status**: ✅ Implemented (2025-11-28)

## FR-010: Recurring Transaction Detection (v0.3)

### FR-010.1: Pattern Detection
- **Requirement**: Automatically detect recurring transaction patterns
- **Purpose**: Identify subscriptions, bills, and recurring payments
- **Acceptance Criteria**:
  - Group transactions by merchant
  - Calculate intervals between transactions
  - Detect frequency: weekly, biweekly, monthly, quarterly, yearly
  - Confidence scoring based on consistency (0-1 scale)
  - Require minimum occurrences (configurable, default 3)
  - Require minimum confidence (configurable, default 0.7)
  - Calculate amount range (10% variance allowed)
  - Assign most common category
  - Predict next expected date
  - Skip duplicate patterns
- **API**: `POST /api/v1/recurring/detect`
- **Status**: ✅ Implemented (2025-11-28)

### FR-010.2: Pattern Management
- **Requirement**: CRUD operations for recurring patterns
- **Acceptance Criteria**:
  - List patterns with filtering by status
  - Get individual pattern details
  - Manually create patterns
  - Update pattern attributes (category, status, dates, amounts)
  - Delete patterns
  - Status transitions: active, paused, ended
- **API**: `GET /api/v1/recurring`, `GET /api/v1/recurring/{id}`, `POST /api/v1/recurring`, `PATCH /api/v1/recurring/{id}`, `DELETE /api/v1/recurring/{id}`
- **Status**: ✅ Implemented (2025-11-28)

### FR-010.3: Upcoming Predictions
- **Requirement**: Predict upcoming recurring transactions
- **Purpose**: Forecast future expenses for budgeting
- **Acceptance Criteria**:
  - Show transactions expected in next N days (configurable, default 30)
  - Only include active patterns
  - Calculate days until expected
  - Estimate amount (average of min/max)
  - Sort by expected date
  - Include confidence score
- **API**: `GET /api/v1/recurring/predictions/upcoming`
- **Status**: ✅ Implemented (2025-11-28)

### FR-010.4: Missing Transaction Detection
- **Requirement**: Identify expected transactions that haven't appeared
- **Purpose**: Catch cancelled subscriptions, billing issues, payment failures
- **Acceptance Criteria**:
  - Find patterns where next_expected_date has passed
  - Configurable overdue threshold (default 7 days)
  - Calculate days overdue
  - Sort by most overdue first
  - Only check active patterns
- **API**: `GET /api/v1/recurring/missing`
- **Status**: ✅ Implemented (2025-11-28)

### FR-010.5: Recurring Transactions UI
- **Requirement**: Interactive recurring transactions dashboard
- **Features**:
  - Stats cards: active patterns, upcoming count, missing count
  - Tabbed interface: All Patterns, Upcoming, Missing
  - Pattern cards with frequency badges
  - Confidence indicators
  - Detect patterns button
  - Toggle active/paused status
  - Color-coded by frequency
  - Next expected date display
- **Status**: ✅ Implemented (2025-11-28)

## Non-Goals (Out of Scope for v0.3)
- ❌ Multi-user / multi-tenant
- ❌ User authentication / login
- ❌ Bill payment
- ❌ Investment tracking
- ❌ Tax reporting / 1099 generation
- ❌ Real-time bank sync (Plaid, etc.)
- ❌ Mobile apps
- ❌ Email notifications
- ❌ Scheduled imports
- ❌ OCR receipt scanning
- ❌ AI/ML-based predictions (beyond statistical analysis)
- ❌ Custom budget rollover logic
- ❌ Advanced rules engine (regex, fuzzy matching)
