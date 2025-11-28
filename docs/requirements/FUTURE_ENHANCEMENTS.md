# Future Enhancements

Ideas for future versions beyond v0.

## High Priority

### Multi-Bank Support
- Add parsers for more banks (Chase, Wells Fargo, Citi, etc.)
- Generic CSV mapper for custom formats
- Auto-detect more format types
- Bank-specific merchant cleaning rules

### Budget Tracking
- Set monthly budgets per category
- Track actual vs budget
- Alert when approaching budget limit
- Rollover unused budget
- Yearly budget planning

### Recurring Transactions
- Detect recurring patterns (subscriptions, bills)
- Mark transactions as recurring
- Predict future recurring transactions
- Alert on missing expected transactions

### Receipt Management
- Upload receipt images
- OCR to extract amount/merchant
- Link receipts to transactions
- Store in cloud storage

### Advanced Search
- Full-text search
- Save search filters as "views"
- Export search results
- Regex pattern matching

## Medium Priority

### Multi-User Support
- User authentication (email/password)
- User registration
- Password reset
- User profiles
- Row-level security per user

### Mobile App
- React Native or Progressive Web App
- Mobile-optimized UI
- Photo receipt capture
- Push notifications

### Improved Analytics
- ✅ ~~Compare time periods (this month vs last month)~~ - Implemented v0.2
- ✅ ~~Spending velocity (daily average)~~ - Implemented v0.2
- ✅ ~~Anomaly detection (unusual spending)~~ - Implemented v0.2
- Customizable date ranges
- Year-over-year comparison
- Forecast future spending based on trends
- Advanced statistical analysis (regression, predictions)

### Categories Improvements
- Subcategories (nested categories)
- Multiple categories per transaction (split transactions)
- ✅ ~~Category rules engine (basic)~~ - Implemented v0.3
- **Advanced Rules Engine Enhancements** (future):
  - Switch to python-business-rules for more powerful declarative rules
  - Fuzzy merchant matching with rapidfuzz (handles typos/variations)
  - Regex pattern support for complex matching
  - Time-based rules (weekday, time of day)
  - Composite conditions (nested AND/OR logic)
- Category budgets (see Budget Tracking - implemented v0.3)
- Category goals

### Bank Integration
- Plaid integration for automatic transaction sync
- Real-time balance updates
- Automatic daily imports
- Bank account linking

### Data Export/Import
- Export all data to CSV/JSON
- Import from other finance apps (Mint, YNAB, etc.)
- Backup/restore functionality
- Data portability

## Low Priority

### Tax Features
- Mark transactions as tax-deductible
- Generate tax reports
- Export for TurboTax/TaxAct
- 1099 income tracking
- Business expense tracking

### Investment Tracking
- Link to investment accounts
- Track portfolio performance
- Dividend/interest tracking
- Capital gains calculation

### Bill Management
- Track upcoming bills
- Bill payment reminders
- Mark bills as paid
- Recurring bill templates

### Sharing & Collaboration
- Share access with spouse/partner
- Shared budgets
- Transaction assignment (who spent what)
- Family account management

### Advanced Visualizations
- Custom dashboard widgets
- Drag-and-drop dashboard builder
- More chart types (sankey, treemap, etc.)
- Data drill-down
- Interactive filters

### Automation & Rules
- Auto-categorization rules engine
- Custom workflows
- If-this-then-that rules
- Scheduled reports
- Email digests

### API & Integrations
- Public API for third-party apps
- Webhooks
- Zapier integration
- IFTTT integration
- Export to Google Sheets

### Advanced Features
- Split transactions
- Transfer detection (automatically mark internal transfers)
- Merchant aliases (map multiple merchant names to one)
- Custom fields per transaction
- Tags/labels
- Notes and attachments
- Transaction comments
- Audit log

## Technical Improvements

### Performance
- Database query optimization
- Caching layer (Redis)
- Database indexes review
- Pagination improvements
- Lazy loading

### Security
- Two-factor authentication
- Audit logging
- Data encryption at rest
- Secure API keys
- Rate limiting
- IP whitelisting

### DevOps
- CI/CD pipeline
- Automated testing
- Docker containers
- Kubernetes deployment
- Monitoring and alerting
- Error tracking (Sentry)
- Performance monitoring

### UX Improvements
- Keyboard shortcuts
- Dark mode
- Customizable themes
- Accessibility improvements (WCAG compliance)
- Onboarding tutorial
- Help documentation
- In-app chat support

### Developer Experience
- API documentation (Swagger/OpenAPI)
- SDK for common languages
- Plugin system
- Webhook documentation
- Developer portal

## Ideas for Consideration

### AI/ML Features
- Smart categorization using ML
- Anomaly detection
- Spending predictions
- Financial advice suggestions
- Natural language queries ("show me coffee spending last month")

### Gamification
- Savings goals with progress bars
- Achievements/badges
- Spending challenges
- Leaderboards (if multi-user)

### Financial Planning
- Retirement planning calculator
- Debt payoff calculator
- Savings goal tracker
- Net worth tracking
- Financial health score

### Social Features
- Compare spending with anonymous averages
- Community budgets/templates
- Shared categories
- Tips and tricks sharing

### Smart Notifications
- Unusual spending alerts
- Budget warnings
- Bill due reminders
- Low balance alerts
- Duplicate transaction warnings

### Integrations
- Credit score tracking (Credit Karma API)
- Cryptocurrency tracking
- Venmo/PayPal integration
- Amazon purchase import
- Subscription tracking (Truebill-like)

## User Feedback & Research Needed

Before implementing features, validate with users:
- [ ] Survey users on most wanted features
- [ ] A/B test new UI changes
- [ ] User interviews on pain points
- [ ] Analytics on feature usage
- [ ] Beta testing program

## Version Roadmap

### v0.1 ✅ (Completed)
- Basic transaction import (BOFA, AMEX)
- Manual categorization
- Simple reporting
- Reconciliation workflow

### v0.2 ✅ (Completed - 2025-11-27)
- ✅ Advanced analytics (month-over-month, spending velocity, anomaly detection)
- ✅ Enhanced dashboard with insights
- ✅ Comprehensive test suite (24/26 tests passing)

### v0.3 (Planned - Next)
- Budget tracking
- Recurring transaction detection
- Better category inference (ML-based)
- Category rules engine

### v0.4 (Planned)
- Multi-user support
- Authentication
- Cloud deployment

### v1.0 (Planned)
- Mobile app
- Bank integration (Plaid)
- Receipt management

### v2.0 (Future)
- Investment tracking
- Tax features
- API for third-party apps
