# Technology Stack

**Project:** Maxwell's Wallet v1.2 Build System Modernization
**Researched:** 2026-02-26 (Updated with integration details)

## Recommended Stack

### Tool Version Manager
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| mise | 2026.2.21 | Universal tool version manager | Replaces nvm + pyenv + direnv; manages node, python, uv, just, gum from single config; Rust-based for speed; handles env vars via `[env]` section; active development with daily releases |

### Task Runner
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| just | 1.46.0 | Command runner (replaces Make) | Command runner (not build system); no `.PHONY` needed; cross-platform; runs from subdirectories; multi-language recipes; better error messages; simpler syntax (no `=` vs `:=` confusion); `set export` for env vars |

### CLI Styling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| gum | 0.17.0 | Terminal UI components for scripts | Beautiful CLI output from Charmbracelet; replaces raw ANSI escape codes; `style`, `spin`, `log`, `confirm`, `choose` subcommands; highly configurable via flags; composable utilities |

### Existing Tools (Managed by mise)
| Technology | Current | Purpose | Integration |
|------------|---------|---------|-------------|
| Node.js | 22 | Frontend runtime | Specified in mise.toml instead of .nvmrc |
| Python | 3.11 | Backend runtime | Specified in mise.toml instead of .python-version |
| uv | latest | Python package manager | mise has native uv integration with venv auto-creation |
| npm | (bundled) | Frontend dependencies | Continues to work; no changes needed |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Tool Manager | mise | asdf | mise is Rust-based (faster), native uv support, built-in task runner, actively developed |
| Tool Manager | mise | nvm + pyenv + direnv | Multiple tools = fragmented setup; mise unifies with single config including env vars |
| Task Runner | just | Make (keep existing) | Make has ~60 targets working; migration justified by: better DX, module system, cross-platform consistency, gum integration opportunity |
| Task Runner | just | mise tasks | mise tasks are TOML-based and less mature; just has dedicated focus, better docs, wider adoption for command running |
| CLI Styling | gum | handrolled ANSI | gum provides composable, tested components; maintaining custom styling not worth effort |

## Installation

### Install mise (one-time setup)
```bash
# macOS/Linux
curl https://mise.run | sh

# Or via package manager
brew install mise

# Shell activation (add to ~/.zshrc or ~/.bashrc)
eval "$(mise activate zsh)"
```

### Install all tools via mise
```bash
# Tools are auto-installed from mise.toml on first activation
# Or manually trigger:
mise install

# Verify
mise ls
```

### mise.toml Configuration
```toml
[tools]
# Core languages
node = "22"
python = "3.11"

# Python tooling
uv = "latest"

# Build system
just = "1.46.0"
gum = "0.17.0"

[env]
# Load secrets from .env files (replaces .envrc)
_.file = [".env", ".env.local"]

# Secrets (prompted on first use)
_.secret = ["CROWDIN_PERSONAL_TOKEN", "ANTHROPIC_API_KEY"]

# Static values
DATABASE_URL = "sqlite:///./maxwell.db"
DEBUG = "true"

# uv virtual environment configuration
_.python.venv = { path = ".venv", create = true }

[settings]
# Auto-activate venv when entering directory
python.uv_venv_auto = true
```

## Integration Details

### mise + Environment Variables (replaces .envrc + direnv)

**Current state:**
- `.envrc` contains: `export CROWDIN_PERSONAL_TOKEN="..."` and `export ANTHROPIC_API_KEY="..."`
- Requires direnv installed and `direnv allow` per directory

**New state:**
- mise `[env]` section in `.mise.toml`
- Three strategies for secrets:
  1. `_.file = [".env"]` — Load from .env file (gitignored)
  2. `_.secret = ["KEY_NAME"]` — Prompt on first use, stored in mise vault
  3. Static values — For non-sensitive config

**Migration:**
```toml
[env]
# Option 1: Move secrets to .env file, reference in mise.toml
_.file = [".env"]

# Option 2: Let mise prompt and vault secrets
_.secret = ["CROWDIN_PERSONAL_TOKEN", "ANTHROPIC_API_KEY"]
```

### mise + node/python/uv
- mise replaces `.nvmrc` and `.python-version` files
- Tools specified in `mise.toml` `[tools]` section
- mise has native uv support: auto-creates venv, respects `UV_PROJECT_ENVIRONMENT`
- Existing `uv` commands continue to work; mise just manages the version
- npm continues to work as-is; no changes needed to package.json scripts

### mise + just
- mise installs just as a tool (registry entry: `aqua:casey/just`)
- Both mise and just can run tasks:
  - **Use just** for task definitions (primary task runner)
  - **Use mise** for tool version management and env vars
- just has `import` (flattens into current namespace) and `mod` (submodule with namespace)
- justfile supports variables, dependencies, shell selection, platform-specific recipes

### mise + gum
- mise installs gum as a tool (registry entry: `aqua:charmbracelet/gum`)
- gum invoked from justfile recipes for styled output

**Key gum subcommands for task runner output:**

| Command | Purpose | Example |
|---------|---------|---------|
| `gum style` | Borders, colors, padding | `gum style --foreground 212 --border double "Maxwell's Wallet"` |
| `gum spin` | Spinner during command | `gum spin --spinner dot --title "Installing..." -- npm install` |
| `gum log` | Structured logging | `gum log --structured --level info "Setup complete"` |
| `gum format` | Markdown rendering | `gum format -- "# Build Complete"` |
| `gum confirm` | Yes/no prompt | `gum confirm "Reset database?" && just db-reset` |
| `gum choose` | Select from list | `TASK=$(gum choose "dev" "test" "build")` |

**Other commands:** `input`, `write`, `file`, `filter`, `table`, `join`, `pager`

