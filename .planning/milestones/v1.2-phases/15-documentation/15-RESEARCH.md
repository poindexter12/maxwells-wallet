# Phase 15: Documentation - Research

**Researched:** 2026-02-26
**Domain:** Technical documentation, command reference migration
**Confidence:** HIGH

## Summary

Phase 15 requires updating all project documentation to reference `just` recipes instead of `make` targets. This is a straightforward search-and-replace task with clear scope: all Markdown files in the repository containing backtick-wrapped `make` commands must be updated to use the equivalent `just` recipe syntax.

The project has a well-established just recipe structure (completed in Phase 13) with modular organization (`.just/*.just` files) and comprehensive coverage of all former Make targets. The documentation update is a mechanical transformation with one strategic decision: how strongly to emphasize just as THE command runner versus allowing direct tool invocation.

**Primary recommendation:** Treat this as a mechanical text transformation with strong emphasis on just as the canonical way to run project tasks. Remove "Direct Commands (When Necessary)" sections entirely to establish just as the single entry point for all development workflows.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prerequisite framing:**
- mise is THE single prerequisite — "install mise, then just setup" is the entire onboarding story
- Include inline mise install snippet directly in README (curl one-liner) so developers never leave the page
- No manual fallback path documented (no "alternatively install Node + Python + uv manually")
- mise + just appear in setup/development sections only, not in the project intro or tech stack bullet points

**Docs audit scope:**
- All files in the entire repo are in scope for the DOC-03 audit
- `.claude/skills/` files (Next.js, FastAPI, testing, etc.) get updated — all make references become just equivalents
- `.claude/agents/` files get updated
- `docs/` directory files (i18n-workflow.md, etc.) get audited and updated
- `e2e/README.md` and any other scattered READMEs get updated
- Success criteria: `git grep -i "\`make"` returns zero results (excluding Makefile itself and make/ directory, which Phase 16 handles)

**Command presentation:**
- Commands organized by domain in docs, mirroring current grouped structure (Setup, Development, Build & Test, Database, Linting, Docker, i18n, etc.)
- Remove the "Direct Commands (When Necessary)" section from CLAUDE.md entirely — everything goes through just
- No need to document `just --list` since bare `just` (no args) shows the recipe list
- Stronger emphasis than before: just is THE way to run things, no direct npm/uv/alembic in normal workflows

**Migration posture:**
- Clean break — no mention of make anywhere in docs
- Docs read as if just was always the tool; no "migrated from make" notes
- The CLAUDE.md "IMPORTANT: Always prefer make commands" callout becomes a stronger version for just: just is THE way to run things, no backdoors

### Claude's Discretion

- Whether to keep or simplify the devcontainer section in CLAUDE.md (agents don't typically use devcontainers, but it's existing context)
- Whether to add a deprecation header comment to the Makefile itself (since Phase 16 deletes it)
- Level of detail for gum UX notes (spinners, confirmations) in command docs — note interactive commands or keep it discoverable

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | CLAUDE.md updated — all `make` commands replaced with `just` equivalents | Recipe mapping table provides 1:1 equivalents; modular just syntax (`just dev::backend`) is well-documented |
| DOC-02 | README.md updated — setup/dev instructions reference just | Simple text replacement; inline mise install snippet available from .mise.toml docs |
| DOC-03 | No remaining `make` command references in any docs (grep audit clean) | Grep pattern `git grep -i "\`make"` provides definitive verification; exclusion list (.planning, Makefile, make/) is clear |

</phase_requirements>

## Standard Stack

This phase uses no external libraries — it's a pure documentation update task.

### Tools Used

| Tool | Purpose | Source |
|------|---------|--------|
| `git grep` | Search for backtick-wrapped make references | Built-in Git |
| `grep -v` | Filter exclusions (Makefile, make/ dir, .planning/) | Standard Unix |
| Text editor | Manual find/replace in markdown files | N/A |

**Installation:** None required (all tools are standard POSIX utilities)

## Architecture Patterns

### Documentation File Categories

