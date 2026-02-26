# Pitfalls Research

**Domain:** Build System Modernization (Make → Just + gum + mise)
**Researched:** 2026-02-26
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Just Shell Variable Scope Trap

**What goes wrong:**
Developers expect shell variables to persist across recipe lines, but they don't. Every recipe line runs in a new shell instance, so variables set in one line are undefined in the next.

**Why it happens:**
Make executes recipes in a single shell session (with `.ONESHELL:`), so developers expect just to behave similarly. The muscle memory from Make misleads them. Both tools actually spawn new shells per line by default, but Make users often forget this.

**How to avoid:**
- Use shebang recipes (`#!/usr/bin/env bash` at top) for multi-line shell logic
- Chain commands on single line with `&&`: `x=hello && echo $x`
- Use just variables (`:=`) instead of shell variables when possible
- Document this clearly in migration guide
- Set `set shell := ["bash", "-c"]` at top of justfile

**Warning signs:**
- Recipes with `export VAR=value` on one line and `echo $VAR` on another
- Conditional logic split across multiple lines without shebang
- Scripts that work in Make but fail silently in just

**Phase to address:**
Phase 2 (Justfile Migration) — Add shebang examples to initial justfile, document in CLAUDE.md

---

### Pitfall 2: Gum in Non-TTY Environments (CI/Docker)

**What goes wrong:**
Gum commands fail or produce garbled output in CI pipelines and Docker builds where no TTY is available. Interactive commands hang waiting for input that will never come.

**Why it happens:**
Gum is designed for interactive terminals. While it has some TTY detection and ANSI stripping (introduced in v0.11.0), certain commands like `gum confirm`, `gum input`, `gum choose` still block waiting for input. CI environments and Docker containers lack TTY by default.

**How to avoid:**
- Detect TTY before calling gum: `if [ -t 0 ]; then gum spin ... else echo "..."; fi`
- Check for CI environment variable: `if [ -n "$CI" ]; then echo "..."; else gum style "..."; fi`
- Use environment variables for interactive prompt defaults:
  ```bash
  if [ -t 0 ]; then
      ENV=$(gum choose "dev" "staging" "prod")
  else
      ENV="${DEPLOY_ENV:-dev}"
  fi
  ```
- Provide non-gum fallback for all justfile recipes that use gum
- Test every gum command in CI environment before deploying
- Use `gum format` and `gum style` (output-only) instead of interactive commands where possible

**Warning signs:**
- CI jobs hang indefinitely on gum commands
- Docker builds fail with "input device is not a TTY" errors
- Justfile recipes work locally but timeout in GitHub Actions
- No error message, just frozen pipeline execution

**Phase to address:**
Phase 4 (gum Integration) — Add TTY detection wrapper; verify all gum usage in CI workflows before cleanup phase

---

### Pitfall 3: Mise Activation Not Persisting in Devcontainer

**What goes wrong:**
Tools installed via mise aren't available in devcontainer shells even after `mise install` succeeds. Commands like `just` or `gum` are not found.

**Why it happens:**
mise requires shell activation (`eval "$(mise activate bash)"`) to add tools to PATH. If activation isn't in shell RC files (.bashrc, .zshrc), tools won't be available in new shell sessions. Devcontainer postCreateCommand runs in one shell, but user terminals spawn new shells.

**How to avoid:**
- Add mise activation to shell RC files in Dockerfile:
  ```dockerfile
  RUN echo 'eval "$(mise activate bash)"' >> /home/vscode/.bashrc && \
      echo 'eval "$(mise activate zsh)"' >> /home/vscode/.zshrc
  ```
- Use `postCreateCommand: "mise trust && mise install"`
- Set mise environment variables in Dockerfile (MISE_DATA_DIR, MISE_CACHE_DIR)
- Test by opening a new shell in devcontainer after build
- Ensure mise activation is LAST in shell RC (for PATH priority)

**Warning signs:**
- `mise list` shows tools installed but `which just` returns nothing
- Tools work in postCreateCommand but not in new terminal sessions
- Error: "command not found" for tools that should be installed
- `mise doctor` shows activation warnings

**Phase to address:**
Phase 3 (Devcontainer Transition) — Update Dockerfile and devcontainer.json; verify shell activation; add mise doctor check

---

### Pitfall 4: Just Recipe Argument Splitting

**What goes wrong:**
Arguments with spaces break when passed to just recipes. Running `just import "bank statement.csv"` treats "bank" and "statement.csv" as two separate arguments instead of one filename.

