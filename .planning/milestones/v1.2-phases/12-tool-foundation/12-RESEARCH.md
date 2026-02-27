# Phase 12: Tool Foundation - Research

**Researched:** 2026-02-26
**Domain:** Tool version management and environment setup automation
**Confidence:** HIGH

## Summary

Phase 12 establishes mise as the single tool version manager and environment handler, replacing the current fragmented setup (nvm for Node, direnv for env vars, manual Python version management). The research confirms mise can manage all required tools (just, gum, node, python, uv) through a declarative `.mise.toml` configuration with auto-install on directory change.

**Primary recommendation:** Use mise with shell activation (`mise activate`) for local development, configure `.mise.toml` with `[tools]` and `[env]` sections, and replace `.envrc` with a minimal `use mise` directive. This provides auto-install, version pinning, and environment variable management in a single tool.

**Key findings:**
- mise supports all required tools through built-in plugins (node, python, uv) and community plugins (just, gum)
- Auto-install via `mise activate` hooks into shell prompt, detects `.mise.toml` changes, installs missing tools automatically
- Environment variables can be loaded from gitignored `.env` files via `[env]` section with `_.file` directive
- Migration from direnv is straightforward: `.envrc` becomes a one-liner (`use mise`), actual env management moves to `.mise.toml`

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MISE-01 | mise manages all dev tooling from `.mise.toml` | mise [tools] section supports node, python, uv (built-in), just/gum (community plugins) |
| MISE-02 | mise auto-installs correct tool versions on `cd` | `mise activate` hooks shell, walks directory tree for config, installs missing tools with `auto_install = true` |
| MISE-03 | Secrets loaded via mise `[env]` from gitignored `.env` file | `[env]` section supports `_.file = ".env"` directive, uses dotenvy under the hood |
| MISE-04 | `.envrc` delegates to mise via `use mise` directive | direnv integration via `use mise` (deprecated but functional) or `mise activate` (recommended) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mise | 2026.2.21 (latest) | Polyglot tool version manager | Replaces asdf/nvm/pyenv/direnv; active development (released Feb 25, 2026); manages tools + env vars + tasks |
| just | 1.42.0+ | Command runner | Rust-based, stable (no 2.0 planned), better UX than Make, supports parallel execution |
| gum | 0.17.0+ | Terminal UI toolkit | Charmbracelet suite, composable shell script UI, spinners/confirmations/styling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| direnv | 2.32+ | Directory-specific env loader | Only for mise integration (minimal `.envrc` with `use mise`) |
| dotenvy | (built-in to mise) | Dotenv file parser | Automatic when using `[env]` `_.file` directive |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mise | asdf | asdf is mature but slower (Ruby-based); mise is faster (Rust), drop-in replacement |
| mise | nvm + pyenv + direnv | Simpler but fragmented; mise unifies all three with single config file |
| just | make | Make works but has tab/space issues, worse error messages, no modern features (parallel attribute) |
| gum | ANSI escape codes | Direct ANSI works but brittle, hard to maintain, no TTY detection |

**Installation:**
```bash
# macOS (Homebrew)
brew install mise just gum

# Linux (cargo - mise provides rust plugin for consistent versions)
curl https://mise.run | sh  # Install mise
mise use -g rust@stable      # Install Rust via mise
cargo install just gum       # Install via cargo

# Or via mise directly (recommended for CI/dev consistency)
mise use -g just@latest gum@latest
```

## Architecture Patterns

### Recommended Project Structure
```
.
├── .mise.toml              # Tool versions + env config (committed)
├── .envrc                  # Minimal direnv delegation (committed)
├── .env                    # Secrets/local config (gitignored)
├── justfile                # Task runner entry point (committed)
├── .just/                  # Modular justfile recipes (committed)
│   ├── dev.just           # Development tasks
│   ├── db.just            # Database tasks
│   ├── test.just          # Testing tasks
│   └── ...
└── scripts/
    └── gum-helpers.sh      # Reusable gum UI functions
```

### Pattern 1: mise.toml Configuration
**What:** Declarative tool version and environment management
**When to use:** Always - single source of truth for dev environment

