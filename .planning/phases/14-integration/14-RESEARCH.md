# Phase 14: Integration - Research

**Researched:** 2026-02-26
**Domain:** CI/CD and development container integration for mise + just tooling
**Confidence:** HIGH

## Summary

Phase 14 integrates the mise + just foundation (from Phases 12-13) into CI workflows and the devcontainer. The research confirms that GitHub Actions can use `jdx/mise-action` for tool installation and that all workflow commands can be converted to call `just <recipe>` instead of inline bash. The devcontainer needs mise installed via its official feature and proper shell activation for persistent tool availability.

**Primary recommendation:** Use `jdx/mise-action@v2` in GitHub Actions workflows, replace all inline bash commands with `just <recipe>` calls that delegate to the modular just recipes already implemented in Phase 13, and update the devcontainer to use `ghcr.io/jdx/mise/mise:latest` feature with `mise trust && mise install && just setup` in `postCreateCommand`.

**Key findings:**
- mise-action v2 is the official GitHub Action maintained by mise creator (jdx)
- All existing workflow commands can be mapped to just recipes (already implemented in Phase 13)
- Gum's TTY detection (implemented in Phase 13) handles non-interactive CI environments gracefully
- Devcontainer features support mise via official `ghcr.io/jdx/mise/mise` feature
- Shell activation in devcontainer requires adding `mise activate` to shell RC files for persistent access

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CI-01 | GitHub Actions use mise-action + setup-just to mirror local dev | `jdx/mise-action@v2` installs mise and all tools from `.mise.toml`; no separate setup-just needed (mise manages just) |
| CI-02 | All CI workflow commands use `just <recipe>` instead of inline bash | Existing workflows have ~30 inline commands; all map to just recipes from Phase 13 (just dev::backend, just test::unit-backend, just db::init, just db::seed, etc.) |
| CI-03 | gum non-interactive fallback verified in all CI jobs | gum-helpers.sh `is_tty()` function (Phase 13) already provides fallback; CI has no TTY so gum commands echo plaintext |

