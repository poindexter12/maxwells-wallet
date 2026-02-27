# Requirements: Maxwell's Wallet v1.2

**Defined:** 2026-02-26
**Core Value:** A reliable, maintainable personal finance tracker where users can trust their data is accurate and the UI communicates clearly when something goes wrong.

## v1.2 Requirements

Requirements for Build System Modernization milestone. Each maps to roadmap phases.

### Tool Management (MISE)

- [ ] **MISE-01**: mise manages all dev tooling (just, gum, node, python, uv) from `.mise.toml`
- [ ] **MISE-02**: mise auto-installs correct tool versions on `cd` into project directory
- [ ] **MISE-03**: Secrets loaded via mise `[env]` from gitignored `.env` file (replacing .envrc direct exports)
- [ ] **MISE-04**: `.envrc` delegates to mise via `use mise` directive

### Task Runner (JUST)

- [x] **JUST-01**: All ~60 Make targets have just recipe equivalents with identical behavior
- [x] **JUST-02**: Recipes organized in 7 domain modules (`.just/*.just`) mirroring `make/*.mk`
- [x] **JUST-03**: Every recipe has documentation comment visible in `just --list`
- [x] **JUST-04**: Recipe dependencies preserved (e.g., `setup: install db-init db-seed`)
- [x] **JUST-05**: Parameters with defaults supported (VERSION, DEMO_MODE, etc.)
- [x] **JUST-06**: Parallel dev server startup (backend + frontend simultaneously)
- [x] **JUST-07**: Shell set to bash explicitly; shebang recipes for multi-line logic

### Terminal UX (GUM)

- [x] **GUM-01**: Shared gum helper functions in `scripts/gum-helpers.sh`
- [x] **GUM-02**: All ANSI escape codes replaced with gum style commands
- [x] **GUM-03**: Interactive confirmations for destructive actions (db-reset, clean-all)
- [x] **GUM-04**: Spinners for long-running operations (install, build, test, docker)
- [x] **GUM-05**: TTY detection with graceful fallback for CI/non-interactive environments

### CI Integration (CI)

- [ ] **CI-01**: GitHub Actions use `mise-action` + `setup-just` to mirror local dev
- [ ] **CI-02**: All CI workflow commands use `just <recipe>` instead of inline bash
- [ ] **CI-03**: gum non-interactive fallback verified in all CI jobs

### Devcontainer (DEVC)

- [ ] **DEVC-01**: Devcontainer uses mise feature for tool management
- [ ] **DEVC-02**: `postCreateCommand` runs `mise trust && mise install && just setup`
- [ ] **DEVC-03**: Tools available in new terminal sessions (mise activation in shell RC)

### Documentation (DOC)

- [ ] **DOC-01**: CLAUDE.md updated — all `make` commands replaced with `just` equivalents
- [ ] **DOC-02**: README.md updated — setup/dev instructions reference just
- [ ] **DOC-03**: No remaining `make` command references in any docs (grep audit clean)

### Cleanup (CLEAN)

- [ ] **CLEAN-01**: Makefile and `make/` directory deleted
- [ ] **CLEAN-02**: `.nvmrc` removed (replaced by `.mise.toml` `[tools]`)
- [ ] **CLEAN-03**: `.python-version` removed if exists (replaced by `.mise.toml`)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced UX

- **GUM-V2-01**: Fuzzy filtering for interactive recipe selection (`gum filter` with multi-select)
- **GUM-V2-02**: Multi-line recipe documentation (`[doc("""...""")]` attribute)

### Performance

- **PERF-V2-01**: Last-modified checking to skip unchanged rebuilds

## Out of Scope

| Feature | Reason |
|---------|--------|
| mise tasks (replacing just) | mise tasks less mature than just for complex workflows; just is primary task runner |
| Custom help parser | Anti-pattern — use just's native `--list` with doc comments |
| Windows support | macOS (primary) + Linux (devcontainer) only; no Windows users |
| Make backward-compat wrapper | Clean break per user decision; no shim or deprecation period |
| `.PHONY` declarations | Make artifact; just treats all recipes as commands by default |
| Nested make calls | Anti-pattern; use recipe dependencies instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MISE-01 | Phase 12 | Pending |
| MISE-02 | Phase 12 | Pending |
| MISE-03 | Phase 12 | Pending |
| MISE-04 | Phase 12 | Pending |
| JUST-01 | Phase 13 | Complete |
| JUST-02 | Phase 13 | Complete |
| JUST-03 | Phase 13 | Complete |
| JUST-04 | Phase 13 | Complete |
| JUST-05 | Phase 13 | Complete |
| JUST-06 | Phase 13 | Complete |
| JUST-07 | Phase 13 | Complete |
| GUM-01 | Phase 13 | Complete |
| GUM-02 | Phase 13 | Complete |
| GUM-03 | Phase 13 | Complete |
| GUM-04 | Phase 13 | Complete |
| GUM-05 | Phase 13 | Complete |
| CI-01 | Phase 14 | Pending |
| CI-02 | Phase 14 | Pending |
| CI-03 | Phase 14 | Pending |
| DEVC-01 | Phase 14 | Pending |
| DEVC-02 | Phase 14 | Pending |
| DEVC-03 | Phase 14 | Pending |
| DOC-01 | Phase 15 | Pending |
| DOC-02 | Phase 15 | Pending |
| DOC-03 | Phase 15 | Pending |
| CLEAN-01 | Phase 16 | Pending |
| CLEAN-02 | Phase 16 | Pending |
| CLEAN-03 | Phase 16 | Pending |

**Coverage:**
- v1.2 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after roadmap creation*