The repository contains several categories of documentation that require updates:

```
Root level:
├── CLAUDE.md           # Agent guidance (comprehensive make → just replacement)
├── README.md           # User-facing quickstart (setup + dev commands)
├── CONTRIBUTING.md     # May contain workflow examples
├── QUICKSTART.md       # Likely duplicates README commands

Agent configuration:
├── .claude/agents/*.mdc      # Agent definitions (reference make in operating rules)
├── .claude/skills/*.mdc      # Skill cards (testing, FastAPI, etc. reference make)

Documentation directories:
├── docs/*.md                 # Workflow docs (i18n-workflow.md confirmed to have make)
├── docs-site/**/*.md         # Published docs site (developer guides)
├── frontend/e2e/README.md    # Test docs (confirmed to have make test-e2e)
├── frontend/src/messages/CLAUDE.md  # i18n agent guidance

Planning artifacts:
├── .planning/**/*.md         # Phase plans, research (contain make for historical context — EXCLUDE)
```

### Pattern 1: Make → Just Recipe Mapping

**What:** Translate make targets to just recipe syntax

**When to use:** Every backtick-wrapped `make <target>` command in docs

**Mapping rules:**
- Root-level recipes: `make setup` → `just setup`
- Module recipes: `make dev` → `just dev::dev`, `make backend` → `just dev::backend`
- Database recipes: `make db-init` → `just db::init`, `make db-migrate` → `just db::migrate`
- Test recipes: `make test-backend` → `just test::backend`, `make test-e2e` → `just test::e2e`
- Docker recipes: `make docker-build` → `just docker::build`, `make docker-up` → `just docker::up`
- i18n recipes: `make translate-upload` → `just i18n::upload`, `make translate-status` → `just i18n::status`
- Lint recipes: `make lint` → `just test::lint`, `make quality` → `just test::quality`

**Module structure:**
```
justfile (root)
├── dev::*      # Development servers
├── db::*       # Database operations
├── test::*     # Testing and linting
├── docker::*   # Container operations
├── i18n::*     # Internationalization
├── release::*  # Release management
└── utils::*    # Utilities
```

**Example transformation:**
```diff
-make setup               # Install deps + seed database
-make dev                 # Run both backend and frontend in parallel
-make test-backend        # Run backend tests
+just setup               # Install deps + seed database
+just dev::dev            # Run both backend and frontend in parallel
+just test::backend       # Run backend tests
```

### Pattern 2: Premise Framing (mise as Single Prerequisite)

**What:** Reframe setup documentation to position mise as the only prerequisite

**When to use:** README.md, CLAUDE.md setup sections, any "Getting Started" guides

**Before:**
```markdown
### Requirements
- Node.js 22+
- Python 3.11+
- uv (Python package manager)

### Setup
1. Install Node.js from nodejs.org
2. Install Python 3.11+
3. Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
4. Run `make setup`
```

**After:**
```markdown
### Prerequisites
Install mise (tool version manager):
```bash
curl https://mise.run | sh
```

Then mise auto-installs Node, Python, uv, just, and gum when you enter the project directory.

### Setup
```bash
just setup    # First-time setup
just dev::dev # Start servers
```
```

**Rationale:** User decision requires inline mise install snippet and "mise is THE prerequisite" framing. No manual tool installation steps.

### Pattern 3: Command Section Reorganization

**What:** Organize commands by domain (setup, dev, test, database, etc.) using just module structure

**When to use:** CLAUDE.md "Development Commands" section

