# Requirements Documentation

This folder contains all requirements, specifications, and planning documents for the Finances app.

## Documents

### [USER_NEEDS.md](./USER_NEEDS.md)
User goals, needs, and workflows. Start here to understand what the app is solving.

**Contents:**
- Primary goal and user profile
- Core needs (import, management, categorization, reconciliation, analysis)
- Typical user workflow
- Pain points being solved
- Success criteria

### [FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md)
Detailed functional requirements for all features.

**Contents:**
- FR-001: CSV Import (format detection, parsing, preview, duplicates)
- FR-002: Transaction Management (list, search, CRUD)
- FR-003: Category Inference (auto-categorization, keyword rules)
- FR-004: Reconciliation (bulk operations, status management)
- FR-005: Reports & Analytics (monthly summary, trends, charts)
- FR-006: Data Export
- Non-goals (what we're NOT building in v0)

### [TECHNICAL_SPECIFICATIONS.md](./TECHNICAL_SPECIFICATIONS.md)
Technical implementation details and architecture.

**Contents:**
- Architecture overview
- Technology stack (Next.js, FastAPI, SQLModel)
- Database schema
- API endpoints
- Data models
- CSV parsing logic
- Category inference algorithm
- Frontend routes
- Performance and security considerations

### [FUTURE_ENHANCEMENTS.md](./FUTURE_ENHANCEMENTS.md)
Ideas for future versions beyond v0.

**Contents:**
- High priority (multi-bank, budgets, recurring transactions)
- Medium priority (multi-user, mobile, advanced analytics)
- Low priority (tax features, investments, bill management)
- Technical improvements
- Ideas for consideration (AI/ML, gamification)
- Version roadmap

## How to Use These Documents

### For Development
1. Check **USER_NEEDS.md** to understand the "why"
2. Reference **FUNCTIONAL_REQUIREMENTS.md** for the "what"
3. Use **TECHNICAL_SPECIFICATIONS.md** for the "how"
4. Keep **FUTURE_ENHANCEMENTS.md** in mind but don't implement yet

### For Planning
- Use these docs to create issues/tickets
- Link requirements to specific features
- Track which requirements are implemented
- Update docs when requirements change

### For Onboarding
New developers should read in this order:
1. USER_NEEDS.md
2. FUNCTIONAL_REQUIREMENTS.md
3. TECHNICAL_SPECIFICATIONS.md
4. ../README.md (main project README)

## Updating Requirements

When requirements change:
1. Update the relevant document
2. Add a note with date and reason
3. Commit with clear message
4. Consider impact on implementation

## Current Status

**Last Updated**: 2025-11-27

**Version**: 0.1 (v0)

**Implemented**:
- ✅ All FR-001 (CSV Import)
- ✅ All FR-002 (Transaction Management)
- ✅ All FR-003 (Category Inference)
- ✅ All FR-004 (Reconciliation)
- ✅ All FR-005 (Reports & Analytics)
- ✅ FR-006 (Export) - partial

**Not Implemented** (future):
- Everything in FUTURE_ENHANCEMENTS.md
- Authentication/multi-user
- Bank integrations
- Mobile apps
- Advanced analytics

## Related Documentation

- `/README.md` - Main project README with setup instructions
- `/QUICKSTART.md` - Quick start guide
- `/MAKEFILE_GUIDE.md` - Makefile command reference
- `/FIXES.md` - Issues fixed during development
- `/forge.config.yaml` - FORGE configuration used to build this