## justfile Recipe Syntax (vs Make)

### Basic Recipe
```justfile
# Comments start with #
setup: ## First-time setup
  gum spin --spinner dot --title "Installing dependencies..." -- just _install
  just db-init
  just db-seed
  gum log --level info "Setup complete!"

_install:
  cd backend && uv sync --all-extras
  cd frontend && npm install
```

### Key just Features

**No .PHONY needed:** All recipes are command runners by default

**Parameters with defaults:**
```justfile
serve port='3000':
  npm run dev -- --port {{port}}
```

**Recipe dependencies:**
```justfile
build: test lint
  npm run build
```

**Multi-language support (shebangs):**
```justfile
python-task:
  #!/usr/bin/env python3
  print("Python code here")
```

**Environment variables:**
```justfile
set export  # Export all variables to recipes

DATABASE_URL := "sqlite:///./maxwell.db"
```

**Cross-platform:**
```justfile
# Use different shells per OS
build:
  {{ if os() == "macos" { "bash" } else { "sh" } }} ./build.sh
```

**Run from subdirectories:** `just` searches up directory tree for justfile (unlike Make which only checks current dir)

## Migration from Make

**Current Makefile structure:**
- `Makefile` (main) + 7 modular `.mk` files: dev, db, test, docker, release, i18n, utils
- ~60 targets total
- Color output via ANSI escape codes: `BLUE := \033[0;34m`

**Translation strategy:**
1. **Keep recipe names identical** (e.g., `make dev` → `just dev`)
2. **Replace ANSI escapes with gum style** (e.g., `echo "$(BLUE)Installing...$(NC)"` → `gum log --level info "Installing..."`)
3. **Add gum spinners for long operations** (backend startup, npm install, database migrations)
4. **Group recipes by category** in single justfile (or use `mod` for modules if >200 lines)
5. **Delete after migration:** Makefile, make/ directory, .envrc (replaced by mise.toml `[env]`)

## PATH Management (mise shims)

mise provides two activation methods:

### Option 1: Shell integration (recommended)
```bash
# In ~/.zshrc or ~/.bashrc
eval "$(mise activate zsh)"  # or bash
```
- Automatically updates PATH when entering directories
- Tools shimmed via `~/.local/share/mise/shims`
- Shims intercept commands and delegate to mise-managed versions

### Option 2: Manual PATH export
```bash
export PATH="$HOME/.local/share/mise/shims:$PATH"
```
- Simpler, no shell hooks
- Good for environments where mise isn't available yet

**Shims:** Small executables that intercept tool commands. Automatically updated via `mise reshim` (happens on install/update/remove).

## Devcontainer Integration

**Update `.devcontainer/devcontainer.json`:**
- Add mise installation to features or postCreateCommand
- Remove nvm/pyenv setup
- Add `mise install` to postCreateCommand
- mise.toml ensures consistent versions across local + container environments

## CI/GitHub Actions

- Add mise installation step before tool usage
- mise can be cached like node_modules (cache key: `mise.toml` hash)
- Existing workflows continue to use npm/uv commands; mise just ensures correct versions available

## What NOT to Add

| Anti-Pattern | Why Avoid |
|--------------|-----------|
| mise tasks instead of justfiles | mise tasks are newer, less mature; just is purpose-built for command running with better syntax |
| Multiple task runners | Don't keep Make + just; choose one (just) to avoid confusion |
| Direct tool installation | Let mise manage versions; avoid `brew install node` or `apt install python` |
| .nvmrc + .python-version alongside mise.toml | Redundant; mise.toml is single source of truth |
| direnv + mise | mise `[env]` section replaces direnv functionality |
| Overly complex justfile modules | Start with single justfile; split only when >200 lines or clear domain boundaries |

## Verification

After setup, verify installation:
```bash
# mise installed and activated
mise --version  # Should show v2026.2.21 or newer

# All tools available
mise ls         # Should show node, python, uv, just, gum

# Tool versions correct
node --version  # Should be v22.x.x
python --version # Should be 3.11.x
uv --version    # Should show latest
just --version  # Should be 1.46.0
gum --version   # Should be 0.17.0

# Virtual environment auto-activated (when in project dir)
which python    # Should point to .venv/bin/python

# Environment variables loaded
echo $CROWDIN_PERSONAL_TOKEN  # Should show value from .env or mise vault
```

## Sources

### Official Documentation
- [mise-en-place Homepage](https://mise.jdx.dev/)
- [mise GitHub Releases](https://github.com/jdx/mise/releases) — v2026.2.21 (Feb 26, 2026)
- [mise Configuration](https://mise.jdx.dev/configuration.html)
- [mise Environments (env section)](https://mise.jdx.dev/environments/)
- [mise Shims](https://mise.jdx.dev/dev-tools/shims.html)
- [just Command Runner](https://just.systems/)
- [just Manual](https://just.systems/man/en/)
- [just GitHub Releases](https://github.com/casey/just/releases) — 1.46.0 (Jan 2, 2026)
- [just vs Make comparison](https://lwn.net/Articles/1047715/)
- [gum GitHub Repository](https://github.com/charmbracelet/gum) — v0.17.0 (Sep 5, 2025)

### Integration Guides
- [Mise + Python Cookbook](https://mise.jdx.dev/mise-cookbook/python.html)
- [Mise tool version management](https://oneuptime.com/blog/post/2026-01-25-mise-tool-version-management/view)
- [Mise env vars and tasks](https://mise.jdx.dev/tasks/running-tasks.html)
- [just + mise integration patterns](https://www.stuartellis.name/articles/just-task-runner/)
- [gum usage examples](https://hackaday.com/2023/03/29/linux-fu-gum-up-your-script/)
