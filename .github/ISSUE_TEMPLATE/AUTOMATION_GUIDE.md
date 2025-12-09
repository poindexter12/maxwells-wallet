# Automation Guide for Issue Creation

This guide is for developers maintaining the CI/CD workflows that automatically create issues.

## Current Automated Issue Creation

### Nightly Code Quality (`nightly.yml`)

**Security Audit Failures**
```bash
gh issue create \
  --title "🔒 Security: Vulnerabilities detected in dependencies" \
  --label "security,automated" \
  --body "..."
```

**Dead Code Detection**
```bash
gh issue create \
  --title "🧹 Cleanup: Dead code detected" \
  --label "dead-code,automated,chore" \
  --body "..."
```

**Coverage Threshold Failures**
```bash
gh issue create \
  --title "📉 Coverage: Below 85% threshold" \
  --label "coverage,automated,testing" \
  --body "..."
```

### Chaos Tests (`nightly-chaos.yml`)

```bash
gh issue create \
  --title "🐒 Chaos Testing: Failures detected" \
  --label "chaos-testing,automated,bug" \
  --body "..."
```

### E2E Tests (`nightly-e2e.yml`)

```bash
gh issue create \
  --title "🌐 E2E Tests: Cross-browser failures detected" \
  --label "e2e-testing,automated,bug" \
  --body "..."
```

### Performance Tests (`nightly-performance.yml`)

```bash
gh issue create \
  --title "🐢 Performance: Test failures detected" \
  --label "performance,automated" \
  --body "..."
```

## Best Practices

### 1. Prevent Duplicate Issues

Always check if an issue already exists before creating.

### 2. Label Consistency

Use consistent labels:
- Always include `automated` to indicate auto-creation
- Include the test type label (`security`, `e2e-testing`, etc.)
- Add severity/type labels (`bug`, `chore`, etc.)

### 3. Actionable Information

Include in the issue body:
- Link to the workflow run
- Specific error output or logs
- Clear next steps for resolution
- Artifact links if applicable

### 4. Issue Lifecycle

Automated issues should:
- Be created only when not in pull_request context (nightly/scheduled runs)
- Not be created if an open issue with the same label exists
- Include enough context to be actionable
- Link to workflow artifacts when available

## Adding New Automated Issues

When adding a new workflow that creates issues:

1. **Choose appropriate labels**
   - Add a specific label for the test type
   - Include `automated`
   - Add type label (`bug`, `chore`, etc.)

2. **Check for duplicates**
   - Search by the specific label
   - Only create if none exist

3. **Provide context**
   - Link to the workflow run
   - Include relevant logs/output
   - Give clear next steps

4. **Update documentation**
   - Add to this guide
   - Update the main README
   - Document the label in `.github/ISSUE_TEMPLATE/README.md`

## References

- [GitHub CLI Issue Creation](https://cli.github.com/manual/gh_issue_create)
- [GitHub Actions Context](https://docs.github.com/en/actions/learn-github-actions/contexts)
- [Issue Template Documentation](README.md)