**Devcontainer Requirements:**

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEVC-01 | Devcontainer uses mise feature for tool management | Official feature `ghcr.io/jdx/mise/mise:latest` available; replaces manual node/python features |
| DEVC-02 | postCreateCommand runs `mise trust && mise install && just setup` | Standard pattern for devcontainer setup; mise trust required on first use, mise install gets all tools, just setup runs existing setup recipe |
| DEVC-03 | Tools available in new terminal sessions (mise activation in shell RC) | mise activation needs to be added to .bashrc/.zshrc in container; devcontainer feature handles this automatically |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jdx/mise-action | v2 | GitHub Action for mise installation | Official mise GitHub Action maintained by creator; handles tool installation from .mise.toml |
| mise devcontainer feature | latest | Devcontainer feature for mise | Official feature from mise; auto-installs mise and activates in shell |
| just recipes | (existing) | Task definitions from Phase 13 | Already implemented in .just/*.just modules; provide CI-friendly commands |
| gum-helpers.sh | (existing) | TTY-aware UI helpers from Phase 13 | Already implements non-TTY fallback for CI environments |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/checkout | v6 | Checkout repository in workflows | Every workflow job that needs code |
| devcontainer CLI | latest | Test devcontainer builds in CI | Only in devcontainer.yaml workflow |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jdx/mise-action | Manual mise install via curl | mise-action caches tools, handles PATH setup, official support |
| just recipes in CI | Inline bash commands | just recipes are tested locally, provide consistency, self-documenting |
| mise devcontainer feature | Manual mise install in Dockerfile | Feature handles activation, updates automatically, less maintenance |
| mise for all tools | Separate actions/setup-node, setup-python | Fragmented vs unified; mise provides version consistency with local dev |

**Installation (GitHub Actions):**
```yaml
- uses: jdx/mise-action@v2
  with:
    install: true  # Runs mise install automatically
```

**Installation (Devcontainer):**
```json
{
  "features": {
    "ghcr.io/jdx/mise/mise:latest": {}
  }
}
```

## Architecture Patterns

### Pattern 1: GitHub Actions Workflow with mise-action
**What:** Replace tool-specific setup actions with mise-action, use just recipes for all commands
**When to use:** All CI workflows (ci.yaml, nightly.yaml, devcontainer.yaml, etc.)

**Example (before):**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v6
  with:
    node-version: '24'
- name: Install uv
  uses: astral-sh/setup-uv@v1
- name: Set up Python
  run: uv python install 3.11
- name: Install frontend dependencies
  working-directory: frontend
  run: npm ci
- name: Install backend dependencies
  working-directory: backend
  run: uv sync
```

**Example (after):**
```yaml
- name: Setup mise (installs all tools from .mise.toml)
  uses: jdx/mise-action@v2
  with:
    install: true
- name: Install dependencies
  run: just install
```

**Key points:**
- Single setup step replaces multiple tool-specific actions
- `install: true` runs `mise install` automatically
- All tools (node, python, uv, just, gum) come from `.mise.toml`
- Commands delegate to just recipes for consistency with local dev

**Source:** [mise-action README](https://github.com/jdx/mise-action)

### Pattern 2: CI Workflow Command Migration
**What:** Map inline bash commands to just recipe calls
**When to use:** All workflow jobs that run tests, builds, database operations

**Mapping table (from existing workflows to just recipes):**

| Current Workflow Command | Just Recipe | Module |
|-------------------------|-------------|--------|
| `cd frontend && npm ci` | `just install-frontend` | (root) |
| `cd backend && uv sync` | `just install-backend` | (root) |
| `cd frontend && npm run lint` | `just test::lint-frontend` | test |
| `cd backend && uv run ruff check .` | `just test::lint-backend` | test |
| `cd backend && uv run mypy app` | `just test::typecheck-backend` | test |
| `cd frontend && npm run test:run` | `just test::unit-frontend` | test |
| `cd backend && uv run pytest tests/ --cov=app` | `just test::coverage` | test |
| `cd frontend && npm run build` | `just dev::build-frontend` | dev |
| `cd backend && uv run python -m scripts.init_db` | `just db::init` | db |
| `cd backend && uv run python -m scripts.seed` | `just db::seed` | db |
| `docker compose -f docker-compose.dev.yaml build` | `just docker::build` | docker |
| `docker compose -f docker-compose.dev.yaml up -d` | `just docker::up` | docker |
| `npx playwright install --with-deps chromium` | `just test::install-e2e` | test |
| `npx playwright test --grep "@e2e"` | `just test::e2e` | test |

**Example transformation (ci.yaml frontend job):**
```yaml
# Before
- name: Install dependencies
  run: npm ci
- name: Generate pseudo-locale for i18n tests
  run: node scripts/generate-pseudo-locale.mjs
- name: Run linter
  run: npm run lint
- name: Run tests
  run: npm run test:run
- name: Build
  run: npm run build

# After
- name: Install dependencies
  run: just install-frontend
- name: Generate pseudo-locale
  run: just i18n::pseudo
- name: Run linter
  run: just test::lint-frontend
- name: Run tests
  run: just test::unit-frontend
- name: Build
  run: just dev::build-frontend
```

**Source:** Phase 13 justfile implementation, existing ci.yaml workflow

### Pattern 3: Devcontainer mise Integration
**What:** Use mise devcontainer feature instead of separate node/python features
**When to use:** .devcontainer/devcontainer.json configuration

**Example (before):**
```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "24"
    },
    "ghcr.io/devcontainers/features/python:1": {
      "version": "3.11"
    }
  },
  "postCreateCommand": "bash .devcontainer/post-create.sh"
}
```

**Example (after):**
```json
{
  "features": {
    "ghcr.io/jdx/mise/mise:latest": {}
  },
  "postCreateCommand": "mise trust && mise install && just setup"
}
```

**Key points:**
- Single mise feature replaces node + python features
- Tool versions come from `.mise.toml` (single source of truth)
- `mise trust` required on first container build (trusts .mise.toml)
- `mise install` installs all tools from .mise.toml
- `just setup` runs the existing setup recipe (install + db init + db seed)
- mise feature handles shell activation automatically

**Source:** [mise devcontainer integration](https://mise.jdx.dev/dev-tools/devcontainer.html)

### Pattern 4: post-create.sh Migration to just
**What:** Replace bash script with just recipe call
**When to use:** Devcontainer setup automation

**Example (before - .devcontainer/post-create.sh):**
```bash
#!/bin/bash
set -e
echo "🚀 Setting up Maxwell's Wallet development environment..."
make install
cd backend && uv run python -m scripts.init_db
cd ..
make db-seed
echo "✅ Development environment ready!"
```

**Example (after - postCreateCommand):**
```json
{
  "postCreateCommand": "mise trust && mise install && just setup"
}
```

**Rationale:**
- `just setup` already does install + db init + db seed (Phase 13)
- No need for separate bash script
- Single command, consistent with local dev workflow
- post-create.sh can be deleted in Phase 16 (Cleanup)

**Source:** Phase 13 justfile root setup recipe

### Pattern 5: TTY Detection in CI
**What:** Verify gum-helpers.sh fallback works in non-interactive CI
**When to use:** All workflows that call just recipes using gum

**Verification approach:**
```bash
# In CI workflow, verify gum commands fall back gracefully
- name: Test gum fallback
  run: |
    # CI has no TTY, so is_tty should return false
    source scripts/gum-helpers.sh
    if is_tty; then
      echo "ERROR: CI detected as TTY"
      exit 1
    fi
    # Gum commands should echo plaintext
    style 2 "Test message" | grep -q "Test message"
```

**Expected behavior:**
- `is_tty()` returns false in CI (no TTY)
- `spin()` echoes title and runs command (no spinner)
- `confirm()` returns default value (no prompt)
- `style()` echoes plaintext (no ANSI colors)
- `header()` echoes plaintext (no borders)

**Source:** Phase 13 scripts/gum-helpers.sh implementation

### Anti-Patterns to Avoid
- **Mixing tool setup methods:** Don't use mise-action AND actions/setup-node; choose mise for all tools
- **Duplicating commands:** Don't inline bash AND create just recipe; use just recipe everywhere
- **Skipping mise trust in devcontainer:** Container builds fail without `mise trust` in postCreateCommand
- **Hardcoding tool paths in workflows:** Never `/usr/local/bin/node`; let mise manage PATH
- **Removing working-directory from all jobs:** Some jobs still need it for artifact paths; only remove when using just recipes that handle directory changes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool installation in CI | Custom curl + install scripts | mise-action with .mise.toml | Caching, versioning, consistency with local dev |
| Test/build commands in workflows | Inline bash with cd commands | just recipes | Consistency, testability, self-documentation |
| Devcontainer tool setup | Multiple features + manual installs | mise feature + just setup | Single source of truth, less config duplication |
| CI environment detection | Custom TTY checks in each script | gum-helpers.sh `is_tty()` | Already implemented, tested, consistent |

**Key insight:** The tooling foundation (Phases 12-13) already provides everything needed for CI/devcontainer integration. Phase 14 is primarily configuration changes, not new code.

## Common Pitfalls

### Pitfall 1: mise-action Doesn't Install Tools Automatically
**What goes wrong:** Workflow adds `uses: jdx/mise-action@v2` but tools aren't available
**Why it happens:** Default behavior is to install mise only; `install: true` param needed to run `mise install`
**How to avoid:**
- Always use `install: true` parameter in mise-action
- Verify tools available: add `mise list` step to debug
**Warning signs:** `just: command not found` despite mise-action step passing

**Example:**
```yaml
# Wrong (mise installed but tools are not)
- uses: jdx/mise-action@v2

# Right (mise installed AND tools installed)
- uses: jdx/mise-action@v2
  with:
    install: true
```

**Source:** [mise-action documentation](https://github.com/jdx/mise-action#inputs)

### Pitfall 2: Forgetting mise trust in Devcontainer
**What goes wrong:** Devcontainer build fails with "mise config file not trusted" error
**Why it happens:** mise requires explicit trust of config files for security; fresh container = untrusted
**How to avoid:**
- Always run `mise trust` before `mise install` in postCreateCommand
- Use `--yes` flag or just `mise trust` (interactive not needed in container build)
**Warning signs:** `postCreateCommand` fails with trust-related error message

**Example:**
```json
// Wrong (mise install fails - config not trusted)
{
  "postCreateCommand": "mise install && just setup"
}

// Right (trust first)
{
  "postCreateCommand": "mise trust && mise install && just setup"
}
```

**Source:** [mise trust command](https://mise.jdx.dev/cli/trust.html)

### Pitfall 3: Just Recipes Fail in CI Due to Missing Context
**What goes wrong:** `just test::coverage` works locally but fails in CI with "file not found"
**Why it happens:** Recipe assumes working directory or relative paths; CI starts in repo root
**How to avoid:**
- All just recipes should use absolute paths or `cd` into correct directory
- Phase 13 already handles this (recipes cd into backend/frontend as needed)
- Verify: run `just <recipe>` from repo root locally before assuming CI will work
**Warning signs:** Recipe passes locally when run from subdirectory but fails in CI

**Example:**
```just
# Wrong (assumes already in backend/)
test-coverage:
  uv run pytest tests/ --cov=app

# Right (cd into backend first)
test-coverage:
  cd backend && uv run pytest tests/ --cov=app
```

**Source:** Phase 13 justfile implementation (.just/test.just)

### Pitfall 4: Removing All working-directory Directives
**What goes wrong:** Artifact upload paths break, coverage reports not found
**Why it happens:** Some workflow steps use `working-directory` for artifact path resolution
**How to avoid:**
- Keep `working-directory` in jobs that use `actions/upload-artifact` or `actions/upload-coverage`
- Can remove from individual steps that call just recipes
- Alternative: update artifact paths to be absolute instead of relative
**Warning signs:** Artifact upload step fails with "path not found"

**Example:**
```yaml
# Keep job-level working-directory for artifacts
backend:
  defaults:
    run:
      working-directory: backend  # Keep this for artifact paths
  steps:
    - name: Run tests with coverage
      run: just test::coverage  # No working-directory needed here
    - name: Upload coverage
      uses: codecov/codecov-action@v1
      with:
        files: ./backend/coverage.xml  # Path relative to working-directory
```

**Source:** Existing ci.yaml workflow artifact upload patterns

### Pitfall 5: Gum Commands Hang in CI
**What goes wrong:** Workflow step hangs forever on `gum confirm` prompt
**Why it happens:** gum-helpers.sh `is_tty()` check fails, tries interactive prompt in non-interactive CI
**How to avoid:**
- Verify gum-helpers.sh `is_tty()` implementation uses `[ -t 1 ]` (correct)
- Test recipes with gum commands in CI before merging
- Add timeout to workflow jobs as safety net: `timeout-minutes: 10`
**Warning signs:** Workflow runs for 6+ hours with no output on gum-using step

**Example (already correct from Phase 13):**
```bash
# scripts/gum-helpers.sh (correct implementation)
is_tty() {
  [ -t 1 ]  # Returns false in CI (no stdout TTY)
}

confirm() {
  local message="$1"
  local default="${2:-true}"
  if is_tty; then
    gum confirm "$message"  # Interactive (local dev)
  else
    # Non-interactive fallback (CI)
    if [ "$default" = "true" ]; then
      return 0
    else
      return 1
    fi
  fi
}
```

**Source:** Phase 13 scripts/gum-helpers.sh

## Code Examples

Verified patterns for Phase 14 implementation:

### Example 1: ci.yaml Workflow Transformation

**Before (partial ci.yaml):**
```yaml
frontend:
  name: Frontend Build & Test
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: frontend
  steps:
    - uses: actions/checkout@v6
    - name: Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version: '24'
        cache: npm
        cache-dependency-path: frontend/package-lock.json
    - name: Install dependencies
      run: npm ci
    - name: Generate pseudo-locale for i18n tests
      run: node scripts/generate-pseudo-locale.mjs
    - name: Run linter
      run: npm run lint
    - name: Run tests
      run: npm run test:run
    - name: Build
      run: npm run build
```

**After (with mise + just):**
```yaml
frontend:
  name: Frontend Build & Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Setup mise (installs all tools)
      uses: jdx/mise-action@v2
      with:
        install: true
    - name: Install dependencies
      run: just install-frontend
    - name: Generate pseudo-locale
      run: just i18n::pseudo
    - name: Run linter
      run: just test::lint-frontend
    - name: Run tests
      run: just test::unit-frontend
    - name: Build
      run: just dev::build-frontend
```

**Key changes:**
- Removed `defaults.run.working-directory` (just recipes handle directory changes)
- Replaced `actions/setup-node` with `jdx/mise-action@v2`
- Removed `node-version` and `cache` config (mise handles from .mise.toml)
- All commands replaced with `just <module>::<recipe>` calls
- Removed `env.GITHUB_TOKEN` from npm ci step (just install-frontend handles it)

**Source:** Existing ci.yaml + Phase 13 justfile

### Example 2: Backend Job Transformation

**Before:**
```yaml
backend:
  name: Backend Build & Test
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: backend
  steps:
    - uses: actions/checkout@v6
    - name: Install uv
      uses: astral-sh/setup-uv@v1
      with:
        version: latest
    - name: Set up Python
      run: uv python install 3.11
    - name: Install dependencies
      run: uv sync
    - name: Run linter (ruff)
      run: uv run ruff check .
    - name: Check for dead code (vulture)
      run: uv run vulture app
    - name: Run type checker (mypy)
      run: uv run mypy app
    - name: Run tests with coverage
      run: uv run pytest tests/ -v --cov=app --cov-report=xml
```

**After:**
```yaml
backend:
  name: Backend Build & Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Setup mise (installs all tools)
      uses: jdx/mise-action@v2
      with:
        install: true
    - name: Install dependencies
      run: just install-backend
    - name: Run linter
      run: just test::lint-backend
    - name: Check for dead code
      run: just test::dead-code
    - name: Run type checker
      run: just test::typecheck-backend
    - name: Run tests with coverage
      run: just test::coverage
```

**Key changes:**
- Removed `astral-sh/setup-uv` (mise installs uv from .mise.toml)
- Removed Python setup step (mise handles python 3.11)
- All commands replaced with just recipe calls
- Working directory handled by recipes (cd backend inside each)

**Source:** Existing ci.yaml + Phase 13 .just/test.just

### Example 3: E2E Job Transformation

**Before:**
```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version: '24'
    - name: Install uv
      uses: astral-sh/setup-uv@v1
    - name: Set up Python
      run: uv python install 3.11
    - name: Install backend dependencies
      working-directory: backend
      run: uv sync
    - name: Create data directory
      working-directory: backend
      run: mkdir -p data
    - name: Initialize database schema
      working-directory: backend
      run: uv run python -m scripts.init_db
    - name: Seed database
      working-directory: backend
      run: uv run python -m scripts.seed
    - name: Install frontend dependencies
      working-directory: frontend
      run: npm ci
    - name: Install Playwright browsers
      working-directory: frontend
      run: npx playwright install --with-deps chromium
    - name: Run E2E tests
      working-directory: frontend
      run: npx playwright test --grep "@e2e"
```

**After:**
```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Setup mise (installs all tools)
      uses: jdx/mise-action@v2
      with:
        install: true
    - name: Install dependencies
      run: just install
    - name: Initialize and seed database
      run: |
        just db::init
        just db::seed
    - name: Install Playwright browsers
      run: just test::install-e2e
    - name: Run E2E tests
      run: just test::e2e
```

**Key changes:**
- Single mise-action replaces node + uv setup
- `just install` replaces separate backend + frontend installs
- `just db::init` and `just db::seed` replace manual Python scripts
- `just test::install-e2e` replaces playwright install command
- `just test::e2e` replaces npx playwright test
- All working-directory directives removed (recipes handle it)

**Source:** Existing ci.yaml + Phase 13 justfile

### Example 4: Docker Job Transformation

**Before:**
```yaml
docker:
  name: Docker Build & Smoke Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Cleanup any existing containers
      run: docker compose -f docker-compose.dev.yaml down -v --remove-orphans 2>/dev/null || true
    - name: Build all-in-one image
      run: docker compose -f docker-compose.dev.yaml build
    - name: Test migrate command
      run: docker compose -f docker-compose.dev.yaml run -T --rm maxwells-wallet migrate
    - name: Test seed command
      run: docker compose -f docker-compose.dev.yaml run -T --rm maxwells-wallet seed
    - name: Start container and verify health
      run: |
        docker compose -f docker-compose.dev.yaml up -d
        # ... health check logic ...
```

**After:**
```yaml
docker:
  name: Docker Build & Smoke Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Setup mise
      uses: jdx/mise-action@v2
      with:
        install: true
    - name: Cleanup existing containers
      run: just docker::down
    - name: Build image
      run: just docker::build
    - name: Test migrate command
      run: just docker::test-migrate
    - name: Test seed command
      run: just docker::test-seed
    - name: Start and verify health
      run: just docker::smoke
```

**Key changes:**
- Added mise-action for consistency (just binary available)
- All docker-compose commands replaced with just recipes
- Health check logic moved into `just docker::smoke` recipe
- Cleaner workflow file (logic in recipes, not inline bash)

**Source:** Existing ci.yaml + Phase 13 .just/docker.just

### Example 5: Devcontainer Configuration

**Before (.devcontainer/devcontainer.json):**
```json
{
  "name": "Maxwell's Wallet",
  "build": {
    "dockerfile": "Dockerfile",
    "context": ".."
  },
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "24"
    },
    "ghcr.io/devcontainers/features/python:1": {
      "version": "3.11"
    },
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "postCreateCommand": "bash .devcontainer/post-create.sh",
  "remoteUser": "vscode"
}
```

**After:**
```json
{
  "name": "Maxwell's Wallet",
  "build": {
    "dockerfile": "Dockerfile",
    "context": ".."
  },
  "features": {
    "ghcr.io/jdx/mise/mise:latest": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "postCreateCommand": "mise trust && mise install && just setup",
  "remoteUser": "vscode"
}
```

**Key changes:**
- Replaced node + python features with single mise feature
- Tool versions now come from `.mise.toml` (single source of truth)
- `postCreateCommand` runs `mise trust && mise install && just setup`
- Removed reference to post-create.sh (can be deleted in Phase 16)
- Keep github-cli feature (not managed by mise currently)

**Source:** [mise devcontainer docs](https://mise.jdx.dev/dev-tools/devcontainer.html)

### Example 6: Devcontainer Workflow Update

**Before (.github/workflows/devcontainer.yaml):**
```yaml
- name: Start devcontainer and run tests
  run: |
    CONTAINER_ID=$(...)
    # Test Node.js version
    docker exec "$CONTAINER_ID" node --version | grep -q "v22"
    # Test Python version
    docker exec "$CONTAINER_ID" python --version | grep -q "3.11"
    # Test uv is installed
    docker exec "$CONTAINER_ID" bash -c 'uv --version'
    # Test make is available
    docker exec "$CONTAINER_ID" make --version
```

**After:**
```yaml
- name: Start devcontainer and run tests
  run: |
    CONTAINER_ID=$(...)
    # Test mise and tools installed
    docker exec "$CONTAINER_ID" mise --version
    docker exec "$CONTAINER_ID" node --version | grep -q "v22"
    docker exec "$CONTAINER_ID" python --version | grep -q "3.11"
    docker exec "$CONTAINER_ID" uv --version
    docker exec "$CONTAINER_ID" just --version
    docker exec "$CONTAINER_ID" gum --version
```

**Key changes:**
- Added mise version check
- Replaced make with just
- Added gum version check
- All tools should be available via mise

**Source:** Existing devcontainer.yaml workflow

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple setup actions per workflow | Single mise-action for all tools | 2024-2026 | Simpler workflows, faster caching, version consistency |
| Inline bash commands in workflows | just recipe calls | 2023-2026 | Testable locally, self-documenting, consistent with dev workflow |
| Separate node/python devcontainer features | Single mise devcontainer feature | 2025-2026 | Single source of truth for versions, less config duplication |
| Manual tool installation in post-create.sh | mise install + just setup | 2026 | Declarative, automated, idempotent |

**Deprecated/outdated:**
- **actions/setup-node + actions/setup-python:** Still work but fragmented; mise-action provides unified approach
- **Manual docker-compose commands in workflows:** Still work but verbose; just recipes provide cleaner abstraction
- **Separate .devcontainer features per language:** mise feature consolidates tool management

## Open Questions

1. **mise-action caching effectiveness**
   - What we know: mise-action has built-in caching for tools
   - What's unclear: Cache hit rate compared to actions/setup-node caching
   - Recommendation: Measure CI time before/after migration; monitor for cache misses

2. **Devcontainer mise feature stability**
   - What we know: Official mise devcontainer feature exists and is maintained
   - What's unclear: Feature update frequency, breaking change policy
   - Recommendation: Pin to specific version tag if stability issues arise; use `latest` initially

3. **just recipe error messages in CI**
   - What we know: just provides clear error messages with recipe names
   - What's unclear: GitHub Actions log formatting; whether stack traces are readable
   - Recommendation: Test error scenarios in CI before merging; may need to add set -x for debugging

4. **Workflow execution time changes**
   - What we know: mise caches tools, just recipes reduce command overhead
   - What's unclear: Net impact on total workflow time (setup vs execution)
   - Recommendation: Benchmark main branch vs Phase 14 branch; optimize if regression

## Implementation Notes

### Workflow Files to Update

| File | Changes | Just Recipes Used |
|------|---------|------------------|
| `.github/workflows/ci.yaml` | Replace setup-node/setup-uv with mise-action; convert all commands to just recipes | install-frontend, install-backend, test::*, db::*, dev::build-frontend |
| `.github/workflows/nightly.yaml` | Add mise-action; convert audit/quality commands to just recipes | test::lint-backend, test::typecheck-backend, test::dead-code, test::coverage |
| `.github/workflows/devcontainer.yaml` | Add mise version check | (none - just binary check) |
| `.github/workflows/nightly-e2e.yaml` | Add mise-action; convert e2e commands | install, db::init, db::seed, test::install-e2e, test::e2e |
| `.github/workflows/nightly-chaos.yaml` | Add mise-action; convert chaos test commands | install, db::init, db::seed, test::install-e2e, test::chaos |
| `.github/workflows/nightly-performance.yaml` | Add mise-action; convert perf test commands | install-backend, test::performance |
| `.github/workflows/weekly-endurance.yaml` | Add mise-action; convert endurance commands | install, db::init, db::seed, test::endurance |

### Devcontainer Files to Update

| File | Changes |
|------|---------|
| `.devcontainer/devcontainer.json` | Replace node/python features with mise; update postCreateCommand |
| `.devcontainer/post-create.sh` | Mark for deletion in Phase 16 (replaced by just setup) |

### Verification Tests

After implementation, verify:
1. All CI workflows pass with mise-action + just recipes
2. Devcontainer builds successfully and all tools available
3. New terminal in devcontainer has mise-managed tools in PATH
4. No workflow regressions (build time, test time, artifact uploads)
5. Gum commands in just recipes produce clean output in CI logs (no ANSI escape codes)

## Sources

### Primary (HIGH confidence)
- [mise-action GitHub Repository](https://github.com/jdx/mise-action) - Official GitHub Action for mise
- [mise-action Inputs Documentation](https://github.com/jdx/mise-action#inputs) - Configuration options
- [mise Devcontainer Integration](https://mise.jdx.dev/dev-tools/devcontainer.html) - Official devcontainer feature docs
- [mise Trust Command](https://mise.jdx.dev/cli/trust.html) - Security model for config files
- Phase 13 Implementation - All just recipes already exist in .just/*.just modules
- Phase 13 gum-helpers.sh - TTY detection and fallback patterns

### Secondary (MEDIUM confidence)
- [GitHub Actions Environment Variables](https://docs.github.com/en/actions/learn-github-actions/environment-variables) - CI environment details
- [Devcontainers Features Spec](https://containers.dev/implementors/features/) - Feature installation model
- Existing ci.yaml workflow - Current commands and structure

### Tertiary (LOW confidence)
- Community blog posts on mise in CI (2025-2026) - Varies by source quality
- GitHub Discussions on mise-action caching - Some anecdotal performance data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - mise-action is official, devcontainer feature is official, just recipes already exist
- Architecture: HIGH - Patterns verified with official docs and existing Phase 13 implementation
- Pitfalls: MEDIUM-HIGH - Based on mise docs + common CI issues; some edge cases not documented

**Research date:** 2026-02-26
**Valid until:** ~90 days (mise/just ecosystem stable; GitHub Actions changes infrequent)