**Structure:**
```markdown
## Development Commands

**IMPORTANT**: Always use `just` commands. The justfile handles environment setup, paths, and gum-enhanced UX. Run bare `just` (no args) to see all available recipes.

### Setup
```bash
just setup               # First-time setup (install deps + init database)
just install             # Install dependencies only
just install-backend     # Install backend deps only
just install-frontend    # Install frontend deps only
```

### Development
```bash
just dev::dev            # Run both backend and frontend in parallel
just dev::backend        # Run backend server only
just dev::frontend       # Run frontend server only
just dev::build-frontend # Build frontend for production
```

### Database
```bash
just db::init            # Initialize database (create tables)
just db::seed            # Seed database with sample data
just db::reset           # Reset database (DESTRUCTIVE — asks for confirmation)
just db::migrate         # Create new migration (prompts for message)
just db::upgrade         # Apply migrations
```

### Testing & Quality
```bash
just test::backend       # Run backend unit/integration tests
just test::coverage      # Run tests with coverage report
just test::e2e           # Run E2E tests (requires servers running)
just test::chaos         # Run chaos/monkey tests
just test::lint          # Lint all code (backend + frontend)
just test::quality       # Run all quality checks (lint + typecheck + dead code)
```

### Docker
```bash
just docker::build       # Build Docker image
just docker::up          # Start containers
just docker::down        # Stop containers
```

### Internationalization
```bash
just i18n::upload        # Push source strings to Crowdin
just i18n::download      # Pull translations from Crowdin
just i18n::status        # Check translation progress
just i18n::pseudo        # Generate pseudo-locale for testing
```
```

### Anti-Patterns to Avoid

- **Documenting direct tool invocation as "alternative":** User decision requires removing "Direct Commands (When Necessary)" section entirely. No `npm run dev` or `uv run uvicorn` escape hatches in docs.
- **Mentioning make migration:** Clean break posture means no "previously we used make, now we use just" notes in user-facing docs.
- **Inconsistent module syntax:** Always use `just module::recipe`, never `just module-recipe` or `just module_recipe`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recipe discovery UI | Custom help formatter | `just` (no args) | Just's native list view shows all recipes with doc comments |
| Command validation | Bash parameter validation | Just recipe parameters with defaults | Just handles parameter parsing and defaults natively |
| Search/replace script | Custom AST manipulation | Manual find/replace in editor | This is a one-time mechanical task with clear scope |

**Key insight:** This phase is pure documentation maintenance. No code changes, no tooling changes, no automation needed beyond standard grep for verification.

## Common Pitfalls

### Pitfall 1: Missing Exclusions in Grep Audit

**What goes wrong:** Final grep verification (`git grep -i "\`make"`) returns false positives from Makefile, make/ directory, or .planning/ artifacts

**Why it happens:** Phase 15 focuses on documentation only; Makefile deletion is Phase 16 scope, and .planning/ files preserve historical context

