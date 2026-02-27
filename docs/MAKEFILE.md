# Just Recipes Reference

This document provides detailed information about all available `just` recipes for Maxwell's Wallet.

Run bare `just` (no arguments) to see a quick reference of all recipes.

## Prerequisites

Install [mise](https://mise.jdx.dev/):
```bash
curl https://mise.run | sh
```

mise auto-installs all dev tools (Node, Python, uv, just, gum) when you enter the project directory.

## Quick Start

```bash
just setup       # First-time setup (installs deps, inits DB, seeds data)
just dev::dev    # Start both backend and frontend servers
```

## File Organization

Recipes are organized into modular files under `.just/`:

| File | Purpose |
|------|---------|
| `justfile` | Main entry point, shared variables, core targets |
| `.just/dev.just` | Development servers |
| `.just/db.just` | Database operations |
| `.just/test.just` | Testing (unit, e2e, lint) |
| `.just/docker.just` | Docker operations |
| `.just/release.just` | Release automation |
| `.just/i18n.just` | Internationalization |
| `.just/utils.just` | Utilities (clean, status, info) |

---

## Core Recipes

### `just setup`
First-time setup. Runs `install`, `db::init`, and `db::seed`.

### `just install`
Install all dependencies (backend + frontend).

### `just install-backend`
Install Python dependencies using `uv`.

### `just install-frontend`
Install Node.js dependencies using `npm`.

---

## Development

### `just dev::dev`
Start both backend and frontend servers in parallel.
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### `just dev::backend`
Start only the backend FastAPI server with hot reload.

### `just dev::frontend`
Start only the frontend Next.js development server.

### `just dev::build-frontend`
Build the frontend for production.

---

## Database

### `just db::init`
Initialize the database by creating all tables.

### `just db::seed`
Seed the database with sample data and default categories.

### `just db::reset`
Delete and recreate the database (runs `db::init` + `db::seed`). Prompts for confirmation.

### `just db::migrate MESSAGE="description"`
Create a new Alembic migration.

### `just db::upgrade`
Apply all pending database migrations.

### `just db::demo-setup`
Set up demo data for demo mode.

---

## Testing

### Unit & Integration Tests

```bash
just test::backend       # Run all backend tests (excludes E2E)
just test::coverage      # Run tests with coverage report
just test::all           # Run all tests (unit + E2E)
```

### End-to-End Tests (Playwright)

**Prerequisite:** Run `just dev::dev` in another terminal first.

```bash
just test::e2e-install   # Install Playwright browsers (one-time setup)
just test::e2e           # Run E2E tests (headless)
just test::chaos         # Run chaos/monkey tests
```

### Linting & Quality

```bash
just test::lint          # Lint all code (backend + frontend)
just test::quality       # Run all quality checks (lint + typecheck + vulture)
just test::typecheck     # Type checking with mypy
just test::vulture       # Dead code detection
just test::security-audit # Security audit
```

---

## Docker

### Building

```bash
just docker::build       # Build Docker image
```

### Running

```bash
just docker::up          # Start containers
just docker::down        # Stop containers
just docker::logs        # View container logs
just docker::shell       # Open shell in running container
```

### Cleanup

```bash
just docker::clean       # Remove containers and volumes (DESTRUCTIVE)
```

---

## Internationalization (i18n)

```bash
just i18n::upload        # Push en-US.json to Crowdin
just i18n::download      # Pull all translations from Crowdin
just i18n::status        # Show translation progress
just i18n::pseudo        # Generate pseudo-locale for testing
just i18n::harvest-new   # AI context extraction for new strings (uses API credits)
```

---

## Release

Automated release workflow that updates versions, commits, tags, and pushes to trigger GitHub Actions.

### Pre-flight Checks

```bash
just release::check      # Validate versions match and docs updated (dry-run)
just release::validate   # Same checks but fails on errors
```

Pre-flight checks verify:
- Backend and frontend versions match
- CHANGELOG.md has been updated since last tag
- CHANGELOG.md contains section for current version
- README.md and docs-site/index.md have changes

### Creating Releases

```bash
just release::release VERSION="1.2.3"   # Release specific version
```

The release recipe will:
1. Verify CHANGELOG.md has the version section
2. Update version in `backend/pyproject.toml` and `frontend/package.json`
3. Commit and tag
4. Push to GitHub

GitHub Actions will then:
1. Create a GitHub Release with changelog
2. Build Docker image
3. Push to `ghcr.io/poindexter12/maxwells-wallet:<version>`

---

## Utilities

### Status & Info

```bash
just utils::status       # Check if backend/frontend servers are running
just utils::info         # Show project information and features
just utils::check-deps   # Verify required dependencies are installed
```

### Cleaning

```bash
just utils::clean        # Clean build artifacts and caches
just utils::clean-all    # Clean everything (including .venv, node_modules, DB)
```

---

## Common Workflows

### Daily Development
```bash
just dev::dev            # Start servers, then work in your editor
```

### Running Tests Before Commit
```bash
just test::backend && just test::lint
```

### Fresh Start
```bash
just utils::clean-all
just setup
just dev::dev
```

### Creating a Release
```bash
# Ensure all tests pass
just test::all

# Create release
just release::release VERSION="1.2.3"
```
