# Architecture Patterns — Build System Modernization

**Domain:** Build tooling migration (Make → Just + gum + mise)
**Researched:** 2026-02-26

## Recommended Architecture

The new build system integrates Just (task runner), gum (interactive UI), and mise (tool version manager) into the existing Maxwell's Wallet project structure. This architecture preserves the modular organization of the current Makefile system while modernizing developer experience and environment management.

### System Boundaries

```
┌─────────────────────────────────────────────────────┐
│ Developer Environment                               │
│  ┌────────────┐  ┌──────────┐  ┌────────────────┐ │
│  │   mise     │  │  direnv  │  │  .env (secrets)│ │
│  │ (tooling)  │→→│  (.envrc)│→→│                │ │
│  └────────────┘  └──────────┘  └────────────────┘ │
│         ↓                                           │
│  ┌────────────────────────────────────────────┐   │
│  │           justfile (root)                   │   │
│  │  - imports .just/*.just modules             │   │
│  │  - calls gum for UX                         │   │
│  │  - calls mise-managed tools                 │   │
│  └────────────────────────────────────────────┘   │
│         ↓                ↓              ↓          │
│  ┌──────────┐    ┌──────────┐   ┌──────────┐    │
│  │ Backend  │    │ Frontend │   │  Docker  │    │
│  │ (uv/py)  │    │ (npm/ts) │   │ Compose  │    │
│  └──────────┘    └──────────┘   └──────────┘    │
└─────────────────────────────────────────────────────┘
         ↓                ↓              ↓
┌─────────────────────────────────────────────────────┐
│ CI/CD (GitHub Actions)                              │
│  - uses extractions/setup-just action               │
│  - uses jdx/mise-action                             │
│  - calls `just ci-*` recipes                        │
└─────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Interfaces With |
|-----------|---------------|-----------------|
| **mise** | Tool version management (just, gum, node, python, uv); environment variable injection | .mise.toml, .envrc (direnv), justfile recipes |
| **justfile (root)** | Recipe orchestration; imports domain modules; delegates to specialized .just files | .just/*.just modules, gum helpers, docker compose, backend/frontend directories |
| **.just/dev.just** | Development server recipes (backend, frontend, dev); replaces make/dev.mk | Backend (uv/uvicorn), Frontend (npm), gum prompts |
| **.just/test.just** | All testing recipes (unit, e2e, chaos, perf, lint, quality); replaces make/test.mk | Backend pytest, Frontend playwright, gum progress indicators |
| **.just/db.just** | Database operations (init, seed, migrate, reset); replaces make/db.mk | Backend alembic, gum confirm dialogs |
| **.just/docker.just** | Docker build/run recipes; replaces make/docker.mk | docker compose CLI, gum spinners |
| **.just/i18n.just** | Translation workflow (upload, download, harvest); replaces make/i18n.mk | Crowdin CLI, gum input prompts |
| **.just/release.just** | Release automation; replaces make/release.mk | Git, gum confirm dialogs |
| **.just/util.just** | Utility recipes (clean, status, info); replaces make/utils.mk | Filesystem, gum formatting |
| **scripts/gum-helpers.sh** | Shared gum UI functions (confirm, spinner, progress, input); sourced by recipes | gum binary (managed by mise) |
| **gum** | Interactive CLI components (prompts, spinners, menus, confirm dialogs) | All .just modules via helpers or inline |
| **direnv (.envrc)** | Auto-load environment on cd (secrets: CROWDIN_PERSONAL_TOKEN, ANTHROPIC_API_KEY) | mise, shell environment |

## Patterns to Follow

### Pattern 1: File Structure — Modular Justfile Organization

**What:** Organize ~77 recipes into domain-specific modules using Just's import feature, mirroring existing make/*.mk structure.

**When:** Project has >15 recipes spanning multiple domains (dev, test, db, docker, i18n, release, utils).

**Example:**
```just
# justfile (root)
# Import all domain modules from .just/ directory
import '.just/dev.just'
import '.just/test.just'
import '.just/db.just'
import '.just/docker.just'
import '.just/i18n.just'
import '.just/release.just'
import '.just/util.just'

# Shared variables (exported to all modules)
export BLUE := '\033[0;34m'
export GREEN := '\033[0;32m'
export YELLOW := '\033[0;33m'
export RED := '\033[0;31m'
export NC := '\033[0m'
export BACKEND_DIR := 'backend'
export FRONTEND_DIR := 'frontend'

