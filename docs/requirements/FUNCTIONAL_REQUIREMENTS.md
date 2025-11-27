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

## Non-Goals (Out of Scope for V0)
- ❌ Multi-user / multi-tenant
- ❌ User authentication / login
- ❌ Budget creation and tracking
- ❌ Bill payment
- ❌ Investment tracking
- ❌ Tax reporting / 1099 generation
- ❌ Real-time bank sync (Plaid, etc.)
- ❌ Mobile apps
- ❌ Email notifications
- ❌ Scheduled imports
- ❌ OCR receipt scanning
