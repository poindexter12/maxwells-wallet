# Contributing to Maxwell's Wallet

Thank you for your interest in contributing! This document explains how to get started.

## Getting Started

1. Fork the repository and clone your fork
2. Install [mise](https://mise.jdx.dev/) if you don't have it: `curl https://mise.run | sh`
3. Run `just setup` to install dependencies and seed the database
4. Run `just dev::dev` to start both backend and frontend servers
5. Open http://localhost:3000

See [README.md](README.md) for detailed setup instructions including Docker and devcontainer options.

## Development Workflow

1. Create a branch from `main` for your change
2. Make your changes, following the code style guidelines below
3. Add or update tests for your changes
4. Run `just test::lint` and `just test::all` to verify everything passes
5. Open a pull request against `main`

## Code Style

**Backend (Python):**
- Linted and formatted by [Ruff](https://docs.astral.sh/ruff/) (`uv run ruff check .`)
- Type-checked by [mypy](https://mypy-lang.org/) (`uv run mypy app`)
- Use type hints on all function signatures
- Use `structlog` for logging, never `print()`

**Frontend (TypeScript):**
- Linted by [ESLint](https://eslint.org/) (`npm run lint`)
- Prefer server components; use client components only for event-heavy UI
- Use Tailwind utility classes for styling

Pre-commit hooks enforce these checks automatically. Install them with `just setup`.

## Testing Requirements

All pull requests must include tests for new functionality:

- **Backend:** pytest tests colocated as `tests/test_*.py`. Run with `just test::backend`.
- **Frontend:** Vitest tests colocated as `*.test.tsx`.
- **E2E:** Playwright tests in `frontend/e2e/`. Run with `just test::e2e`.
- Use `data-testid` attributes for element selection (see `frontend/src/test-ids.ts`).

Coverage target is 80% (enforced by Codecov on PRs).

## Commit Messages

Use concise, action-oriented messages describing the change:

```
CLI: add verbose flag to send
fix: prevent duplicate imports on retry
docs: update Docker setup instructions
```

## Internationalization (i18n)

When adding or modifying user-facing strings:
- Only edit `frontend/src/messages/en-US.json` (other locales are managed by Crowdin)
- Use dot-notation keys: `section.subsection.key`
- See [docs/i18n-workflow.md](docs/i18n-workflow.md) for the full workflow

## Reporting Bugs

Use the [issue templates](https://github.com/poindexter12/maxwells-wallet/issues/new/choose) to report bugs, request features, or flag performance issues.

## Security Vulnerabilities

**Do not** open public issues for security vulnerabilities. Use [GitHub's private vulnerability reporting](https://github.com/poindexter12/maxwells-wallet/security/advisories/new) instead. See [SECURITY.md](SECURITY.md) for details.