**How to avoid:** Use grep exclusion pattern:
```bash
git grep -i '`make' -- ':!Makefile' ':!make/' ':!.planning/'
```

**Warning signs:** Grep returns results from `Makefile`, `make/*.mk`, or `.planning/**/*.md` files

### Pitfall 2: Inconsistent Module Syntax

**What goes wrong:** Docs mix `just dev`, `just dev::dev`, and module-less invocations inconsistently

**Why it happens:** Root justfile has a few recipes (`setup`, `install*`) while most live in modules (`dev::*`, `db::*`, etc.)

**How to avoid:** Use this decision table:

| Recipe | Correct Syntax | Wrong Syntax |
|--------|---------------|--------------|
| First-time setup | `just setup` | `just dev::setup` (doesn't exist) |
| Install deps | `just install` | `just utils::install` |
| Run dev servers | `just dev::dev` | `just dev` (ambiguous) |
| Backend only | `just dev::backend` | `just backend` |
| Database init | `just db::init` | `just init` |
| Run tests | `just test::backend` | `just backend` (collision) |
| Lint code | `just test::lint` | `just lint` |

**Warning signs:** Recipe names without module prefix that aren't in the root justfile (setup, install, install-backend, install-frontend)

### Pitfall 3: Stale Agent Guidance

**What goes wrong:** `.claude/agents/*.mdc` files still say "prefers `make` commands" in operating rules

**Why it happens:** Agent definitions were written when make was the canonical tool

**How to avoid:** Update all agent MDC files:
- Find: `prefers \`make\` commands`
- Replace: `prefers \`just\` commands`
- Find references to make targets in examples and update to just recipes

**Warning signs:** Agent prompts reference `make test-backend` or similar in example workflows

### Pitfall 4: Duplicate Command Tables

**What goes wrong:** CLAUDE.md and README.md have redundant command tables that drift out of sync

**Why it happens:** README targets end users (brief), CLAUDE.md targets agents (comprehensive)

**How to avoid:**
- README: Keep minimal quickstart flow (`just setup`, `just dev::dev`, link to `just` for discovery)
- CLAUDE.md: Comprehensive organized reference with all modules
- Other docs: Link to CLAUDE.md or README rather than duplicating tables

**Warning signs:** Same command appears in multiple files with different descriptions

## Code Examples

### Example 1: CLAUDE.md Development Commands Section (Full Replacement)

**Before:**
```markdown
## Development Commands

**IMPORTANT**: Always prefer `make` commands over running commands directly.

### Using Make (Preferred)

From the repository root:
```bash
# First-time setup
make setup               # Install deps + seed database

# Development
make dev                 # Run both backend and frontend in parallel
make backend             # Run backend only
make frontend            # Run frontend only

# Build & Test
make build-frontend      # Build frontend for production
make test-backend        # Run backend tests
make test-all            # Run all tests
```

Run `make help` to see all available targets.

### Direct Commands (When Necessary)

Backend (from `backend/` directory):
```bash
uv run uvicorn app.main:app --reload
```

Frontend (from `frontend/` directory):
```bash
npm run dev
```
```

**After:**
```markdown
## Development Commands

**IMPORTANT**: Always use `just` commands. The justfile handles environment setup, paths, and provides enhanced UX via gum. Run bare `just` (no args) to see all available recipes.

### Prerequisites

Install mise (tool version manager):
```bash
curl https://mise.run | sh
```

mise auto-installs Node, Python, uv, just, and gum when you enter the project directory.

### Setup
```bash
just setup               # First-time setup (install deps + init database)
just install             # Install dependencies only
```

### Development
```bash
just dev::dev            # Run both backend and frontend in parallel
just dev::backend        # Run backend server only
just dev::frontend       # Run frontend server only
just dev::build-frontend # Build frontend for production
```

### Build & Test
```bash
just test::backend       # Run backend tests
just test::coverage      # Run tests with coverage report
just test::e2e           # Run E2E tests (requires servers running)
just test::all           # Run all tests (unit + E2E)
```

### Database
```bash
just db::init            # Initialize database (create tables)
just db::seed            # Seed database with sample data
just db::reset           # Reset database (DESTRUCTIVE — asks for confirmation)
just db::migrate MESSAGE="description"  # Create new migration
just db::upgrade         # Apply migrations
```

### Linting & Quality
```bash
just test::lint          # Lint all code (backend + frontend)
just test::quality       # Run all quality checks (lint + typecheck + vulture)
just test::typecheck     # Type checking with mypy
just test::vulture       # Dead code detection
```

### Docker
```bash
just docker::build       # Build Docker image
just docker::up          # Start containers
just docker::down        # Stop containers
just docker::demo        # Demo mode with sample data
```

### Internationalization
```bash
just i18n::upload        # Push source strings to Crowdin
just i18n::download      # Pull translations from Crowdin
just i18n::status        # Check translation progress
just i18n::pseudo        # Generate pseudo-locale for testing
```
```

### Example 2: README.md Setup Section

**Before:**
```markdown
### Development

#### Local Setup

```bash
make setup    # First-time setup
make dev      # Start servers
# Open http://localhost:3000
```

```bash
make help     # Show all commands
```
```

**After:**
```markdown
### Development

#### Prerequisites

Install mise (tool version manager):
```bash
curl https://mise.run | sh
```

mise auto-installs all dev tools (Node, Python, uv, just, gum) when you enter the project directory.

#### Local Setup

```bash
just setup     # First-time setup
just dev::dev  # Start servers
# Open http://localhost:3000
```

```bash
just           # Show all available commands
```
```

### Example 3: docs/i18n-workflow.md Make Commands Table

**Before:**
```markdown
## Make Commands

| Command | Description |
|---------|-------------|
| `make translate-upload` | Push `en-US.json` to Crowdin |
| `make translate-download` | Pull all translations from Crowdin |
| `make translate-status` | Show translation progress |
| `make translate-pseudo` | Generate pseudo-locale for testing |
| `make translate-harvest-new` | Generate AI context for new strings |
```

**After:**
```markdown
## Just Commands

| Command | Description |
|---------|-------------|
| `just i18n::upload` | Push `en-US.json` to Crowdin |
| `just i18n::download` | Pull all translations from Crowdin |
| `just i18n::status` | Show translation progress |
| `just i18n::pseudo` | Generate pseudo-locale for testing |
| `just i18n::harvest-new` | Generate AI context for new strings |
```

### Example 4: frontend/e2e/README.md Testing Commands

**Before:**
```markdown
## Running Tests

```bash
# From repo root
make test-e2e

# From frontend directory
npx playwright test
```
```

**After:**
```markdown
## Running Tests

```bash
# From repo root
just test::e2e

# From frontend directory
npx playwright test
```
```

### Example 5: .claude/agents/techlead.mdc Operating Rules

**Before:**
```markdown
Operating rules:
- Start by reading `CLAUDE.md` and relevant files in `.claude/skills/` when you begin a session or when context resets.
- Make a short plan (2–5 steps) for non-trivial tasks; keep only one step in progress.
- Prefer `make` targets over raw commands; avoid destructive commands; ask before doing anything that can drop data.
```

**After:**
```markdown
Operating rules:
- Start by reading `CLAUDE.md` and relevant files in `.claude/skills/` when you begin a session or when context resets.
- Make a short plan (2–5 steps) for non-trivial tasks; keep only one step in progress.
- Prefer `just` recipes over raw commands; avoid destructive commands; ask before doing anything that can drop data.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Make as task runner | just as task runner | Phase 13 (complete) | Module organization, gum UX enhancements, better parameter handling |
| Direct tool invocation | All commands through just | Phase 15 (this phase) | Consistent UX, centralized environment setup, easier onboarding |
| Manual tool installation | mise manages all tools | Phase 12 (complete) | Auto-installs correct versions, eliminates "works on my machine" issues |

**Deprecated/outdated:**
- `make <target>` syntax: Replaced by `just <module>::<recipe>` for modular organization
- `.nvmrc`: Replaced by `.mise.toml` `[tools]` section
- `.envrc` with direct exports: Replaced by `.mise.toml` `[env]` section
- Direct `npm`/`uv`/`alembic` commands in docs: Replaced by `just` recipes

## Open Questions

None. This phase has clear scope and well-defined success criteria.

## Sources

### Primary (HIGH confidence)

- `/Users/joe/Code/github.com/poindexter12/maxwells-wallet/CLAUDE.md` - Current make-based documentation
- `/Users/joe/Code/github.com/poindexter12/maxwells-wallet/README.md` - User-facing setup instructions
- `/Users/joe/Code/github.com/poindexter12/maxwells-wallet/justfile` - Root justfile structure
- `/Users/joe/Code/github.com/poindexter12/maxwells-wallet/.just/*.just` - Module definitions
- `/Users/joe/Code/github.com/poindexter12/maxwells-wallet/.mise.toml` - Tool configuration
- `.planning/phases/15-documentation/15-CONTEXT.md` - User decisions from discussion phase
- `.planning/REQUIREMENTS.md` - Phase requirements DOC-01, DOC-02, DOC-03

### Secondary (MEDIUM confidence)

- Grep results for `git grep -i "\`make"` - Identified 34 files containing make references
- Frontend e2e README, docs/i18n-workflow.md, agent MDC files - Confirmed make references

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external dependencies, standard POSIX utilities only
- Architecture: HIGH - Direct codebase inspection of existing docs and just recipes
- Pitfalls: HIGH - Based on grep verification requirements and modular syntax complexity

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (30 days — stable documentation task)