**Why it happens:**
Just interpolates `{{arg}}` into shell commands without preserving quotes. The shell sees `bank statement.csv` (unquoted) and splits on whitespace. This is a major difference from Make's variable handling.

**How to avoid:**
1. **Use positional arguments with proper quoting (recommended):**
   ```justfile
   # At top of justfile
   set positional-arguments

   import file:
       #!/usr/bin/env bash
       python import.py "$1"
   ```

2. **Manually quote interpolations (simple cases only):**
   ```justfile
   import file:
       python import.py "{{file}}"
   ```

3. **Export as environment variable for complex strings:**
   ```justfile
   import file:
       #!/usr/bin/env bash
       export FILE="{{file}}"
       python import.py "$FILE"
   ```

**Warning signs:**
- File not found errors for filenames with spaces
- Commands receive wrong number of arguments
- Works with single-word filenames but breaks with multi-word names
- Migration from Make breaks existing workflows

**Phase to address:**
Phase 2 (Justfile Migration) — Establish argument handling patterns in initial recipes; document in CONTRIBUTING.md and CLAUDE.md

---

### Pitfall 5: Mise Trust Model in Team Environments

**What goes wrong:**
New team members clone the repo and see `mise ERROR Config files in .mise.toml are not trusted`. They don't run `mise trust`, tools don't install, and they waste hours debugging "command not found" errors or fall back to manual installation (bypassing mise entirely).

**Why it happens:**
mise's security model requires explicit trust of config files to prevent arbitrary code execution from untrusted repositories. Global configs (~/.config/mise/config.toml) are auto-trusted, but project-local .mise.toml files require manual `mise trust`.

**How to avoid:**
1. **Add trust step to onboarding docs:**
   ```markdown
   ## Setup
   1. Clone repo: `git clone ...`
   2. Trust mise config: `mise trust`
   3. Install tools: `mise install`
   ```

2. **Update devcontainer postCreateCommand:**
   ```json
   "postCreateCommand": "mise trust && mise install && just setup"
   ```

3. **Add trusted_config_paths to global config (for team repos):**
   ```toml
   # ~/.config/mise/config.toml
   trusted_config_paths = [
       "~/Code/github.com/poindexter12/*"
   ]
   ```

4. **Check mise doctor output in CI:**
   ```yaml
   - name: Verify mise setup
     run: |
       mise trust
       mise doctor
       mise ls
   ```

**Warning signs:**
- "command not found: node" despite mise.toml specifying node
- `mise ls` shows empty tool list
- Developers manually running `brew install node` (bypassing mise)
- Inconsistent tool versions across team
- mise doctor shows "Config files not trusted"

**Phase to address:**
Phase 1 (Core Tool Setup) — Add trust checks to devcontainer, update README, test with fresh clone

---

### Pitfall 6: Breaking CI During Transition

**What goes wrong:**
CI pipelines fail immediately after switching from Make to just because workflows still call `make test` but Makefile has been deleted. Production deployments break. Emergency rollback required.

**Why it happens:**
The migration is all-or-nothing instead of gradual. Developers update local justfile, delete Makefile, commit both in one PR. CI hasn't been updated yet. Between merge and CI update, the main branch is broken.

**How to avoid:**
1. **Parallel existence period (recommended):**
   - Phase 2: Add justfile alongside Makefile
   - Phase 3-4: Migrate recipes incrementally, test both
   - Phase 5: Update CI to use just
   - Phase 6: Delete Makefile only after CI is green

2. **Update CI with fallback first:**
   ```yaml
   # .github/workflows/test.yml
   - name: Run tests
     run: |
       if [ -f justfile ]; then
         just test
       else
         make test
       fi
   ```

3. **Migration checklist before Makefile deletion:**
   - [ ] All CI workflows updated and green
   - [ ] Devcontainer postCreateCommand updated and tested
   - [ ] README updated with just commands
   - [ ] All AI agent instructions (CLAUDE.md) updated
   - [ ] Team notified of change
   - [ ] At least one successful deploy with just

**Warning signs:**
- CI fails with "make: command not found" or "No rule to make target 'test'"
- Devcontainer fails to build after pull
- New team members can't set up project
- Production deployments fail

**Phase to address:**
Spans Phases 2-6 — Maintain parallel operation until Phase 5 CI migration is complete and verified; coordinate deletion

---

### Pitfall 7: Incomplete Documentation Updates