# Default recipe (shows help)
default:
    @just --list

# Help with categorized output (delegates to gum)
help:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh
    gum_header "Maxwell's Wallet" "Personal Finance Tracker"
    gum_section "Setup & Install" "setup install install-backend install-frontend"
    gum_section "Development" "dev backend frontend build-frontend"
    # ... more sections
```

**Directory structure:**
```
.
├── justfile                    # Root orchestration, imports all modules
├── .just/                      # Module directory
│   ├── dev.just               # Development recipes (9 recipes)
│   ├── test.just              # Testing recipes (26 recipes)
│   ├── db.just                # Database recipes (6 recipes)
│   ├── docker.just            # Docker recipes (15 recipes)
│   ├── i18n.just              # Translation recipes (9 recipes)
│   ├── release.just           # Release recipes (3 recipes)
│   └── util.just              # Utility recipes (9 recipes)
├── scripts/
│   └── gum-helpers.sh         # Shared gum UI functions
├── .mise.toml                 # Tool versions + env config
├── .envrc                     # direnv integration (loads mise, sources .env)
└── .env                       # Secrets (gitignored, loaded by direnv)
```

### Pattern 2: mise Integration — Unified Tool and Environment Management

**What:** Use mise to manage all dev tools (just, gum, node, python, uv) and environment variables, replacing manual installation steps and .nvmrc/.python-version files.

**When:** Project requires specific tool versions and environment variables (secrets, config).

**Example (.mise.toml):**
```toml
[tools]
# Build system tools
just = "1.41"
gum = "0.15"

# Language runtimes
node = "22"
python = "3.11"

# Package managers
uv = "latest"

# CI/CD tools (optional, for local testing)
# gh = "latest"
# docker-compose = "latest"

[env]
# Non-secret environment variables
BACKEND_DIR = "backend"
FRONTEND_DIR = "frontend"
DATABASE_URL = "sqlite+aiosqlite:///./backend/data/wallet.db"
DEMO_MODE = "false"

# Secrets loaded from .env file (gitignored)
# CROWDIN_PERSONAL_TOKEN and ANTHROPIC_API_KEY in .env
_.file = '.env'

[tasks]
# Optional: mise tasks for simple operations
# (Use just for complex recipes; mise tasks for quick scripts)
check-tools = "just --version && gum --version && node --version && python --version && uv --version"
```

**Integration with direnv (.envrc):**
```bash
# .envrc (existing, modified to use mise)
use mise

# Legacy env vars can stay here or move to .mise.toml or .env
# export CROWDIN_PERSONAL_TOKEN="..." (move to .env)
# export ANTHROPIC_API_KEY="..." (move to .env)
```

**Secret management (.env, gitignored):**
```bash
# .env (gitignored)
CROWDIN_PERSONAL_TOKEN=c176a9458fbb6a66bacd5dc19e9531ecf7e81973851eaf2dfc3e29415135e55ac6195e43acde53fa
ANTHROPIC_API_KEY=REDACTED_API_KEY
```

**Migration impact:**
- `.nvmrc` → replaced by `mise.toml [tools] node = "22"`
- `backend/.python-version` → replaced by `mise.toml [tools] python = "3.11"`
- `.envrc` secrets → moved to `.env`, loaded via `mise.toml [env] _.file = '.env'`
- Manual tool checks (make check-deps, check-node) → automatic via mise

### Pattern 3: gum Helper Functions — Shared UI Components

**What:** Centralize gum UI calls in `scripts/gum-helpers.sh` for consistent UX across recipes; allow inline gum for simple cases.

**When:** Multiple recipes need similar interactive prompts, spinners, or formatting.

**Example (scripts/gum-helpers.sh):**
```bash
#!/usr/bin/env bash
# gum-helpers.sh - Shared gum UI functions for justfile recipes

# Color variables (from justfile exports)
: ${BLUE:='\033[0;34m'}
: ${GREEN:='\033[0;32m'}
: ${YELLOW:='\033[0;33m'}
: ${RED:='\033[0;31m'}
: ${NC:='\033[0m'}

# Display a styled header
gum_header() {
    local title="$1"
    local subtitle="$2"
    gum style \
        --foreground 212 --border-foreground 212 --border double \
        --align center --width 60 --margin "1 2" --padding "1 4" \
        "$title" "$subtitle"
}

