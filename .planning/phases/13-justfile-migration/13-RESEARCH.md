# Phase 13 Research: Justfile Migration

**Research Date:** 2026-02-26
**Phase:** 13 of 16 (Justfile Migration)
**Goal:** Convert all ~60 Make targets to just recipes with beautiful gum terminal UX

---

## Executive Summary

This phase migrates Maxwell's Wallet from GNU Make to just (command runner) with gum (terminal UI toolkit). The research confirms the migration is well-scoped, technically sound, and builds directly on Phase 12's mise foundation.

**Key Findings:**
- **83 documented Make targets** across 7 modules (~707 LOC total)
- **just + gum already installed** via mise (Phase 12 complete)
- **Modular structure exists** — maps cleanly to just's module system
- **CI impact minimal** — mise-action handles tool installation
- **Zero destructive changes** during migration — both systems run in parallel

---

## Current State Analysis

### Makefile Inventory

**Main Makefile:** `/Makefile` (111 lines)
- Entry point with shared variables (colors, directories)
- Help target with categorized output
- Includes 7 modular makefiles from `make/`

**Modular Structure:**
```
make/
├── dev.mk      (30 lines)  - backend, frontend, dev, build-frontend
├── db.mk       (50 lines)  - db-init, db-seed, db-reset, db-migrate, db-upgrade, demo-setup
├── test.mk     (191 lines) - test-backend, test-e2e, test-chaos, lint, quality, security
├── docker.mk   (91 lines)  - docker-build, docker-up, docker-down, docker-shell, docker-clean
├── release.mk  (145 lines) - release, release-patch, release-check, release-validate
├── i18n.mk     (88 lines)  - translate-upload, translate-download, translate-status, translate-harvest
└── utils.mk    (112 lines) - clean, clean-all, status, info, check-deps, data-*
```

**Total:** 83 documented targets (with `##` comments), 707 lines of Make code

**Target Categories (from `make help`):**
1. Setup & Install (5 targets)
2. Development (4 targets)
3. Database (6 targets)
4. Testing (20+ targets)
5. Docker (12 targets)
6. Release (6 targets)
7. i18n/Translation (8 targets)
8. Quality & Linting (7 targets)
9. Utilities (15 targets)

### Make Patterns Used

**Common Patterns:**
- Color output via ANSI escape codes (`\033[0;34m`, etc.)
- Interactive prompts (`read -p`)
- Directory navigation (`cd $(BACKEND_DIR) &&`)
- Parallel execution (`make -j2`)
- Conditional logic (shell if/else)
- Variable expansion (`$(CURRENT_VERSION)`)
- Multi-line recipes with `@` prefix (suppress echo)
- Dependency targets (`setup: install-backend install-frontend`)

**Destructive Actions Requiring Confirmation:**
- `db-reset` — deletes database
- `clean-all` — removes dependencies and database
- `docker-clean` — removes containers and volumes
- `release` — creates git tags and pushes to remote

---

## just Command Runner

### Overview

