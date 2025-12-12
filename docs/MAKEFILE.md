# Makefile Commands

This document provides detailed information about all available `make` commands for Maxwell's Wallet.

Run `make` or `make help` to see a quick reference of all commands.

## Quick Start

```bash
make setup   # First-time setup (installs deps, inits DB, seeds data)
make dev     # Start both backend and frontend servers
```

## File Organization

Commands are organized into modular files under `make/`:

| File | Purpose |
|------|---------|
| `Makefile` | Main entry point, shared variables, core targets |
| `make/dev.mk` | Development servers |
| `make/db.mk` | Database operations |
| `make/test.mk` | Testing (unit, e2e, lint) |
| `make/docker.mk` | Docker operations |
| `make/release.mk` | Release automation |
| `make/utils.mk` | Utilities (clean, status, info) |

---

## Core Commands

### `make setup`
First-time setup. Runs `install`, `db-init`, and `db-seed`.

### `make install`
Install all dependencies (backend + frontend).

### `make install-backend`
Install Python dependencies using `uv`.

### `make install-frontend`
Install Node.js dependencies using `npm`.

---

## Development

### `make dev`
Start both backend and frontend servers in parallel.
- Backend: http://localhost:8000
- Frontend: http://localhost:3000

### `make backend`
Start only the backend FastAPI server with hot reload.

### `make frontend`
Start only the frontend Next.js development server.

### `make build-frontend`
Build the frontend for production.

---

## Database

### `make db-init`
Initialize the database by creating all tables.

### `make db-seed`
Seed the database with sample data and default categories.

### `make db-reset`
Delete and recreate the database (runs `db-init` + `db-seed`).

### `make db-migrate`
Create a new Alembic migration. Prompts for a migration message.

### `make db-upgrade`
Apply all pending database migrations.

---

## Testing

### Unit & Integration Tests

```bash
make test-backend    # Run all backend tests (excludes E2E)
make test-unit       # Alias for test-backend
make test-reports    # Run report/analytics tests only
make test-tags       # Run tag system tests only
make test-import     # Run CSV import tests only
make test-budgets    # Run budget tests only
make test-all        # Run all tests (unit + E2E)
```

### End-to-End Tests (Playwright)

**Prerequisite:** Run `make dev` in another terminal first.

```bash
make test-e2e-install   # Install Playwright browsers (one-time setup)
make test-e2e           # Run E2E tests (headless)
make test-e2e-headed    # Run E2E tests with visible browser
make test-e2e-debug     # Run E2E tests in debug mode (slow, step-through)
make test-e2e-import    # Run only import workflow tests
make test-e2e-full      # Run full workflow tests (slow)
```

### Linting

```bash
make lint-frontend   # Lint frontend code with ESLint
```

---

## Docker

### Building

```bash
make docker-build        # Build Docker image
make docker-build-force  # Build Docker image without cache
```

### Running

```bash
make docker-up      # Start container (detached)
make docker-down    # Stop container
make docker-logs    # View container logs (follow mode)
make docker-shell   # Open bash shell in running container
```

### Database in Docker

```bash
make docker-seed     # Seed database with sample data
make docker-migrate  # Run database migrations
```

### Cleanup

```bash
make docker-clean   # Remove containers and volumes
```

---

## Release

Automated release workflow that updates versions, commits, tags, and pushes to trigger GitHub Actions.

### Pre-flight Checks

```bash
make release-check      # Validate versions match and docs updated (dry-run)
make release-validate   # Same checks but fails on errors
```

Pre-flight checks verify:
- Backend and frontend versions match
- CHANGELOG.md has been updated since last tag
- CHANGELOG.md contains section for current version
- README.md and docs-site/index.md have changes

### Creating Releases

```bash
make release                  # Show usage and current version
make release VERSION=1.2.3    # Release specific version
make release-patch            # Bump patch version (0.9.0 -> 0.9.1)
make release-minor            # Bump minor version (0.9.0 -> 0.10.0)
make release-major            # Bump major version (0.9.0 -> 1.0.0)
```

The release command will:
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
make status      # Check if backend/frontend servers are running
make info        # Show project information and features
make check-deps  # Verify required dependencies are installed
```

### Cleaning

```bash
make clean       # Clean build artifacts and caches
make clean-all   # Clean everything (including .venv, node_modules, DB)
```

### Test Data Anonymization

```bash
make anonymize         # Anonymize CSV files (data/raw/ -> data/anonymized/)
make anonymize-status  # Show status of anonymized files
make anonymize-force   # Force re-anonymize all files
```

---

## Common Workflows

### Daily Development
```bash
make dev   # Start servers, then work in your editor
```

### Running Tests Before Commit
```bash
make test-backend lint-frontend
```

### Fresh Start
```bash
make clean-all
make setup
make dev
```

### Creating a Release
```bash
# Ensure all tests pass
make test-all

# Create release
make release-patch   # or release-minor, release-major
```