# Display a section with items
gum_section() {
    local section_name="$1"
    local items="$2"
    gum style --foreground 212 --bold "$section_name"
    echo "$items" | tr ' ' '\n' | gum style --foreground 99 --padding "0 2"
}

# Confirm action (returns 0 if yes, 1 if no)
gum_confirm() {
    local message="$1"
    gum confirm "$message"
}

# Show spinner during long operation
gum_spin() {
    local title="$1"
    shift
    gum spin --spinner dot --title "$title" -- "$@"
}

# Prompt for input
gum_input() {
    local placeholder="$1"
    local prompt="${2:-> }"
    gum input --placeholder "$placeholder" --prompt "$prompt"
}

# Choose from list
gum_choose() {
    local prompt="$1"
    shift
    gum choose --header "$prompt" "$@"
}

# Styled status messages
gum_info() {
    gum style --foreground 212 "$(printf "$BLUE$1$NC")"
}

gum_success() {
    gum style --foreground 212 "$(printf "$GREEN✓ $1$NC")"
}

gum_warning() {
    gum style --foreground 214 "$(printf "$YELLOW⚠ $1$NC")"
}

gum_error() {
    gum style --foreground 196 "$(printf "$RED✗ $1$NC")"
}

# Progress indicator for multi-step operations
gum_progress() {
    local current="$1"
    local total="$2"
    local message="$3"
    gum style --foreground 212 "[$current/$total] $message"
}
```

**Usage in recipes (.just/db.just):**
```just
# .just/db.just
# Database operations

# Reset database (delete and recreate)
db-reset:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh

    if gum_confirm "⚠ This will delete all data. Continue?"; then
        gum_info "Resetting database..."
        rm -f {{BACKEND_DIR}}/wallet.db
        just db-init
        just db-seed
        gum_success "Database reset complete"
    else
        gum_warning "Cancelled"
        exit 1
    fi

# Create new database migration
db-migrate:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh

    msg=$(gum_input "Migration message" "Description: ")
    if [ -z "$msg" ]; then
        gum_error "Migration message required"
        exit 1
    fi

    gum_spin "Creating migration: $msg" \
        bash -c "cd {{BACKEND_DIR}} && uv run alembic revision --autogenerate -m '$msg'"
    gum_success "Migration created"
```

**Inline gum (simple cases):**
```just
# .just/dev.just
# Start frontend with pseudo-locale option

frontend:
    #!/usr/bin/env bash
    if [ "$ENABLE_PSEUDO" = "true" ]; then
        echo "{{BLUE}}Regenerating pseudo-locale...{{NC}}"
        cd {{FRONTEND_DIR}} && node scripts/generate-pseudo-locale.mjs
    fi
    echo "{{BLUE}}Starting frontend server...{{NC}}"
    cd {{FRONTEND_DIR}} && npm run dev
```

### Pattern 4: Docker Compose Integration — Wrapper Recipes

**What:** Just recipes wrap `docker compose` commands with consistent flags and environment variables; use gum for feedback.

**When:** Docker workflows need environment selection (dev vs demo), build options, or health checks.

**Example (.just/docker.just):**
```just
# .just/docker.just
# Docker operations

# Docker compose files
COMPOSE_DEV := 'docker compose -f docker-compose.dev.yaml'
COMPOSE_DEMO := 'docker compose -f docker-compose.demo.yaml'

# Build and start Docker container (dev)
docker: docker-build docker-up

# Build Docker image from source
docker-build:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh
    gum_spin "Building Docker image from source" {{COMPOSE_DEV}} build
    gum_success "Docker image built"

# Build Docker image (no cache)
docker-build-force:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh
    gum_spin "Building Docker image (no cache)" {{COMPOSE_DEV}} build --no-cache
    gum_success "Docker image built"

# Build and start Docker with pseudo locale
docker-with-pseudo:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh
    gum_info "Building with pseudo locale for i18n QA..."
    ENABLE_PSEUDO=true {{COMPOSE_DEV}} build --no-cache
    just docker-up
    gum_success "Container started with pseudo locale"

# Start Docker container
docker-up:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh
    gum_info "Starting Docker container..."
    {{COMPOSE_DEV}} up -d
    gum_success "Container started"
    echo ""
    gum style --foreground 212 "Frontend: http://localhost:3000"
    gum style --foreground 212 "Backend:  http://localhost:3001"