[just](https://github.com/casey/just) is a Rust-based command runner (not a build system) with Make-inspired syntax but simpler semantics.

**Key Advantages:**
- No `.PHONY` declarations needed (all recipes are commands by default)
- Accepts tabs or spaces (no tab hell)
- Built-in help via `just --list` (auto-generated from doc comments)
- Modules system for organizing large justfiles
- Multiple language support via shebang recipes
- Parameters with defaults
- No backward-incompatible changes (stable 1.x forever)

**Sources:**
- [GitHub - casey/just](https://github.com/casey/just)
- [Introduction - Just Programmer's Manual](https://just.systems/man/en/)
- [Just Command Runner Best Practices](https://www.chicks.net/reference/file_formats/just/)
- [Quick Start - Just Programmer's Manual](https://just.systems/man/en/quick-start.html)

### Syntax Translation

**Make → just Mapping:**

| Make Pattern | just Pattern |
|--------------|--------------|
| `target: deps ## Doc` | `# Doc`<br>`recipe deps:` |
| `$(VAR)` | `{{VAR}}` |
| `@command` | `@command` (same) |
| `export VAR=value` | `export VAR := "value"` |
| `.PHONY: target` | (not needed) |
| `make -j2 a b` | `just a b` (parallel by default for independent recipes) |
| `read -p "Message: " var` | `gum input --placeholder "Message"` |
| `if [ ... ]; then` | Same (shell code works as-is) |

**Variable Assignment:**
- just uses `:=` for everything (one way, simple)
- No recursive vs. simple assignment distinction

**Recipe Attributes:**
```just
# Don't change directory before running
[no-cd]
recipe:
    command

# Run dependencies in parallel
[parallel]
multi: dep1 dep2
```

### Module Organization

**Recommended Pattern (from research):**

```
justfile              # Root - imports modules, defines common variables
.just/
├── dev.just         # Development recipes
├── db.just          # Database recipes
├── test.just        # Testing recipes
├── docker.just      # Docker recipes
├── release.just     # Release recipes
├── i18n.just        # Internationalization recipes
└── utils.just       # Utility recipes
```

**Import Syntax:**
```just
# In root justfile
mod dev
mod db
mod test
mod docker
mod release
mod i18n
mod utils
```

**Calling Module Recipes:**
```bash
just dev::backend      # Run backend from dev module
just db::reset         # Run reset from db module
just --list            # Shows all recipes from all modules
```

**Sources:**
- [Imports - Just Programmer's Manual](https://just.systems/man/en/imports.html)
- [Modules - Just Programmer's Manual](https://just.systems/man/en/modules1190.html)
- [Just: How I Organize Large Rust Programs](https://rodarmor.com/blog/tour-de-just/)

---

## gum Terminal UI Toolkit

### Overview

[gum](https://github.com/charmbracelet/gum) from Charmbracelet is a tool for glamorous shell scripts with composable utilities for interactive CLI interfaces.

**Key Features:**
- Spinners for long operations
- Styled output (colors, borders, alignment)
- Interactive confirmations
- Input prompts with validation
- Fuzzy selection menus
- TTY detection with graceful fallback

**Sources:**
- [GitHub - charmbracelet/gum](https://github.com/charmbracelet/gum)
- [Enhancing Shell Scripts with Charmbracelet Gum](https://medium.com/@jignyasamishra/enhancing-shell-scripts-with-charmbracelet-gum-a-practical-guide-b9a534e3caf4)

### gum Commands for This Migration

#### Spinner (GUM-04)

**Usage:**
```bash
gum spin --spinner dot --title "Installing dependencies..." -- npm install
gum spin --spinner line --title "Running tests..." -- pytest
```

**Available Spinner Types:**
- `dot`, `line`, `minidot`, `jump`, `pulse`, `points`, `globe`, `moon`, `monkey`, `meter`, `hamburger`

**Show Command Output:**
```bash
gum spin --spinner dot --title "Building..." --show-output -- npm run build
```

#### Confirm (GUM-03)

**Usage:**
```bash
if gum confirm "Reset database? This will delete all data."; then
    rm -f backend/wallet.db
    just db-init
fi
```

**No TTY Fallback:**
```bash
# Automatically returns true in non-interactive environments (CI)
gum confirm "Continue?" --default=false
```

#### Style (GUM-02)

**Replace ANSI Escape Codes:**
```bash
# Make: echo "\033[0;34mStarting server...\033[0m"
# just: gum style --foreground 12 "Starting server..."

# Make: echo "\033[0;32m✓ Complete\033[0m"
# just: gum style --foreground 2 "✓ Complete"

# Make: echo "\033[0;31mError: ...\033[0m"
# just: gum style --foreground 1 --bold "Error: ..."
```

**Color Codes (256-color palette):**
- Blue: 12, 33, 39, 75
- Green: 2, 10, 34, 76
- Yellow: 11, 220, 226
- Red: 1, 9, 196, 203

**Borders and Layout:**
```bash
gum style \
    --border double \
    --border-foreground 212 \
    --padding "1 2" \
    --margin "1" \
    "Maxwell's Wallet - Setup Complete"
```

#### Input (GUM-01)

**Usage:**
```bash
MESSAGE=$(gum input --placeholder "Migration message")
just db-migrate "$MESSAGE"
```

#### TTY Detection (GUM-05)

**Pattern for CI Compatibility:**
```bash
if [ -t 1 ]; then
    # Interactive terminal - use gum
    gum spin --title "Installing..." -- uv sync
else
    # Non-interactive (CI) - plain output
    echo "Installing..."
    uv sync
fi
```

**Helper Function (scripts/gum-helpers.sh):**
```bash
#!/usr/bin/env bash
# Shared gum helper functions for justfile recipes

# Detect if running in TTY (interactive terminal)
is_tty() {
    [ -t 1 ]
}

# Run command with spinner if TTY, plain if not
spin() {
    local title="$1"
    shift
    if is_tty; then
        gum spin --spinner dot --title "$title" -- "$@"
    else
        echo "$title"
        "$@"
    fi
}

# Confirm with default behavior for non-TTY
confirm() {
    local message="$1"
    local default="${2:-false}"
    if is_tty; then
        gum confirm "$message" --default="$default"
    else
        # In CI, respect default
        [ "$default" = "true" ]
    fi
}

# Style text if TTY, plain if not
style() {
    local color="$1"
    shift
    if is_tty; then
        gum style --foreground "$color" "$@"
    else
        echo "$@"
    fi
}
```

---

## CI Integration

### GitHub Actions

**Current CI Structure:**
- `.github/workflows/ci.yaml` — main CI (frontend, backend, e2e, docker)
- Uses `actions/setup-node` and `astral-sh/setup-uv`
- Runs make targets inline (e.g., `npm ci`, `uv run pytest`)

**Migration to mise-action:**

**Example (Phase 14):**
```yaml
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jdx/mise-action@v2
        with:
          install: true  # Runs mise install (node, python, uv, just, gum)
          cache: true    # Cache mise tools
      - name: Run backend tests
        run: just test-backend
```

**Sources:**
- [Continuous integration | mise-en-place](https://mise.jdx.dev/continuous-integration.html)
- [mise-action - GitHub Marketplace](https://github.com/marketplace/actions/mise-action)
- [GitHub Actions - Just Programmer's Manual](https://just.systems/man/en/github-actions.html)

**Advantages:**
- Single action replaces multiple setup steps
- Mirrors local dev exactly (mise.toml is source of truth)
- Tool versions locked in `.mise.toml`
- gum non-interactive fallback automatic (TTY detection)

---

## Migration Strategy

### Parallel Operation (JUST-01)

**During Transition:**
- Keep `Makefile` and `make/` directory intact
- Create `justfile` and `.just/` directory alongside
- Both systems work identically
- Validate equivalence before deletion

**Validation Commands:**
```bash
# Make version
make setup
make dev
make test-all

# just version (same behavior)
just setup
just dev
just test-all
```

**Success Criteria:**
- `just --list` shows organized, documented recipes
- All 83 targets have just equivalents
- Destructive commands require gum confirmation
- Long operations show gum spinners
- CI green with just recipes

### Recipe Template

**Standard Recipe Pattern:**
```just
# Install backend dependencies
install-backend:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh

    style 12 "Installing backend dependencies..."
    cd backend
    spin "Running uv sync..." uv venv
    spin "Syncing packages..." uv sync --all-extras
    style 2 "✓ Backend dependencies installed"
```

**With Confirmation:**
```just
# Reset database (delete and recreate)
db-reset:
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh

    if confirm "Reset database? This will delete all data." false; then
        style 1 "Resetting database..."
        rm -f backend/wallet.db
        just db-init
        just db-seed
        style 2 "✓ Database reset complete"
    else
        echo "Aborted."
        exit 1
    fi
```

**With Parameters:**
```just
# Create new database migration
db-migrate MESSAGE="":
    #!/usr/bin/env bash
    set -euo pipefail
    source scripts/gum-helpers.sh

    MSG="{{ MESSAGE }}"
    if [ -z "$MSG" ]; then
        MSG=$(gum input --placeholder "Migration message")
    fi

    style 12 "Creating database migration..."
    cd backend
    uv run alembic revision --autogenerate -m "$MSG"
    style 2 "✓ Migration created"
```

**Parallel Execution:**
```just
# Run both backend and frontend (in parallel)
dev:
    @echo "Starting development servers..."
    just -j2 backend frontend
```

---

## Phase 13 Scope

### Requirements Coverage

**JUST-01:** All ~60 Make targets have just recipe equivalents with identical behavior
- **Status:** Feasible — 83 targets inventoried, patterns mapped, module structure clear

**JUST-02:** Recipes organized in 7 domain modules (`.just/*.just`) mirroring `make/*.mk`
- **Status:** Feasible — modular structure already exists, maps 1:1

**JUST-03:** Every recipe has documentation comment visible in `just --list`
- **Status:** Feasible — all Make targets already have `##` docs, copy verbatim

**JUST-04:** Recipe dependencies preserved (e.g., `setup: install db-init db-seed`)
- **Status:** Feasible — just supports identical syntax

**JUST-05:** Parameters with defaults supported (VERSION, DEMO_MODE, etc.)
- **Status:** Feasible — just supports parameters, env vars work identically

**JUST-06:** Parallel dev server startup (backend + frontend simultaneously)
- **Status:** Feasible — `just -j2 backend frontend` or `just backend & just frontend &`

**JUST-07:** Shell set to bash explicitly; shebang recipes for multi-line logic
- **Status:** Feasible — `set shell := ['bash', '-euo', 'pipefail', '-c']` in root justfile

**GUM-01:** Shared gum helper functions in `scripts/gum-helpers.sh`
- **Status:** Feasible — example provided above, ~50 LOC

**GUM-02:** All ANSI escape codes replaced with gum style commands
- **Status:** Feasible — 4 color codes in use (blue, green, yellow, red), map to gum palette

**GUM-03:** Interactive confirmations for destructive actions (db-reset, clean-all)
- **Status:** Feasible — 4 destructive targets identified

**GUM-04:** Spinners for long-running operations (install, build, test, docker)
- **Status:** Feasible — ~15 long operations identified

**GUM-05:** TTY detection with graceful fallback for CI/non-interactive environments
- **Status:** Feasible — gum-helpers.sh handles detection, CI gets plain output

---

## Risks and Mitigations

### Risk 1: Behavioral Differences

**Risk:** just recipes behave differently than Make targets
**Likelihood:** Low
**Impact:** High (breaks dev workflow)
**Mitigation:**
- Run both systems in parallel during Phase 13
- Validate each recipe against Make target before committing
- Automated test: `scripts/validate-make-just-parity.sh` compares help output
- Don't delete Makefile until Phase 16 (after CI + docs + devcontainer updated)

### Risk 2: CI Breakage

**Risk:** GitHub Actions fail after migration
**Likelihood:** Low (Phase 14 handles CI explicitly)
**Impact:** High (blocks merges)
**Mitigation:**
- Phase 13 focuses only on justfile creation (CI unchanged)
- Phase 14 migrates CI to mise-action + just recipes
- Phase 14 includes rollback plan (revert to Make commands)

### Risk 3: Shell Portability

**Risk:** Recipes rely on bash-specific features, break on other shells
**Likelihood:** Low (already using bash)
**Impact:** Low (devcontainer + macOS both have bash)
**Mitigation:**
- Set `shell := ['bash', '-euo', 'pipefail', '-c']` globally
- Use shebang recipes for complex multi-line logic
- Avoid bashisms where possible (prefer POSIX)

### Risk 4: gum Missing in CI

**Risk:** gum not available in GitHub Actions
**Likelihood:** Low (mise-action installs it)
**Impact:** Medium (recipes fail)
**Mitigation:**
- Phase 13: gum-helpers.sh includes TTY detection
- Non-TTY environments get plain output (no gum calls)
- Phase 14: mise-action installs gum from `.mise.toml`

### Risk 5: Recipe Naming Conflicts

**Risk:** Module recipes shadow root recipes (e.g., `dev::clean` vs. `clean`)
**Likelihood:** Medium
**Impact:** Low (confusing, not breaking)
**Mitigation:**
- Use module prefixes consistently (`just dev::backend`, not `just backend`)
- Root justfile defines only high-level recipes (setup, dev, test-all)
- Documentation clarifies calling convention

---

## Dependencies

### Prerequisite (Phase 12) ✅

- [x] mise installed and configured (`.mise.toml`)
- [x] just + gum in `.mise.toml` tools
- [x] `.envrc` delegates to mise
- [x] Secrets loaded from `.env`

### External Tools (Already Installed)

- **Node.js 22** — mise-managed
- **Python 3.11** — mise-managed
- **uv** — mise-managed
- **npm** — bundled with Node
- **bash** — system default
- **git** — system default
- **docker** — assumed present (Docker targets)
- **curl** — system default (status checks)

### New Files Created in Phase 13

```
justfile                      # Root justfile (imports modules, common vars)
.just/
├── dev.just                 # Development recipes
├── db.just                  # Database recipes
├── test.just                # Testing recipes
├── docker.just              # Docker recipes
├── release.just             # Release recipes
├── i18n.just                # Internationalization recipes
└── utils.just               # Utility recipes
scripts/
└── gum-helpers.sh           # Shared gum functions (TTY detection, style, confirm, spin)
```

**Total New LOC:** ~800 lines (justfile + modules + helpers)

---

## Success Criteria Validation

### JUST-01: All Make targets have just equivalents

**Test:**
```bash
# Extract Make target names
grep -hE "^[a-zA-Z0-9_-]+:.*##" Makefile make/*.mk | cut -d: -f1 | sort > /tmp/make-targets.txt

# Extract just recipe names
just --list --unsorted | tail -n +2 | awk '{print $1}' | sort > /tmp/just-recipes.txt

# Compare
diff /tmp/make-targets.txt /tmp/just-recipes.txt
```

**Expected:** No differences (all 83 targets present)

### JUST-02: Modular organization

**Test:**
```bash
ls -1 .just/
# Expected output:
# db.just
# dev.just
# docker.just
# i18n.just
# release.just
# test.just
# utils.just
```

### JUST-03: Documentation visible

**Test:**
```bash
just --list | grep "Run backend server"
# Expected: recipe with full doc comment
```

### JUST-04: Dependencies preserved

**Test:**
```bash
just --show setup
# Expected output includes:
# setup: install db-init db-seed
```

### JUST-05: Parameters supported

**Test:**
```bash
just release VERSION=1.2.3
# Expected: VERSION parameter used in recipe
```

### JUST-06: Parallel execution

**Test:**
```bash
time just dev
# Expected: backend + frontend start simultaneously (not sequential)
```

### JUST-07: Bash shell

**Test:**
```bash
head -3 justfile
# Expected:
# set shell := ['bash', '-euo', 'pipefail', '-c']
```

### GUM-01: Helper functions exist

**Test:**
```bash
[ -f scripts/gum-helpers.sh ] && echo "✓" || echo "✗"
source scripts/gum-helpers.sh
type is_tty spin confirm style
# Expected: all functions defined
```

### GUM-02: ANSI codes replaced

**Test:**
```bash
grep -r "\\033\[" .just/ justfile
# Expected: no matches (all using gum style)
```

### GUM-03: Destructive confirmations

**Test:**
```bash
echo "n" | just db-reset
# Expected: "Aborted." (confirmation respected)
```

### GUM-04: Spinners present

**Test:**
```bash
grep -r "gum spin" .just/ justfile | wc -l
# Expected: ≥15 (one per long operation)
```

### GUM-05: TTY detection

**Test:**
```bash
# Interactive terminal
just install-backend
# Expected: spinners + styled output

# Non-interactive (pipe to file)
just install-backend > /tmp/output.txt 2>&1
cat /tmp/output.txt
# Expected: plain text, no ANSI codes
```

---

## Open Questions

### Q1: Should we use just modules or imports?

**Context:** just supports both `mod foo` (modules, namespaced) and `import "foo.just"` (imports, flat namespace).

**Research:**
- Modules: `just dev::backend` (explicit namespace, no collisions)
- Imports: `just backend` (shorter, but potential conflicts)

**Recommendation:** Use modules (`mod`) for clarity and collision avoidance. Aligns with Make's `make/` structure.

**Decision Point:** Planner can choose during Phase 13 plan creation.

### Q2: How to handle environment-specific recipes?

**Context:** Some targets use env vars (DEMO_MODE, ENABLE_PSEUDO).

**Options:**
1. **Environment variables (current approach):**
   ```bash
   DEMO_MODE=true just dev
   ```
2. **Recipe parameters:**
   ```just
   dev MODE="normal":
       @if [ "{{ MODE }}" = "demo" ]; then ...
   ```
3. **Separate recipes:**
   ```just
   dev:
       ...
   dev-demo:
       DEMO_MODE=true just dev
   ```

**Recommendation:** Keep env vars for consistency with current workflow. Add parameter-based recipes as aliases (e.g., `just dev-demo` sets DEMO_MODE=true).

**Decision Point:** Planner can define in Phase 13 plan.

### Q3: Should gum-helpers.sh be sourced or executed?

**Context:** Recipes need helper functions (is_tty, spin, confirm, style).

**Options:**
1. **Source in each recipe:**
   ```just
   recipe:
       #!/usr/bin/env bash
       source scripts/gum-helpers.sh
       spin "Installing..." npm install
   ```
2. **Global function definitions in justfile:**
   ```just
   spin := 'source scripts/gum-helpers.sh && spin'

   recipe:
       @{{ spin }} "Installing..." npm install
   ```

**Recommendation:** Source in each shebang recipe. Keeps recipes self-contained and shell-compatible.

**Decision Point:** Implementation detail, can be standardized in Phase 13.

---

## Next Steps (for Planner)

### Phase 13 Plan Should Include

1. **Create gum-helpers.sh** (GUM-01, GUM-05)
   - Functions: is_tty, spin, confirm, style
   - TTY detection logic
   - ~50 LOC

2. **Create root justfile** (JUST-07)
   - Set shell to bash with strict mode
   - Define shared variables (BACKEND_DIR, FRONTEND_DIR)
   - Import modules (`mod dev`, `mod db`, etc.)
   - Define high-level recipes (setup, install, help)
   - ~50 LOC

3. **Migrate each module** (JUST-01, JUST-02, JUST-03, JUST-04)
   - `make/dev.mk` → `.just/dev.just`
   - `make/db.mk` → `.just/db.just`
   - `make/test.mk` → `.just/test.just`
   - `make/docker.mk` → `.just/docker.just`
   - `make/release.mk` → `.just/release.just`
   - `make/i18n.mk` → `.just/i18n.just`
   - `make/utils.mk` → `.just/utils.just`
   - For each:
     - Convert target syntax to recipe syntax
     - Replace ANSI codes with gum style (GUM-02)
     - Add gum spin for long operations (GUM-04)
     - Add gum confirm for destructive actions (GUM-03)
     - Add doc comments for `just --list`
     - Preserve dependencies and parameters (JUST-05)
   - ~700 LOC total

4. **Validate parity** (JUST-01)
   - Run side-by-side tests (Make vs. just)
   - Verify `just --list` output organized
   - Test destructive action confirmations
   - Test TTY vs. non-TTY behavior

5. **Update .gitignore** (if needed)
   - Ensure `.just/` is not ignored
   - Ensure `scripts/` is not ignored

### Out of Scope for Phase 13

- **CI migration** (Phase 14: CI Integration)
- **Devcontainer migration** (Phase 14: CI Integration)
- **Documentation updates** (Phase 15: Documentation)
- **Makefile deletion** (Phase 16: Cleanup)
- **`.nvmrc` deletion** (Phase 16: Cleanup)

---

## References

### just Documentation
- [GitHub - casey/just](https://github.com/casey/just)
- [Introduction - Just Programmer's Manual](https://just.systems/man/en/)
- [Just Command Runner Best Practices](https://www.chicks.net/reference/file_formats/just/)
- [Quick Start - Just Programmer's Manual](https://just.systems/man/en/quick-start.html)
- [Imports - Just Programmer's Manual](https://just.systems/man/en/imports.html)
- [Modules - Just Programmer's Manual](https://just.systems/man/en/modules1190.html)
- [Just: How I Organize Large Rust Programs](https://rodarmor.com/blog/tour-de-just/)

### gum Documentation
- [GitHub - charmbracelet/gum](https://github.com/charmbracelet/gum)
- [Enhancing Shell Scripts with Charmbracelet Gum](https://medium.com/@jignyasamishra/enhancing-shell-scripts-with-charmbracelet-gum-a-practical-guide-b9a534e3caf4)

### mise CI Integration
- [Continuous integration | mise-en-place](https://mise.jdx.dev/continuous-integration.html)
- [mise-action - GitHub Marketplace](https://github.com/marketplace/actions/mise-action)
- [GitHub Actions - Just Programmer's Manual](https://just.systems/man/en/github-actions.html)

### Project Files
- `/Makefile` — main entry point
- `make/*.mk` — 7 modular makefiles (707 LOC)
- `.mise.toml` — tool management (Phase 12)
- `.envrc` — delegates to mise
- `.github/workflows/ci.yaml` — current CI (to be updated in Phase 14)

---

**Research Complete:** 2026-02-26
**Confidence Level:** High — Migration is well-scoped, technically feasible, and low-risk.
**Recommendation:** Proceed to planning (Phase 13 plan creation).
