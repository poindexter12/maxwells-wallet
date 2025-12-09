# GitHub Issue Templates

This directory contains issue templates for Maxwell's Wallet. When creating a new issue, GitHub will present these templates as options.

## Available Templates

### 🐛 Bug Report (`bug_report.yml`)
For reporting bugs or unexpected behavior in the application.

**Auto-labels:** `bug`, `needs-triage`

**Use when:**
- Something isn't working as expected
- You encounter an error or crash
- UI/UX behaves incorrectly

### ✨ Feature Request (`feature_request.yml`)
For suggesting new features or enhancements.

**Auto-labels:** `feature`, `needs-triage`

**Use when:**
- Proposing new functionality
- Suggesting improvements to existing features
- Requesting new capabilities

### 🐢 Performance Issue (`performance.yml`)
For reporting performance problems or regressions.

**Auto-labels:** `performance`, `needs-triage`

**Use when:**
- Pages load slowly
- API responses are slow
- High resource usage (CPU, memory)
- Database queries are slow

### 🔒 Security Vulnerability (`security.yml`)
For reporting security issues or vulnerabilities.

**Auto-labels:** `security`, `needs-triage`

**Use when:**
- You discover a security vulnerability
- You find insecure configurations
- Dependencies have known vulnerabilities

**Note:** For sensitive security issues, use GitHub's private vulnerability reporting (Security tab → Report a vulnerability) instead of creating a public issue.

### 📋 Task / Chore (`task.yml`)
For general maintenance, refactoring, or non-feature work.

**Auto-labels:** `chore`, `needs-triage`

**Use when:**
- Code needs refactoring
- Documentation needs updates
- Dependencies need updating
- Technical debt needs addressing
- CI/CD improvements needed

### 🤖 Automated Test Failure (`automated_test_failure.md`)
Template used by CI/CD workflows to create issues automatically.

**Auto-labels:** `automated`

**Note:** This is for automated use only. Human users should use the Bug Report template instead.

## Automated Issue Creation

The following GitHub Actions workflows automatically create issues when tests fail:

- **Nightly Code Quality** → Creates issues with labels: `security`, `dead-code`, `coverage`
- **Chaos Tests** → Creates issues with label: `chaos-testing`
- **E2E Tests** → Creates issues with label: `e2e-testing`
- **Performance Tests** → Creates issues with label: `performance`

These automated issues use the `automated_test_failure.md` template format and include:
- Link to the failed workflow run
- Failure details and output
- Next steps for resolution

## Label System

### Type Labels
- `bug` - Something isn't working
- `feature` - New feature or request
- `chore` - Maintenance, refactoring, or technical work
- `security` - Security-related issue
- `performance` - Performance-related issue

### Status Labels
- `needs-triage` - Needs review and prioritization
- `accepted` - Triaged and accepted for work
- `needs-info` - Waiting for more information
- `automated` - Created by CI/CD automation

### Priority Labels (added during triage)
- `priority: critical` - Urgent, blocking issue
- `priority: high` - Important, should be addressed soon
- `priority: medium` - Normal priority
- `priority: low` - Nice to have, lower priority

### Component Labels (added during triage)
- `frontend` - Frontend/UI work
- `backend` - Backend/API work
- `database` - Database-related
- `docs` - Documentation
- `testing` - Testing-related

### Test-Specific Labels
- `chaos-testing` - From chaos/monkey tests
- `e2e-testing` - From E2E tests
- `dead-code` - Dead code detection
- `coverage` - Test coverage issues

## Triage Process

All new issues get the `needs-triage` label automatically. During triage:

1. **Validate** - Ensure issue is valid and has enough information
2. **Categorize** - Add appropriate type and component labels
3. **Prioritize** - Add priority label based on impact/urgency
4. **Status** - Remove `needs-triage`, add `accepted` or `needs-info`
5. **Assignment** - Assign to milestone or team member if appropriate

## Template Customization

Templates are written in YAML (`.yml`) or Markdown (`.md`) format:

- **YAML templates** provide structured forms with dropdowns, checkboxes, and validation
- **Markdown templates** offer more flexibility but less structure

To modify templates, edit the files in this directory. Changes take effect immediately.

## Testing Templates

To test templates locally before pushing:

1. Create a test repository or use a branch
2. Push your changes to `.github/ISSUE_TEMPLATE/`
3. Create a new issue in the GitHub UI
4. Verify the template appears and works correctly

## References

- [GitHub Issue Templates Documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
- [YAML Template Syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