# View Docker logs
docker-logs:
    {{COMPOSE_DEV}} logs -f

# Stop Docker container
docker-down:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh
    gum_info "Stopping Docker container..."
    {{COMPOSE_DEV}} down
    gum_success "Container stopped"

# Health check helper (internal)
_docker-health-check:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh
    gum_info "Waiting for services to start..."
    sleep 15

    # Health check backend
    for i in {1..10}; do
        if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
            gum_success "Backend is healthy"
            break
        fi
        echo "Backend attempt $i failed, retrying..."
        sleep 3
    done

    # Health check frontend
    for i in {1..10}; do
        if curl -sf http://localhost:3000 > /dev/null 2>&1; then
            gum_success "Frontend is healthy"
            exit 0
        fi
        echo "Frontend attempt $i failed, retrying..."
        sleep 3
    done

    gum_error "Health checks failed"
    {{COMPOSE_DEV}} logs
    exit 1
```

### Pattern 5: GitHub Actions Integration — Setup Actions + Just Recipes

**What:** Use dedicated setup actions (`extractions/setup-just`, `jdx/mise-action`) to install tools, then call `just` recipes instead of duplicating CI logic.

**When:** CI workflows need to mirror local dev environment exactly.

**Example (.github/workflows/ci.yaml, backend job):**
```yaml
backend:
  name: Backend Build & Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    # Install mise (manages python, uv, other tools)
    - uses: jdx/mise-action@v2
      with:
        install: true
        cache: true

    # Install just
    - uses: extractions/setup-just@v2
      with:
        just-version: '1.41'  # Or 'latest'

    # All build/test steps via just recipes
    - name: Install dependencies
      run: just install-backend

    - name: Lint
      run: just lint-backend

    - name: Type check
      run: just typecheck

    - name: Find dead code
      run: just vulture

    - name: Run tests
      run: just test-backend

    - name: Security audit
      run: just security-audit
```

**Example (.github/workflows/ci.yaml, e2e job):**
```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: jdx/mise-action@v2
      with:
        install: true
        cache: true

    - uses: extractions/setup-just@v2

    # Database setup
    - name: Initialize database
      run: just db-init

    - name: Seed database
      run: just db-seed

    # Install and run E2E tests
    - name: Install frontend dependencies
      run: just install-frontend

    - name: Install Playwright browsers
      run: just test-e2e-install

    - name: Run E2E tests
      run: just test-e2e
      env:
        CI: true
```

**Benefits:**
- Single source of truth for commands (justfile recipes)
- Local CI replication: `just test-backend` works identically in CI and dev
- Easier debugging: run exact CI commands locally
- Reduced workflow YAML duplication

**Fallback for gum in CI:**
Since gum is interactive, recipes should detect non-TTY environments and skip gum prompts:

```just
# .just/util.just
# Clean with confirmation (skips confirm in CI)

clean-all:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh

    # Skip confirmation in non-interactive environments
    if [ -t 0 ]; then
        if ! gum_confirm "⚠ Remove all dependencies and database?"; then
            gum_warning "Cancelled"
            exit 1
        fi
    fi

    gum_info "Cleaning all dependencies and database..."
    rm -rf {{BACKEND_DIR}}/.venv
    rm -rf {{FRONTEND_DIR}}/node_modules
    rm -f {{BACKEND_DIR}}/wallet.db
    gum_success "All cleaned"