**What goes wrong:**
After migration, scattered references to `make` commands remain in docs, CLAUDE.md, README, commit messages, and CI comments. Contributors follow stale instructions and get confused when `make test` no longer exists.

**Why it happens:**
Documentation is spread across 15+ files. Search-and-replace misses context-specific references (e.g., "make sure to run tests" vs. "make test"). Contributors have muscle memory for `make` commands.

**How to avoid:**
- Audit ALL documentation before deleting Makefile:
  - `git grep -i "make " -- '*.md'` (include trailing space)
  - `git grep -i "\`make" -- '*.md'` (backtick-wrapped)
  - Check: README, CLAUDE.md, docs/, .github/, CONTRIBUTING, PR templates, issue templates
  - Search for: backtick-wrapped `make`, "run make", "using make", "with make"
- Create alias/wrapper script during transition: `make -> just --justfile justfile`
- Add deprecation notice at top of Makefile before deletion
- Update all CI workflow comments that reference make targets
- Update VSCode tasks.json
- Check pre-commit hooks

**Warning signs:**
- New contributors ask "where's the Makefile?"
- GitHub issues reference `make` commands that don't exist
- CI workflows have comments like "# Run make test" above `just test`
- VSCode task runner fails

**Phase to address:**
Phase 5 (Documentation Sweep) — Dedicated phase for doc updates; use grep audit checklist; verify all references

---

### Pitfall 8: Mise PATH Ordering Conflicts (mise vs direnv vs manual installs)

**What goes wrong:**
Tools installed via brew/apt appear before mise-managed versions in PATH, causing wrong versions to run. Developer expects Node 22 (from mise.toml) but gets Node 18 (from Homebrew).

**Why it happens:**
Multiple tool managers compete for PATH priority. mise official docs warn: "because [mise and direnv] both analyze the current environment variables before and after their respective hook commands are run, they can sometimes conflict."

**How to avoid:**
1. **Choose ONE tool manager (mise), remove others:**
   ```bash
   # Uninstall competing version managers
   brew uninstall nvm
   brew uninstall pyenv
   # Remove direnv if not needed
   # If direnv is needed for secrets, use mise integration
   ```

2. **Use mise activate LAST in shell init:**
   ```zsh
   # ~/.zshrc
   # ... other setup ...
   eval "$(mise activate zsh)"  # Last line to ensure PATH priority
   ```

3. **Enable aggressive PATH mode if needed:**
   ```bash
   export MISE_ACTIVATE_AGGRESSIVE=1
   eval "$(mise activate zsh)"
   ```

4. **If using direnv for secrets, use mise integration:**
   ```bash
   # .envrc
   use mise
   # ... secret exports ...
   ```

5. **Verify PATH order:**
   ```bash
   mise doctor  # Check for activation issues
   which -a node  # List all node binaries in PATH order
   ```

**Warning signs:**
- `node --version` shows different version than `mise.toml`
- `which node` points to /usr/local/bin instead of ~/.local/share/mise/installs
- mise doctor shows activation warnings or PATH conflicts
- Inconsistent tool versions between terminal sessions

**Phase to address:**
Phase 1 (Core Tool Setup) — Document PATH management, add verification step to setup script; coordinate direnv strategy

---

### Pitfall 9: .env Secret Leakage

**What goes wrong:**
`.env` files containing production secrets get committed to git, exposing API keys, database passwords, and tokens. Just's automatic `.env` loading encourages use of .env files, increasing risk.