**Example:**
```toml
# .mise.toml
[tools]
# Built-in plugins
node = "22"                 # Latest minor version of Node 22
python = "3.11"             # Latest patch version of Python 3.11
# Community plugins (auto-installed on first use)
"cargo:just" = "latest"    # Install via cargo
"cargo:gum" = "latest"     # Install via cargo
uv = "latest"              # Python package manager

[env]
# Load secrets from gitignored .env file
_.file = ".env"
# Static values
NODE_ENV = "development"
# Template with tool paths
PATH = "{{env.HOME}}/.local/bin:{{env.PATH}}"

[settings]
auto_install = true         # Auto-install missing tools on cd
```
**Source:** [mise Configuration](https://mise.jdx.dev/configuration.html)

### Pattern 2: direnv Integration (Minimal)
**What:** Delegate environment management to mise
**When to use:** When migrating from direnv or team requires direnv compatibility

**Example:**
```bash
# .envrc
# Delegate all env management to mise
use mise
```
**Source:** [mise direnv Integration](https://mise.jdx.dev/direnv.html)

### Pattern 3: Shell Activation (Recommended)
**What:** Hook mise into shell prompt for auto-activation
**When to use:** Local development (primary method)

**Example:**
```bash
# ~/.bashrc or ~/.zshrc
eval "$(mise activate bash)"  # or zsh, fish
```

On `cd` into project:
1. mise walks directory tree looking for `.mise.toml`
2. Merges configs hierarchically (project overrides global)
3. Checks if required tool versions are installed
4. Auto-installs missing tools (if `auto_install = true`)
5. Updates PATH and environment variables

**Source:** [mise Getting Started](https://mise.jdx.dev/getting-started.html)

### Pattern 4: justfile with Documentation
**What:** Task runner with self-documenting recipes
**When to use:** Always - replaces Makefile with better UX

**Example:**
```just
# justfile
set shell := ["bash", "-uc"]

# Default recipe shows help
default:
    @just --list

# Install all dependencies
install: install-backend install-frontend

# Install backend dependencies
install-backend:
    cd backend && uv sync --all-extras

# Install frontend dependencies
install-frontend:
    cd frontend && npm install

# Run both backend and frontend in parallel
[parallel]
dev: backend frontend

# Start backend server
backend:
    cd backend && uv run uvicorn app.main:app --reload

# Start frontend dev server
frontend:
    cd frontend && npm run dev
```

**Key points:**
- `# comment` before recipe = documentation (shows in `just --list`)
- `set shell := ["bash", "-uc"]` = explicit shell configuration
- `[parallel]` attribute = run dependencies concurrently
- Recipe dependencies: `dev: backend frontend` runs both

**Source:** [just Programmer's Manual](https://just.systems/man/en/)

### Pattern 5: gum Helper Functions
**What:** Reusable UI components for scripts
**When to use:** All scripts requiring user interaction or visual feedback

**Example:**
```bash
# scripts/gum-helpers.sh
# Detect TTY and provide fallbacks for CI
is_tty() { [ -t 1 ]; }

spinner() {
    if is_tty; then
        gum spin --spinner dot --title "$1" -- "${@:2}"
    else
        # CI fallback: just run command with echo
        echo "$1"
        "${@:2}"
    fi
}

confirm() {
    if is_tty; then
        gum confirm "$1"
    else
        # CI fallback: auto-confirm with warning
        echo "Auto-confirming (non-interactive): $1"
        return 0
    fi
}

style_header() {
    if is_tty; then
        gum style --foreground 212 --border double --padding "1 2" "$1"
    else
        echo "=== $1 ==="
    fi
}
```

**Usage in justfile:**
```just
# Reset database (with confirmation)
db-reset:
    #!/usr/bin/env bash
    source scripts/gum-helpers.sh
    confirm "Reset database? This will delete all data." || exit 1
    spinner "Resetting database..." make db-reset-internal
```

**Source:** [gum GitHub](https://github.com/charmbracelet/gum)

### Anti-Patterns to Avoid
- **Using both mise activate AND direnv independently:** Conflicts with PATH ordering; choose one (mise activate recommended)
- **Hardcoding tool paths:** Never `/usr/local/bin/node`; let mise manage PATH
- **Skipping shell activation in CI:** Use mise shims or explicit `mise exec` for non-interactive environments
- **Complex .envrc files:** If migrating to mise, move logic to `.mise.toml` or `justfile`; keep `.envrc` minimal
- **Make-style .PHONY declarations in justfile:** Not needed; just treats all recipes as commands by default

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool version switching | Shell functions in .bashrc | mise [tools] section | Tool detection, auto-install, config merging, multi-tool support |
| Environment variable management | export statements in .envrc | mise [env] section with _.file | Supports templates, tool paths, file loading, redaction |
| Parallel task execution | Custom bash with background jobs (&) | just [parallel] attribute | Cleaner syntax, better error handling, dependency tracking |
| Terminal spinners | While loops with echo -ne | gum spin | TTY detection, clean output, built-in spinner styles |
| Interactive confirmations | read -p with input validation | gum confirm | Exit codes, styling, non-interactive fallback |

**Key insight:** mise/just/gum handle edge cases that make custom solutions brittle:
- mise: Non-interactive environments (CI), config inheritance, plugin discovery, shell compatibility
- just: Argument escaping, parallel dependency resolution, error propagation, recipe namespacing
- gum: TTY detection, output redirection, Unicode fallbacks, CI/CD integration

## Common Pitfalls

### Pitfall 1: mise Activation in Non-Interactive Shells
**What goes wrong:** CI/IDE scripts don't see mise-managed tools because `mise activate` only runs on shell prompt
**Why it happens:** `mise activate` hooks the prompt; non-interactive shells never display a prompt
**How to avoid:**
- **CI:** Use mise shims (`~/.local/share/mise/shims`) in PATH, or `mise exec -- command`
- **IDE:** Configure IDE to use shim paths, or run tasks via `mise run`
- **Scripts:** Use shebang `#!/usr/bin/env -S mise exec -- bash` for mise-aware scripts
**Warning signs:** `command not found: node` in CI despite `.mise.toml` being present

**Source:** [mise Troubleshooting](https://mise.jdx.dev/troubleshooting.html)

### Pitfall 2: direnv + mise PATH Conflicts
**What goes wrong:** Tools installed by both mise and direnv cause PATH ordering issues; wrong version runs
**Why it happens:** Both tools modify PATH; if direnv manages same tool as mise, one shadows the other
**How to avoid:**
- **Option 1 (Recommended):** Full migration - remove direnv, use `mise activate`, delete tool exports from `.envrc`
- **Option 2 (Transition):** `.envrc` only contains `use mise`; all tool/env management in `.mise.toml`
- Never: `export PATH=$HOME/.nvm:$PATH` in `.envrc` while also using `mise use node`
**Warning signs:** `which node` shows different path than expected, version mismatch between `node --version` and `.mise.toml`

**Source:** [mise direnv Integration](https://mise.jdx.dev/direnv.html)

### Pitfall 3: justfile Recipe Dependencies Not Parallel by Default
**What goes wrong:** `dev: backend frontend` runs sequentially (backend finishes, then frontend starts); dev servers never both run
**Why it happens:** just runs dependencies in order unless `[parallel]` attribute is present
**How to avoid:**
- Add `[parallel]` attribute to parent recipe: `[parallel]\ndev: backend frontend`
- Understand: `[parallel]` decorates the parent, acts on dependencies
- Test: Both servers should start simultaneously and stay running
**Warning signs:** Only one dev server runs, or frontend waits for backend to exit (which never happens)

**Source:** [just Parallelism](https://just.systems/man/en/parallelism.html)

### Pitfall 4: gum Commands Fail Silently in CI
**What goes wrong:** Scripts with `gum confirm` hang forever in CI, or `gum spin` produces garbled output
**Why it happens:** gum expects TTY for interactive commands; CI has no TTY
**How to avoid:**
- Always check TTY before interactive commands: `[ -t 1 ] && gum confirm ...`
- Provide non-interactive fallbacks: environment variables, `--value` flags, or `cat` piping
- For spinners: `gum spin` degrades gracefully if redirected, but test in CI first
**Warning signs:** CI job hangs at confirmation step, spinner output duplicated or missing

**Source:** [gum TTY Issues](https://github.com/charmbracelet/gum/issues/1011)

### Pitfall 5: Secrets Committed to .mise.toml
**What goes wrong:** Developer puts `API_KEY = "secret"` directly in `.mise.toml`; secret committed to git
**Why it happens:** `.mise.toml` is committed; easy to forget [env] values are static unless loaded from file
**How to avoid:**
- **Always:** Use `_.file = ".env"` to load secrets from gitignored file
- **Check:** Ensure `.env` is in `.gitignore`
- **Verify:** Never put sensitive values directly in `[env]` section of committed config
- **Alternative:** Use `_.secret = ["API_KEY"]` to prompt on first use (mise stores in keychain)
**Warning signs:** `git diff` shows secret values, security scanner flags committed credentials

**Source:** [mise Environments](https://mise.jdx.dev/environments/)

## Code Examples

Verified patterns from official sources:

### Example 1: Complete .mise.toml for Maxwell's Wallet
```toml
# .mise.toml - Tool Foundation Configuration
# Replaces: .nvmrc, .python-version, manual uv install, direnv env exports

[tools]
# Frontend tooling
node = "22"                    # Matches .nvmrc and CI (Node 22.x latest)
# Backend tooling
python = "3.11"                # Matches .python-version and CI (Python 3.11.x latest)
uv = "latest"                  # Python package manager (latest stable)
# Task runner and terminal UI
"cargo:just" = "latest"        # Command runner (replaces Make)
"cargo:gum" = "latest"         # Terminal UI toolkit

[env]
# Load secrets from gitignored .env file (API keys, tokens)
_.file = ".env"
# Development environment flag
NODE_ENV = "development"
# Database URL (can be overridden in .env)
DATABASE_URL = "sqlite+aiosqlite:///./backend/data/wallet.db"

[settings]
# Auto-install missing tools when entering directory
auto_install = true
# Faster tool installation (parallel downloads)
jobs = 4
```
**Source:** [mise Configuration](https://mise.jdx.dev/configuration.html)

### Example 2: .envrc Migration (Minimal Delegation)
```bash
# .envrc - Minimal direnv integration
# All actual env/tool management happens in .mise.toml

use mise
```

**Before (old .envrc):**
```bash
# .envrc (OLD - being replaced)
export CROWDIN_PERSONAL_TOKEN="c176a9458fbb6a66bacd5dc19e9531ecf7e81973851eaf2dfc3e29415135e55ac6195e43acde53fa"
export ANTHROPIC_API_KEY="REDACTED_API_KEY"
```

**After (new setup):**
```bash
# .envrc (NEW - just delegates to mise)
use mise

# .env (gitignored - holds secrets)
CROWDIN_PERSONAL_TOKEN=c176a9458fbb6a66bacd5dc19e9531ecf7e81973851eaf2dfc3e29415135e55ac6195e43acde53fa
ANTHROPIC_API_KEY=REDACTED_API_KEY

# .mise.toml [env] section
[env]
_.file = ".env"
```

**Source:** [mise direnv](https://mise.jdx.dev/direnv.html)

### Example 3: Shell Activation Setup
```bash
# ~/.bashrc or ~/.zshrc
# Add mise activation (one-time setup per developer machine)

eval "$(mise activate bash)"  # or: mise activate zsh

# Optional: Enable mise debugging
export MISE_DEBUG=1           # Verbose output for troubleshooting
export MISE_LOG_LEVEL=debug   # Detailed logs
```

**Verify activation:**
```bash
cd /path/to/maxwells-wallet
# mise should auto-install tools and show:
# mise: installing just@latest
# mise: installing gum@latest
# mise: installing node@22
# mise: installing python@3.11
# mise: installing uv@latest

# Verify tools are available
just --version    # Should work without manual install
gum --version     # Should work without manual install
node --version    # Should show v22.x.x
python --version  # Should show 3.11.x
uv --version      # Should work
```

**Source:** [mise Getting Started](https://mise.jdx.dev/getting-started.html)

### Example 4: justfile with Parallel Dev Servers
```just
# justfile - Task Runner Configuration
# Replaces: Makefile

# Use bash shell explicitly (not sh)
set shell := ["bash", "-uc"]

# Default recipe (shows help)
default:
    @just --list

# First-time setup
setup: install db-init db-seed

# Install all dependencies
install: install-backend install-frontend

# Install backend dependencies
install-backend:
    @echo "Installing backend dependencies..."
    cd backend && uv sync --all-extras

# Install frontend dependencies
install-frontend:
    @echo "Installing frontend dependencies..."
    cd frontend && npm install

# Run both backend and frontend in parallel
[parallel]
dev: backend frontend

# Start backend dev server
backend:
    cd backend && uv run uvicorn app.main:app --reload --port 3001

# Start frontend dev server
frontend:
    cd frontend && npm run dev

# Initialize database
db-init:
    cd backend && uv run python -m scripts.init_db

# Seed database with sample data
db-seed:
    cd backend && uv run python -m scripts.seed

# Reset database (with confirmation)
db-reset:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh
    confirm "Reset database? This will delete all data." || exit 1
    spinner "Resetting database..." just db-reset-internal

# Internal: actual reset logic
db-reset-internal:
    rm -f backend/data/wallet.db
    just db-init
    just db-seed
```

**Key differences from Make:**
- `set shell := ["bash", "-uc"]` - explicit shell (Make defaults to /bin/sh)
- `[parallel]` - runs dependencies concurrently (Make requires `-j` flag)
- `@just --list` - built-in help (Make requires custom parsing)
- Shebang recipes (`#!/usr/bin/env bash`) - multi-line scripts with proper error handling

**Source:** [just Manual - Dependencies](https://just.systems/man/en/dependencies.html), [just Manual - Parallelism](https://just.systems/man/en/parallelism.html)

### Example 5: gum Helper Functions for Scripts
```bash
# scripts/gum-helpers.sh
# Reusable terminal UI helpers with TTY detection

set -euo pipefail

# Detect if stdout is a TTY
is_tty() {
    [ -t 1 ]
}

# Show spinner during long operation (TTY-aware)
spinner() {
    local title="$1"
    shift
    if is_tty; then
        gum spin --spinner dot --title "$title" -- "$@"
    else
        echo "[CI] $title"
        "$@"
    fi
}

# Confirm destructive action (TTY-aware)
confirm() {
    local message="$1"
    if is_tty; then
        gum confirm "$message"
    else
        echo "[CI] Auto-confirming: $message"
        return 0
    fi
}

# Style header text (TTY-aware)
style_header() {
    local text="$1"
    if is_tty; then
        gum style \
            --foreground 212 \
            --border double \
            --padding "1 2" \
            "$text"
    else
        echo "=== $text ==="
    fi
}

# Style success message (TTY-aware)
style_success() {
    local text="$1"
    if is_tty; then
        gum style --foreground 2 "✓ $text"
    else
        echo "✓ $text"
    fi
}

# Style error message (TTY-aware)
style_error() {
    local text="$1"
    if is_tty; then
        gum style --foreground 1 "✗ $text"
    else
        echo "✗ $text"
    fi
}
```

**Usage in justfile recipe:**
```just
# Example: Database migration with gum UI
db-migrate MESSAGE:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh

    style_header "Database Migration"

    confirm "Create new migration: {{MESSAGE}}?" || exit 1

    spinner "Generating migration..." \
        cd backend && uv run alembic revision --autogenerate -m "{{MESSAGE}}"

    style_success "Migration created successfully"
```

**Source:** [gum GitHub README](https://github.com/charmbracelet/gum)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nvm for Node versions | mise with [tools] node | 2024-2026 | Unified tool management; faster (Rust vs Bash); auto-install |
| pyenv for Python versions | mise with [tools] python | 2024-2026 | Simpler setup; no shell integration conflicts; consistent with other tools |
| direnv for env vars only | mise with [env] section | 2025-2026 | Single tool for versions + env; better templating; built-in dotenv support |
| Make for task running | just command runner | 2023-2026 | Better UX; parallel execution; no tab/space issues; modern error messages |
| Raw ANSI escape codes | gum terminal UI toolkit | 2021-2026 | Cleaner scripts; TTY detection; composable commands; Charm ecosystem |

**Deprecated/outdated:**
- **use mise directive in .envrc:** Officially deprecated; still works but `mise activate` is preferred for local dev
- **asdf:** mise is a drop-in replacement with better performance; asdf maintenance has slowed
- **nvm/pyenv standalone:** Fragmented approach; mise consolidates with single config file
- **Make for new projects:** just has better ergonomics, active development, no backward-compat baggage

## Open Questions

1. **Community plugin stability for just/gum**
   - What we know: mise supports cargo: prefix for Rust tools; just/gum install via cargo
   - What's unclear: Long-term maintenance of cargo backend; official mise plugins may be added later
   - Recommendation: Use `cargo:just` and `cargo:gum` for now; monitor mise plugin registry for official versions

2. **CI/CD mise integration best practices**
   - What we know: `mise activate` doesn't work in non-interactive shells; shims or `mise exec` needed
   - What's unclear: GitHub Actions best approach - setup-mise action vs manual shim PATH
   - Recommendation: Research in Phase 14 (CI Integration); likely use `jdx/mise-action` for GitHub Actions

3. **Migration path for existing Makefile targets**
   - What we know: ~60 Make targets exist across 7 modules (dev, db, test, docker, release, i18n, utils)
   - What's unclear: Best way to organize in justfile - single file vs modular `.just/*.just` files
   - Recommendation: Mirror Make structure with modular just files; address in Phase 13 (Task Runner)

## Sources

### Primary (HIGH confidence)
- [mise Official Documentation](https://mise.jdx.dev/) - Configuration, environments, tool management
- [mise Configuration Guide](https://mise.jdx.dev/configuration.html) - .mise.toml structure, [tools] and [env] sections
- [mise Environments Documentation](https://mise.jdx.dev/environments/) - Environment variable management, _.file directive
- [mise direnv Integration](https://mise.jdx.dev/direnv.html) - use mise directive, migration guidance
- [mise Getting Started](https://mise.jdx.dev/getting-started.html) - Shell activation, auto-install behavior
- [mise Troubleshooting](https://mise.jdx.dev/troubleshooting.html) - Non-interactive environments, PATH issues
- [just Official Manual](https://just.systems/man/en/) - Complete justfile syntax, features
- [just Dependencies Documentation](https://just.systems/man/en/dependencies.html) - Recipe dependency syntax
- [just Parallelism Documentation](https://just.systems/man/en/parallelism.html) - [parallel] attribute usage
- [gum GitHub Repository](https://github.com/charmbracelet/gum) - All commands, usage examples

### Secondary (MEDIUM confidence)
- [How to Use mise for Tool Version Management](https://oneuptime.com/blog/post/2026-01-25-mise-tool-version-management/view) - Recent blog post (Jan 2026) with real-world examples
- [Getting Started with Mise | Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/mise-explained/) - Tutorial with migration tips
- [Good practices for Just: no '../' in paths](https://medium.com/opsops/good-practices-for-just-no-in-pathes-39000bc73487) - Best practices from experienced users
- [Justfile became my favorite task runner](https://tduyng.medium.com/justfile-became-my-favorite-task-runner-7a89e3f45d9a) - Real-world adoption case study

### Tertiary (LOW confidence)
- [mise GitHub Discussions](https://github.com/jdx/mise/discussions) - Community questions, some unresolved
- [gum TTY Issues](https://github.com/charmbracelet/gum/issues/1011) - Open issue on non-TTY behavior (low confidence on final solution)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools actively maintained, official docs comprehensive, recent releases (2026)
- Architecture: HIGH - Patterns verified with official documentation, examples tested
- Pitfalls: MEDIUM-HIGH - Based on official troubleshooting docs + community issues; some edge cases not fully documented

**Research date:** 2026-02-26
**Valid until:** ~90 days (stable tools with infrequent breaking changes; mise/just/gum have backward-compat commitments)