```

### Pattern 6: Devcontainer Integration — mise Bootstrap in postCreateCommand

**What:** Add mise to devcontainer features, run `mise install` in postCreateCommand to auto-setup tools on container creation.

**When:** Devcontainer must match local dev environment exactly (tool versions, env vars).

**Example (.devcontainer/devcontainer.json, updated):**
```json
{
  "name": "Maxwell's Wallet",
  "build": {
    "dockerfile": "Dockerfile",
    "context": ".."
  },
  "features": {
    "ghcr.io/jdx/mise/mise:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "ms-python.vscode-pylance",
        "charliermarsh.ruff",
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "ms-playwright.playwright",
        "tamasfe.even-better-toml",
        "usernamehw.errorlens",
        "skellock.just"
      ],
      "settings": {
        "python.defaultInterpreterPath": "/workspaces/maxwells-wallet/backend/.venv/bin/python",
        "python.terminal.activateEnvironment": true,
        "[python]": {
          "editor.defaultFormatter": "charliermarsh.ruff",
          "editor.formatOnSave": true,
          "editor.codeActionsOnSave": {
            "source.fixAll.ruff": "explicit",
            "source.organizeImports.ruff": "explicit"
          }
        },
        "[typescript]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode",
          "editor.formatOnSave": true
        },
        "[typescriptreact]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode",
          "editor.formatOnSave": true
        },
        "[javascript]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode",
          "editor.formatOnSave": true
        },
        "editor.tabSize": 2,
        "files.trimTrailingWhitespace": true,
        "files.insertFinalNewline": true
      }
    }
  },
  "forwardPorts": [3000, 3001],
  "portsAttributes": {
    "3000": {
      "label": "Frontend (Next.js)",
      "onAutoForward": "notify"
    },
    "3001": {
      "label": "Backend (FastAPI)",
      "onAutoForward": "notify"
    }
  },
  "postCreateCommand": "mise install && just install",
  "remoteUser": "vscode"
}
```

**Changes:**
- **Add mise feature**: `"ghcr.io/jdx/mise/mise:1": {}`
- **Add Just extension**: `"skellock.just"` for syntax highlighting
- **Update postCreateCommand**: `mise install && just install` (replaces direct `make setup` equivalent)
- **Remove Node/Python features**: mise manages these now (unless devcontainer needs fallback)

**Alternative (keep Node/Python features for fallback):**
If mise fails or users prefer manual control, keep Node/Python features:
```json
"features": {
  "ghcr.io/jdx/mise/mise:1": {},
  "ghcr.io/devcontainers/features/node:1": {
    "version": "24"
  },
  "ghcr.io/devcontainers/features/python:1": {
    "version": "3.11"
  },
  "ghcr.io/devcontainers/features/github-cli:1": {}
}
```

**Benefits:**
- Consistent tool versions across devcontainer, local dev, and CI
- Automatic setup on container creation (no manual install steps)
- .mise.toml is single source of truth

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Justfile
**What:** Putting all 77 recipes in a single root justfile.
**Why bad:** Hard to navigate, slow to load, difficult to maintain, loses domain organization.
**Instead:** Use modular .just/ directory with domain-specific files (dev.just, test.just, etc.), imported into root justfile.

### Anti-Pattern 2: Inline gum Everywhere
**What:** Repeating gum style/format/confirm commands in every recipe.
**Why bad:** Inconsistent UX, harder to refactor UI, verbose recipes.
**Instead:** Extract common patterns to scripts/gum-helpers.sh; use inline gum only for simple one-off cases.

### Anti-Pattern 3: Hardcoded Tool Paths
**What:** Calling `/usr/local/bin/python3` or `~/.nvm/versions/node/v22/bin/node` directly.
**Why bad:** Breaks portability, ignores mise-managed versions.
**Instead:** Use bare tool names (`python`, `node`, `uv`) and rely on mise to inject correct PATH.

### Anti-Pattern 4: Duplicating CI Logic
**What:** Writing bash scripts directly in GitHub Actions YAML that duplicate justfile recipes.
**Why bad:** Commands drift between local and CI, harder to debug locally.
**Instead:** Call `just <recipe>` from CI; keep all logic in justfile.

### Anti-Pattern 5: Secrets in mise.toml
**What:** Putting CROWDIN_PERSONAL_TOKEN, ANTHROPIC_API_KEY directly in .mise.toml.
**Why bad:** mise.toml is committed to git; secrets would leak.
**Instead:** Use `[env] _.file = '.env'` to load secrets from gitignored .env file.

### Anti-Pattern 6: mise Tasks for Complex Workflows
**What:** Using mise tasks feature for 77-recipe build system.
**Why bad:** mise tasks are newer, less mature than just; lack import/module support; community resources favor just for complex task running.
**Instead:** Use just for task orchestration (primary interface); reserve mise tasks for quick one-liner helpers if needed.

## Data Flow Changes

### Before (Make)

```
Developer
  ↓
  make <target>
  ↓
  Makefile (111 lines)
  ↓
  include make/*.mk (706 lines total)
  ↓
  export BLUE GREEN YELLOW RED NC BACKEND_DIR FRONTEND_DIR
  ↓
  Direct tool invocation:
    - cd backend && uv run ...
    - cd frontend && npm run ...
    - docker compose -f ...
  ↓
  .envrc (direnv) loads secrets
  ↓
  Manual .nvmrc check (make check-node)
```

### After (Just + gum + mise)

```
Developer
  ↓
  just <recipe>
  ↓
  justfile (root, ~50 lines)
  ↓
  import .just/*.just (~700 lines total)
  ↓
  export BLUE GREEN YELLOW RED NC BACKEND_DIR FRONTEND_DIR
  ↓
  source scripts/gum-helpers.sh (when needed)
  ↓
  Tool invocation via mise-managed PATH:
    - cd backend && uv run ...  (uv from mise)
    - cd frontend && npm run ... (node/npm from mise)
    - docker compose -f ...
    - gum confirm/spin/input ... (gum from mise)
  ↓
  .envrc (direnv) → use mise
  ↓
  mise:
    - Reads .mise.toml [tools] → installs just, gum, node, python, uv
    - Reads .mise.toml [env] → loads .env file
    - Injects PATH and env vars
  ↓
  No manual version checks (mise auto-enforces)
```

**Key differences:**
- **Tool management**: Manual (.nvmrc, .python-version, check-deps) → Automatic (mise)
- **Environment**: direnv exports secrets → direnv loads mise → mise loads .env
- **UX**: Plain echo/printf → gum (styled, interactive)
- **CI**: Bash scripts in YAML → `just <recipe>` calls
- **Modularity**: 7 .mk files → 7 .just files (same organization)

## New Components (Created)

| Component | Purpose | Location |
|-----------|---------|----------|
| **justfile** | Root recipe orchestration; imports all modules | `/justfile` |
| **.just/dev.just** | Development server recipes | `/.just/dev.just` |
| **.just/test.just** | Testing recipes | `/.just/test.just` |
| **.just/db.just** | Database recipes | `/.just/db.just` |
| **.just/docker.just** | Docker recipes | `/.just/docker.just` |
| **.just/i18n.just** | Translation recipes | `/.just/i18n.just` |
| **.just/release.just** | Release recipes | `/.just/release.just` |
| **.just/util.just** | Utility recipes | `/.just/util.just` |
| **scripts/gum-helpers.sh** | Shared gum UI functions | `/scripts/gum-helpers.sh` |
| **.mise.toml** | Tool versions and env config | `/.mise.toml` |
| **.env** | Secrets (gitignored) | `/.env` |

## Modified Components (Updated)

| Component | Change | Location |
|-----------|--------|----------|
| **.envrc** | Add `use mise` directive; move secrets to .env | `/.envrc` |
| **.devcontainer/devcontainer.json** | Add mise feature; update postCreateCommand; add Just extension | `/.devcontainer/devcontainer.json` |
| **.github/workflows/ci.yaml** | Add mise-action and setup-just steps; replace bash with `just <recipe>` | `/.github/workflows/ci.yaml` |
| **.github/workflows/*.yaml** | Same changes across all workflows (nightly, e2e, release, etc.) | `/.github/workflows/` |
| **.gitignore** | Add `.env` (secrets), `.mise.local.toml` (local overrides) | `/.gitignore` |
| **CLAUDE.md** | Update development commands section to reference `just` instead of `make` | `/CLAUDE.md` |
| **README.md** | Update setup/usage instructions; replace `make` with `just` | `/README.md` |

## Removed Components (Deprecated)

| Component | Reason | Location |
|-----------|--------|----------|
| **Makefile** | Replaced by justfile | `/Makefile` |
| **make/*.mk** | Replaced by .just/*.just | `/make/` |
| **.nvmrc** | Replaced by .mise.toml [tools] node | `/.nvmrc` |
| **backend/.python-version** | Replaced by .mise.toml [tools] python (if exists) | `/backend/.python-version` |
| **make check-node target** | Replaced by mise auto-enforcement | N/A |

## Suggested Build Order for Migration

### Phase 1: Foundation (mise + .env)
**Goal:** Establish tool version management and environment handling without changing task system.

1. **Create .mise.toml** with tool versions (just, gum, node, python, uv) and env config
2. **Create .env** (gitignored) with secrets from .envrc
3. **Update .envrc** to `use mise` and remove direct secret exports
4. **Update .gitignore** to exclude .env and .mise.local.toml
5. **Test**: `cd` into repo → mise auto-installs tools → verify `just --version`, `gum --version`, `node --version`
6. **Validation**: All tools available via mise; secrets loaded; no version conflicts

**Dependencies:** None
**Risk:** Low (additive; Makefile still works)
**Rollback:** Remove mise.toml, restore .envrc

### Phase 2: Shared Helpers (gum infrastructure)
**Goal:** Create reusable gum UI components before converting recipes.

1. **Create scripts/gum-helpers.sh** with functions: gum_header, gum_section, gum_confirm, gum_spin, gum_input, gum_info, gum_success, gum_warning, gum_error, gum_progress
2. **Add color variable fallbacks** in gum-helpers.sh (use justfile exports or defaults)
3. **Test**: `source scripts/gum-helpers.sh && gum_confirm "Test?"` → interactive prompt
4. **Validation**: All helper functions work; gum binary available via mise

**Dependencies:** Phase 1 (mise provides gum)
**Risk:** Low (no integration yet)
**Rollback:** Delete gum-helpers.sh

### Phase 3: Utilities Module (low-risk conversion)
**Goal:** Convert simplest recipes first to validate patterns.

1. **Create .just/util.just** with recipes: clean, clean-all, status, info, check-deps (deprecated note)
2. **Create root justfile** with minimal structure: imports, exports, default, help
3. **Implement help recipe** using gum_header/gum_section from helpers
4. **Test**: `just clean`, `just status`, `just help` → verify output matches `make` equivalents
5. **Validation**: Recipes work; gum UI renders; help categorization correct

**Dependencies:** Phase 2 (gum-helpers.sh)
**Risk:** Low (utilities don't affect core workflows)
**Rollback:** Delete justfile, .just/util.just

### Phase 4: Core Workflows (dev, db, test)
**Goal:** Convert critical development recipes.

1. **Create .just/dev.just**: backend, frontend, dev, build-frontend
2. **Create .just/db.just**: db-init, db-seed, db-reset, db-migrate (use gum_confirm, gum_input), db-upgrade
3. **Create .just/test.just**: test-backend, test-unit, test-coverage, test-e2e, lint, lint-backend, lint-frontend, typecheck, quality, security-audit
4. **Update root justfile** to import dev.just, db.just, test.just
5. **Test**: `just dev` (servers start), `just test-backend` (tests run), `just db-reset` (confirm dialog works)
6. **Validation**: Development workflow fully functional; parallel dev server startup works (just -j2 or forking)

**Dependencies:** Phase 3 (justfile structure)
**Risk:** Medium (affects daily development)
**Rollback:** Use `make` for core workflows; defer justfile adoption

### Phase 5: Specialized Workflows (docker, i18n, release)
**Goal:** Convert remaining domain-specific recipes.

1. **Create .just/docker.just**: all docker-* recipes with COMPOSE_DEV/COMPOSE_DEMO variables; use gum_spin for builds
2. **Create .just/i18n.just**: all translate-* recipes; use gum for CROWDIN_PROJECT_ID prompts if needed
3. **Create .just/release.just**: release recipes with gum_confirm for destructive actions
4. **Update root justfile** to import docker.just, i18n.just, release.just
5. **Test**: `just docker-build`, `just translate-upload`, release recipe (if applicable)
6. **Validation**: All workflows functional; gum UX consistent

**Dependencies:** Phase 4 (core workflows stable)
**Risk:** Low-Medium (specialized, less frequent use)
**Rollback:** Use `make` for specialized tasks

### Phase 6: CI Integration
**Goal:** Update GitHub Actions to use just + mise.

1. **Update .github/workflows/ci.yaml**:
   - Add `jdx/mise-action@v2` step
   - Add `extractions/setup-just@v2` step
   - Replace bash commands with `just <recipe>` calls
2. **Update other workflows**: nightly.yaml, nightly-e2e.yaml, release.yaml, etc.
3. **Test**: Push to feature branch → verify CI passes with just recipes
4. **Add CI detection** in recipes that use gum (skip interactive prompts if not TTY)
5. **Validation**: CI green; commands match local exactly

**Dependencies:** Phase 5 (all recipes converted)
**Risk:** Medium (CI must stay green)
**Rollback:** Revert workflow files; CI uses make temporarily

### Phase 7: Devcontainer + Documentation
**Goal:** Update devcontainer and user-facing docs.

1. **Update .devcontainer/devcontainer.json**:
   - Add mise feature
   - Add Just VSCode extension
   - Update postCreateCommand to `mise install && just install`
2. **Update CLAUDE.md**: Replace `make` commands with `just` equivalents
3. **Update README.md**: Update setup instructions, quick start, development commands
4. **Test**: Rebuild devcontainer → verify tools auto-install; `just dev` works
5. **Validation**: Devcontainer matches local; docs accurate

**Dependencies:** Phase 6 (CI stable)
**Risk:** Low (documentation-focused)
**Rollback:** Revert docs; note both systems supported temporarily

### Phase 8: Cleanup
**Goal:** Remove deprecated Make files once adoption is complete.

1. **Archive Makefile and make/*.mk** to `archive/` directory (or commit history)
2. **Remove .nvmrc** (replaced by mise.toml)
3. **Remove backend/.python-version** if it exists
4. **Update .gitignore** to ignore archived files
5. **Validation**: Repository clean; no references to old Make system

**Dependencies:** Phase 7 (docs updated)
**Risk:** Low (can restore from git history)
**Rollback:** Restore from archive/

## Phase Dependency Graph

```
Phase 1 (mise + .env)
  ↓
Phase 2 (gum-helpers.sh)
  ↓
Phase 3 (util.just + root justfile)
  ↓
Phase 4 (dev.just, db.just, test.just) ← Critical path
  ↓
Phase 5 (docker.just, i18n.just, release.just)
  ↓
Phase 6 (CI integration)
  ↓
Phase 7 (devcontainer + docs)
  ↓
Phase 8 (cleanup)
```

**Parallel opportunities:**
- Phases 1-2 can overlap if gum-helpers.sh doesn't rely on mise-managed gum (can test with manual install)
- Phases 4-5 modules (dev, db, test, docker, i18n, release) can be developed in parallel branches, merged sequentially

**Critical checkpoint:** Phase 4 completion. If core workflows (dev, test, db) work via just, migration is de-risked.

## Integration Points Summary

| Integration | Mechanism | Notes |
|-------------|-----------|-------|
| **justfile ↔ mise** | Bare tool names in recipes; mise provides PATH | Recipes call `node`, `python`, `uv`, `gum`; mise ensures correct versions |
| **justfile ↔ gum** | Source scripts/gum-helpers.sh or inline calls | Recipes import helpers for consistent UX |
| **justfile ↔ docker compose** | COMPOSE_DEV/COMPOSE_DEMO variables | Recipes wrap compose commands with gum feedback |
| **mise ↔ direnv** | .envrc contains `use mise` | Auto-activates on cd; loads tools + env vars |
| **mise ↔ .env** | .mise.toml [env] _.file = '.env' | Secrets loaded from gitignored file |
| **CI ↔ mise** | jdx/mise-action@v2 installs tools | CI mirrors local tool versions |
| **CI ↔ just** | extractions/setup-just@v2 + `just <recipe>` calls | CI uses same commands as local dev |
| **devcontainer ↔ mise** | mise feature + postCreateCommand runs mise install | Auto-setup on container creation |

## Sources

- [Just command runner (GitHub)](https://github.com/casey/just)
- [Just Programmer's Manual](https://just.systems/man/en/)
- [Just Shared Tooling Guide](https://www.stuartellis.name/articles/just-task-runner/)
- [mise dev tools documentation](https://mise.jdx.dev/dev-tools/)
- [mise configuration reference](https://mise.jdx.dev/configuration.html)
- [How to Use mise for Tool Version Management (2026)](https://oneuptime.com/blog/post/2026-01-25-mise-tool-version-management/view)
- [Charmbracelet gum GitHub](https://github.com/charmbracelet/gum)
- [Enhancing Shell Scripts with Charmbracelet Gum (2026)](https://medium.com/@jignyasamishra/enhancing-shell-scripts-with-charmbracelet-gum-a-practical-guide-b9a534e3caf4)
- [Setup just GitHub Action](https://github.com/marketplace/actions/setup-just)
- [Dev Container Build and Run Action](https://github.com/marketplace/actions/dev-container-build-and-run-action)
- [mise vs just comparison (Hacker News, 2024)](https://news.ycombinator.com/item?id=42353634)
- [Justfile Functions reference](https://just.systems/man/en/functions.html)
- [mise tasks documentation](https://mise.jdx.dev/tasks/)