**Why it happens:**
just automatically loads `.env` files (convenient feature) but developers forget to add `.env` to `.gitignore`. Unlike environment variables set manually, .env files are easy to accidentally commit. When migrating from Make (which didn't have .env loading), developers create .env files without realizing the risk.

**How to avoid:**
1. **Add .env to .gitignore immediately (BEFORE creating any .env files):**
   ```gitignore
   # .gitignore
   .env
   .env.local
   .env.*.local
   !.env.example
   ```

2. **Use .env.example as template:**
   ```bash
   # .env.example (committed)
   DATABASE_URL=postgresql://localhost/mydb
   API_KEY=your_api_key_here

   # .env (not committed)
   DATABASE_URL=postgresql://localhost/real_db
   API_KEY=sk-real-key-here
   ```

3. **Verify .env is ignored before committing:**
   ```bash
   git status --ignored | grep .env
   ```

4. **Use git hooks to prevent .env commits:**
   ```bash
   # .git/hooks/pre-commit
   if git diff --cached --name-only | grep -q "^\.env$"; then
       echo "ERROR: Attempting to commit .env file!"
       exit 1
   fi
   ```

5. **Integration with direnv (if used alongside mise):**
   - Keep secrets in .envrc (direnv-managed, gitignored)
   - Use .env only for just-specific non-secret config
   - Don't duplicate between .env and .envrc

**Warning signs:**
- `.env` appears in `git status`
- `.env` in GitHub search for your repo
- Secret scanning alerts from GitHub
- Production credentials visible in commit history

**Phase to address:**
Phase 1 (Core Tool Setup) — Add .env to .gitignore BEFORE creating any .env files; add pre-commit hook; document secret management

---

### Pitfall 10: Forgotten Make Targets

**What goes wrong:**
Obscure Make targets used by specific developers or CI jobs don't get migrated to just. Months later, a rarely-used workflow breaks because `just release-notes` doesn't exist (but `make release-notes` did).

**Why it happens:**
Migration focuses on common targets (dev, test, build) used daily. Infrequent targets (release-notes, security-scan, db-backup) are overlooked because they're not in active use during migration. No comprehensive inventory of all Make targets is created.

**How to avoid:**
1. **Audit all Make targets before migration:**
   ```bash
   # List all targets in Makefile
   grep -E "^[a-zA-Z0-9_-]+:" Makefile make/*.mk | cut -d: -f1 | sort -u > targets-inventory.txt
   ```

2. **Check CI workflows for target usage:**
   ```bash
   # Find all make calls in GitHub Actions
   grep -r "make " .github/workflows/
   ```

3. **Search codebase for make invocations:**
   ```bash
   # Find scripts calling make
   rg "make [a-z-]+" --type sh --type bash
   ```

4. **Migration checklist per target:**
   - [ ] Target identified (from audit)
   - [ ] Usage verified (CI/docs/scripts)
   - [ ] Migrated to just
   - [ ] Tested in target environment
   - [ ] Callers updated (if target name changed)

5. **Temporary forwarding during transition:**
   ```justfile
   # Deprecated targets with warnings
   release-notes:
       @echo "WARNING: Use 'just changelog' instead"
       just changelog
   ```

**Warning signs:**
- "No rule to make target 'X'" errors after migration
- CI job failures on release branches (use different targets than main)
- Developer asks "where did the X command go?"
- Documentation references make targets that don't exist in justfile
- ~60 Make targets → only 40 just recipes (missing 20)

**Phase to address:**
Phase 2 (Justfile Migration) — Complete target audit BEFORE migration starts; maintain checklist; verify 100% coverage

---

### Pitfall 11: Just Default Shell Differences

**What goes wrong:**
Recipes that work in Make fail in just due to shell differences. Bash-specific syntax breaks when just uses sh as default shell on some systems.

**Why it happens:**
Make uses `/bin/sh` by default but can be overridden with `SHELL=/bin/bash`. just uses `sh` on Unix by default. Bash-specific features (arrays, `[[` conditionals, `source` command) fail in sh.

**How to avoid:**
1. **Explicitly set shell in justfile:**
   ```justfile
   # At top of justfile
   set shell := ["bash", "-c"]
   ```

2. **Use shebang for complex recipes:**
   ```justfile
   deploy:
       #!/usr/bin/env bash
       set -euo pipefail
       # Bash-specific code here
   ```

3. **Use POSIX-compatible syntax in simple recipes:**
   ```justfile
   # Good (POSIX)
   check:
       [ -f file.txt ] && echo "exists" || echo "missing"

   # Avoid (Bash-specific)
   check:
       [[ -f file.txt ]] && echo "exists"
   ```

**Warning signs:**
- "syntax error near unexpected token" in recipes
- `source .env` fails (use `. .env` in sh)
- Array operations fail
- Recipes work locally (macOS/bash) but fail in CI (Linux/sh)

**Phase to address:**
Phase 2 (Justfile Migration) — Set shell globally in justfile header; test on Linux CI; document in CONTRIBUTING.md

---

### Pitfall 12: Mise Version Pinning Not Enforced

**What goes wrong:**
Team members get different tool versions despite having mise.toml. One developer has Node 22.1.0, another has 22.8.0. Tests pass locally but fail in CI or for other developers.

**Why it happens:**
mise.toml with `node = "22"` uses flexible versioning by default (latest 22.x). Without explicit pinning or mise.lock file, developers get whatever latest version is available when they run `mise install`.

**How to avoid:**
- Pin exact versions: `mise use --pin node@22.1.0` (saves 22.1.0, not 22)
- OR use mise.lock file: `experimental_lockfile = true` in mise.toml
- Document pinning requirement in setup docs
- CI should verify versions match: `mise current | diff - .mise-versions-expected`
- Add mise.lock to git and keep it updated

**Warning signs:**
- "Works on my machine" issues that correlate with tool versions
- CI uses different versions than local despite both using mise
- Subtle behavior differences between team members' environments
- `mise current` shows different versions across team

**Phase to address:**
Phase 1 (Core Tool Setup) — Pin exact versions in initial mise.toml; decide on lockfile vs. pinned versions strategy

---

### Pitfall 13: Just Directory Search Confusion

**What goes wrong:**
Developers run `just` from subdirectories expecting it to fail (like make), but just searches parent directories until it finds a justfile. This causes unexpected recipe execution in wrong context or with wrong working directory.

**Why it happens:**
Make only searches current directory for Makefile. Just reverses up the directory tree (like git) until it finds a justfile. This is a feature (monorepo-friendly) but surprises Make users.

**How to avoid:**
- Document just's parent directory search behavior prominently
- Use `[no-cd]` attribute for recipes that should run from invocation directory
- Set `fallback := false` in justfile to disable parent search if undesired
- Be explicit about working directory in recipe comments
- Test recipes from various subdirectories

**Warning signs:**
- Recipes succeed when run from root but fail from subdirectories (or vice versa)
- Recipes operate on wrong files due to unexpected working directory
- Confusion about which justfile is being executed
- `just --list` shows recipes when run from subdirectory (unexpected)

**Phase to address:**
Phase 2 (Justfile Migration) — Configure fallback setting; document working directory behavior; add tests

---

### Pitfall 14: Docker Production Builds Include Development Tools

**What goes wrong:**
Production Docker images bloat from 150MB to 1.1GB because they include mise, just, gum, and all development tooling. Attack surface increases unnecessarily.

**Why it happens:**
Developers use a single-stage Dockerfile that installs mise for development convenience. Production doesn't need tool version managers or task runners—only the built application.

**How to avoid:**
- Use multi-stage Docker builds: dev stage with mise, production stage without
- Production stage: COPY built artifacts only, no mise/just/gum
- Only install runtime dependencies (Node for Next.js, Python for FastAPI)
- Use `.dockerignore` to exclude mise config files from production builds
- Verify production image: `docker run --rm <image> which mise` should fail

**Warning signs:**
- Production image size > 500MB for a simple app
- `docker run <prod-image> mise list` succeeds (shouldn't)
- Security scans flag mise/just binaries in production images
- mise.toml and justfile present in production image layers

**Phase to address:**
Phase 6 (Docker/Deployment) — Update Dockerfile to multi-stage; verify production image contents; document separation

---

### Pitfall 15: .PHONY Cruft Left in Justfile

**What goes wrong:**
Developers port Makefiles to justfiles and leave `.PHONY:` declarations at the top. While just ignores them, they clutter the file and signal incomplete migration.

**Why it happens:**
Make requires `.PHONY: target` for non-file targets. Just treats all recipes as commands (not build artifacts), so .PHONY is unnecessary. Copy-paste migration brings it along.

**How to avoid:**
- Remove ALL `.PHONY:` declarations during conversion
- Remove Make-specific directives: `.DEFAULT_GOAL`, `.SUFFIXES`, pattern rules, `%` wildcards
- Use just's native features instead: recipe parameters, dependencies, settings
- Review converted justfile for Make-isms before committing
- Run automated check: `grep -n "\.PHONY\|\.DEFAULT_GOAL\|\.SUFFIXES" justfile`

**Warning signs:**
- `.PHONY:` anywhere in justfile
- Comments like `# Phony targets` or `# Not actual files`
- Recipes that look like Make pattern rules (`%.o: %.c`)
- `.DEFAULT_GOAL` or other Make directives

**Phase to address:**
Phase 2 (Justfile Migration) — Explicit cleanup step; include in migration checklist; automated verification

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip mise.lock / version pinning | Faster setup, fewer files | Version drift, "works on my machine" bugs | Never—pinning is cheap |
| Keep Makefile alongside justfile indefinitely | Gradual migration, less disruption | Dual maintenance, confusion about which to use | Acceptable for 1-2 sprints max during active migration |
| Use gum everywhere without TTY fallbacks | Beautiful local DX | CI failures, Docker build issues | Never—always provide fallback |
| Single justfile recipe calls old make target | Incremental migration | Hidden dependency on Make, incomplete transition | Only during active migration phase (Phases 2-5) |
| Hard-code tool versions in justfile instead of mise | Simple, no mise dependency | Manual updates, version drift | Never for team projects; small solo projects only |
| Skip devcontainer migration, use mise locally only | Less work upfront | Local-only benefit, onboarding friction | Never for team projects with devcontainer |
| Use `set positional-arguments` everywhere | Avoids quoting issues | Loses just's typo detection, harder to read | When recipe has args with spaces; document pattern |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Actions | Call `just` without installing it first | Use `extractions/setup-just` action or mise-action with caching |
| VSCode Tasks | Reference `make` in tasks.json | Update tasks to call `just <recipe>`, test task runner UI |
| Pre-commit hooks | Assume make is available | Install just via mise in hook environment or use direct commands |
| Docker Compose | Mount mise config into containers expecting it to work | Either commit to mise in container OR use standard tool installation |
| Git hooks (husky/etc) | Call justfile recipes without checking if just installed | Guard with `command -v just \|\| make fallback` during transition |
| IDE test runners | Hard-code paths to node/python | Use `mise exec -- node` or ensure mise shims are in IDE PATH |
| mise + direnv | Running both simultaneously, PATH conflicts | Use mise only, or mise's direnv integration (`use mise` in .envrc) |
| just .env loading + direnv | Duplicate env vars in .env and .envrc | Choose one: .envrc for secrets (direnv), .env for just-specific config |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| mise install on every CI run | Slow CI (adds 30-60s per job) | Cache mise installs with GitHub Actions cache, use mise-action with caching | Every CI run without cache config |
| Running gum style for every log line | Slow justfile execution, noticeable lag | Batch output, use gum format once for whole output, echo in loops | Recipes with 100+ log lines |
| Just dependency graph recalculation | Slow startup for recipes with many deps | Keep dependency trees shallow (<3 levels), use prior dependencies sparingly | Deep dependency chains (5+ levels) |
| mise trust prompt in automation | Hangs waiting for y/n input in CI | Use `mise trust` in CI setup, add to postCreateCommand | Any automated script/CI without trust |
| Docker builds reinstalling mise every layer | Slow builds, layer cache invalidation | Install mise in early layer, COPY mise.toml separately, use multi-stage | Every code change triggers mise reinstall |
| GitHub Actions: install.sh rate limiting | Job fails downloading just/gum releases | Use `extractions/setup-just`, cache binaries, or specify `--tag` for install.sh | High-frequency CI runs, shared IPs |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not adding .env to .gitignore | Secret exposure in git history, public repos | Add `.env` to `.gitignore` BEFORE creating any .env files; add pre-commit hook |
| Auto-trusting mise.toml without review | Arbitrary code execution from malicious repos | Review mise.toml before `mise trust`; use paranoid mode for untrusted sources |
| Storing secrets in mise.toml [env] | Secrets visible in git, shared accidentally | Use direnv .envrc (gitignored) or secret management tools (1Password, Vault) |
| Running `mise trust` without checking config | Malicious env vars or hooks executed | Read mise.toml before trusting; check `[env]`, `[hooks]`, `[tasks]` sections |
| Committing .envrc to shared repos | Team members' local secrets exposed | Add `.envrc` to `.gitignore`; use `.envrc.example` for template |
| Using mise in untrusted repos without paranoid mode | Supply chain attacks via mise.toml | Enable paranoid mode globally: `mise settings set experimental_paranoid true` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Cryptic just error messages | Developer can't figure out what failed | Add descriptive comments to recipes; use gum to style error messages with context |
| No feedback for long-running tasks | Developer thinks command hung, kills it prematurely | Add gum spinners for operations >2 seconds; show progress for >10s tasks |
| Inconsistent command names (make→just) | Muscle memory breaks, confusion, slows workflow | Keep identical names during migration; document changes in README + announcement |
| Missing --help or --list | Discoverability suffers, new contributors lost | Use `just --list` as default; add descriptions to recipes with comments |
| No validation before destructive operations | Accidental data loss, production incidents | Add `gum confirm` before `db-reset`, `db-drop`, `deploy-prod`, etc. |
| Changed command arguments (make→just) | Workflows break silently, incorrect behavior | Keep argument patterns identical; document any changes; add validation |

## "Looks Done But Isn't" Checklist

- [ ] **Justfile migrated:** Often missing `.PHONY` cleanup, dependency conversion, recipe parameters — verify no Make syntax remains, run `grep -E "\.PHONY|%:" justfile`
- [ ] **Docs updated:** Often missing scattered `make` references in issue templates, PR comments, old docs — grep audit with `git grep -i "make " -- '*.md'`
- [ ] **CI integrated:** Often missing mise cache config, gum TTY fallbacks, tool version verification — test full CI pipeline, verify job completion
- [ ] **Devcontainer working:** Often missing mise activation in shell RC files, trust config, PATH setup — verify new shell sessions find tools, test `just --version`
- [ ] **Docker production ready:** Often still includes development tools (mise/just), bloated images — verify multi-stage separation, image <300MB
- [ ] **Version pinning:** Often uses flexible versions (Node "22" not "22.1.0") — verify mise.lock or --pin usage, check `mise current` consistency
- [ ] **Contributor onboarding:** Often assumes everyone knows just/mise, no migration guide — verify fresh clone setup works, test with new developer
- [ ] **Muscle memory addressed:** Often no deprecation period or helpful errors when typing `make` — consider temporary wrapper script with migration message
- [ ] **Secret management:** Often .env committed or missing from .gitignore — verify `.env` in `.gitignore` before any .env creation
- [ ] **Target coverage:** Often forgotten obscure Make targets — verify target audit checklist shows 100% migration, test all CI paths
- [ ] **Shell compatibility:** Often Bash-specific syntax breaks in sh — verify `set shell := ["bash", "-c"]` present, test on Linux
- [ ] **Argument handling:** Often missing quotes/positional-arguments for spaces — test recipes with `"file name.csv"` style args

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shell variable scope errors in justfile | LOW | Add shebang to recipe, combine lines with &&, or use just variables |
| Gum failures in CI | LOW | Add TTY detection wrapper (`[ -t 0 ]`), provide echo fallback, rerun pipeline |
| Mise not activated in devcontainer | LOW | Add activation to shell RC, rebuild container, document for contributors |
| Incomplete doc updates | MEDIUM | Audit with `git grep`, update all files, notify team in changelog/Slack |
| Just directory search issues | LOW | Add `fallback := false` or `[no-cd]` attributes, document behavior clearly |
| Version drift (no pinning) | MEDIUM | Pin versions now with `--pin`, document required versions, add CI version check |
| Bloated production Docker | MEDIUM | Split to multi-stage build, rebuild and redeploy, update deployment docs |
| .PHONY cruft in justfile | LOW | Delete lines, commit cleanup, no functional impact |
| CI broken after Makefile deletion | MEDIUM | Revert commit, update CI first, re-delete Makefile after verification, test deploy |
| Secrets committed in .env | HIGH | Rotate ALL secrets immediately, use `git filter-repo` to remove from history, force push, notify team |
| mise PATH conflicts | LOW | Uninstall competing tools (nvm/pyenv), re-run `mise activate`, restart shell, verify with `mise doctor` |
| Recipe argument splitting | LOW | Add `set positional-arguments`, update recipe to use `"$1"`, update callers with quotes |
| Forgotten Make target | MEDIUM | Restore target from git history, migrate to just, test usage, update callers |
| mise.toml not trusted | LOW | Run `mise trust`, run `mise install`, verify `mise ls` shows tools |
| Shell incompatibility (bash/sh) | LOW | Add `set shell := ["bash", "-c"]` to justfile, re-run recipe, test on target platform |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shell variable scope | Phase 2 (Justfile Migration) | Run all recipes, check for undefined variable errors, verify shebang usage |
| Gum non-TTY failures | Phase 4 (gum Integration) | CI workflow runs successfully with gum commands, test both TTY and non-TTY paths |
| Mise activation missing | Phase 3 (Devcontainer) | New shell in devcontainer runs `just --version` successfully, `mise doctor` clean |
| Recipe argument splitting | Phase 2 (Justfile Migration) | Test recipes with spaces in filenames: `just import "bank statement.csv"` works |
| Mise trust errors | Phase 1 (Core Tool Setup) | Fresh clone → `mise trust` → `mise install` → tools available; verified in README |
| Breaking CI during transition | Phase 5 (CI Migration) | CI green with just commands, parallel Make support until verified, coordinated deletion |
| Incomplete docs | Phase 5 (Documentation Sweep) | `git grep -i "make " -- '*.md'` returns only false positives, all references updated |
| PATH conflicts | Phase 1 (Core Tool Setup) | `which node` points to mise, `mise doctor` clean, no version mismatches |
| .env secret leakage | Phase 1 (Core Tool Setup) | `.env` in `.gitignore`, pre-commit hook rejects .env, test `git add .env` blocked |
| Forgotten Make targets | Phase 2 (Justfile Migration) | Target audit checklist shows 100% coverage, all CI paths tested |
| Shell incompatibility | Phase 2 (Justfile Migration) | Recipes work on macOS + Linux CI, `set shell := ["bash", "-c"]` present |
| Version drift | Phase 1 (Core Tool Setup) | All team members see identical `mise current` output, lockfile or pinned versions |
| Directory search confusion | Phase 2 (Justfile Migration) | Test recipes from root and subdirectories, `fallback` setting documented |
| Docker bloat | Phase 6 (Docker/Deployment) | Production image <300MB, `mise` command not found, multi-stage verified |
| .PHONY cruft | Phase 2 (Justfile Migration) | `git grep "\.PHONY" justfile` returns nothing, automated check passes |

## Sources

### Official Documentation
- [Just Programmer's Manual](https://just.systems/man/en/) - Just command runner documentation
- [Just: Avoiding Argument Splitting](https://just.systems/man/en/avoiding-argument-splitting.html) - Quoting and argument handling
- [gum GitHub Repository](https://github.com/charmbracelet/gum) - Charm Bracelet's terminal UI tool
- [mise-en-place Documentation](https://mise.jdx.dev/) - mise tool version manager
- [mise Shims Documentation](https://mise.jdx.dev/dev-tools/shims.html) - Shims vs PATH activation
- [mise Trust Documentation](https://mise.jdx.dev/cli/trust.html) - Security trust model
- [mise direnv Integration](https://mise.jdx.dev/direnv.html) - Using mise with direnv
- [mise Troubleshooting](https://mise.jdx.dev/troubleshooting.html) - Common mise issues
- [mise Paranoid Mode](https://mise.jdx.dev/paranoid.html) - Enhanced security settings

### Community Resources
- [Make vs Just - Detailed Comparison](https://discourse.charmhub.io/t/make-vs-just-a-detailed-comparison/16097) - Feature comparison
- [Just vs Makefiles - Flirting with Neutrality](https://peterborocz.blog/posts/nano/just_vs_makefiles/) - Migration guide
- [Justfile became my favorite task runner](https://tduyng.medium.com/justfile-became-my-favorite-task-runner-7a89e3f45d9a) - Real-world migration
- [Why Justfile Outshines Makefile in Modern DevOps](https://suyog942.medium.com/why-justfile-outshines-makefile-in-modern-devops-workflows-a64d99b2e9f0) - DevOps perspective
- [Getting Started with Mise - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/mise-explained/) - mise tutorial
- [How to Use mise for Tool Version Management](https://oneuptime.com/blog/post/2026-01-25-mise-tool-version-management/view) - 2026 guide
- [Mise + Dev Containers Setup Guide](https://rezachegini.com/2025/10/14/mise-and-dev-containers-simple-setup-guide/) - Devcontainer activation

### GitHub Issues & Discussions
- [Trying to convert Makefile to Justfile · Issue #448](https://github.com/casey/just/issues/448) - Migration experiences
- [Non-interactive value to gum commands · Issue #788](https://github.com/charmbracelet/gum/issues/788) - gum CI compatibility
- [gum choose default value · Issue #282](https://github.com/charmbracelet/gum/issues/282) - Interactive fallbacks
- [mise trust is broken · Issue #2568](https://github.com/jdx/mise/issues/2568) - Trust workflow issues
- [use mise and direnv feedback · Discussion #2023](https://github.com/jdx/mise/discussions/2023) - mise/direnv conflicts
- [mise activate does not remove shims · Discussion #4444](https://github.com/jdx/mise/discussions/4444) - PATH management

### GitHub Actions Integration
- [Setup just - GitHub Marketplace](https://github.com/marketplace/actions/setup-just) - Official just action
- [extractions/setup-just](https://github.com/extractions/setup-just) - Just installation for CI

---
*Pitfalls research for: Build System Modernization (Make → Just + gum + mise)*
*Researched: 2026-02-26*
