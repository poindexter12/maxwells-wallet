# Feature Landscape

**Domain:** Build system modernization (Make → Just + gum + mise)
**Researched:** 2026-02-26

## Table Stakes

Features users expect from a modern task runner. Missing = system feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Recipe organization (modules/imports) | ~60 existing Make targets need logical grouping | Low | Just supports `import` (merge into parent) and `mod` (isolated scope) |
| Documentation comments | Self-documenting system (replaces `make help`) | Low | `# comment` above recipe → shows in `just --list` |
| Recipe dependencies | Existing Make dependencies (`setup: install db-init db-seed`) | Low | `recipe-name: dep1 dep2` syntax identical to Make |
| Parallel execution | Current `make dev` runs backend+frontend with `-j2` | Medium | Just `[parallel]` attribute on parent recipe |
| Parameters with defaults | Version passing (`VERSION=x.y.z`), mode flags (`DEMO_MODE=true`) | Low | `recipe param='default'` or variadic `*params` |
| Environment variables | `.env` loading, variable export to tasks | Low | Just auto-loads `.env`; `$param` exports as env var |
| Interactive prompts | Migration message input, destructive action confirmations | Medium | gum provides `gum input`, `gum confirm`, `gum choose` |
| Colorized output | Existing ANSI codes for status messages | Low | gum provides `gum style`, `gum format` for consistent styling |
| Cross-platform | macOS (primary), Linux (devcontainer) | Low | Just + gum both Rust-based, work on macOS/Linux/Windows |
| Error handling | Specific, informative errors with context | Low | Just provides static analysis, reports unknown recipes/circular deps before run |

## Differentiators

Features that set this migration apart. Not expected in basic Make replacement, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tool version management (mise) | Auto-install/switch Node, Python, uv versions per-project | Medium | mise walks directory tree, merges `mise.toml` configs hierarchically |
| Spinners and progress UI | Professional feedback during long operations (build, test, docker) | Low | gum spinners (dot, line, jump, pulse, globe styles) |
| Multi-line recipe docs | Detailed help for complex recipes (release, docker orchestration) | Low | Just `[doc("""multi-line""")]` attribute |
| Fuzzy filtering | Interactive selection from lists (which test to run, which env to deploy) | Medium | gum filter with fuzzy search + multi-select |
| Recipe grouping in help | Organized help output by category (dev, db, test, docker, release, i18n, utils) | Medium | Just modules + custom listing or gum formatting in wrapper |
| Conditional execution | OS detection, environment-based branching | Low | Just `if os() == "linux" { ... } else { ... }` |
| Recipe attributes | Private recipes, custom docs, parallel execution | Low | Just `[private]`, `[doc('...')]`, `[parallel]` |
| Shell completion | Tab-completion for recipes and parameters | Low | Just built-in completion scripts for bash/zsh/fish |
| Last-modified checking | Avoid rebuilding when no changes (mise tasks feature) | Medium | mise native; Just would need custom scripting |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom help parser | Complex awk/grep in `make help` is fragile | Use Just's native `--list` with doc comments |
| `.PHONY` declarations | Make artifact; not needed in task runners | Just treats all recipes as commands by default |
| Variable-heavy abstractions | Make's `$(MAKE) -C $(DIR)` patterns are hard to read | Use explicit recipe calls or Just's directory context |
| Nested make calls | `$(MAKE) install-backend install-frontend` creates confusion | Use recipe dependencies: `install: install-backend install-frontend` |
| Shell-in-Make escaping | Complex quoting/escaping in Make recipes | Use Just's shebang recipes for complex shell logic |
| Manual parallel orchestration | `make -j2` is implicit, error-prone | Use `[parallel]` attribute or mise's automatic parallel deps |

## Feature Dependencies

```
Tool version management (mise) → All recipes (ensures correct Node/Python/uv)
Documentation comments → Recipe grouping (need docs to categorize)
Interactive prompts (gum) → Destructive actions (db-reset, clean-all, release)
Colorized output (gum) → All user-facing recipes (consistent UX)
Parameters with defaults → Interactive recipes (fallback when not provided)
Parallel execution → Development workflow (backend + frontend simultaneously)
Modules/imports → Recipe organization (7 .mk files → Just modules)
```

## MVP Recommendation

Prioritize (Phase 1 - Core Migration):
1. **Recipe organization** - Port 7 .mk files to Just modules with imports
2. **Documentation comments** - Add `# comment` to every recipe for `just --list`
3. **Recipe dependencies** - Preserve existing dep chains (`setup: install db-init db-seed`)
4. **Parameters with defaults** - Support `VERSION=x.y.z` style args
5. **Basic gum output** - Replace ANSI codes with `gum style` for headers/success/error

Prioritize (Phase 2 - Enhanced UX):
1. **Interactive prompts** - `gum input` for migration messages, `gum confirm` for destructive actions
2. **Spinners** - `gum spin` for long operations (install, docker-build, test)
3. **Parallel execution** - `[parallel]` attribute for `dev` recipe (backend + frontend)
4. **Tool version management** - mise integration for Node/Python/uv

Defer:
- **Fuzzy filtering**: Nice-to-have for advanced workflows; not critical for migration parity
- **Last-modified checking**: Complex, low ROI for current workflow
- **Multi-line docs**: Can add incrementally; single-line docs sufficient for MVP

## Complexity Assessment

| Feature Category | Complexity | Reasoning |
|------------------|------------|-----------|
| Just recipe basics | **Low** | Syntax nearly identical to Make; direct 1:1 port |
| gum output styling | **Low** | Simple command substitution; `gum style --foreground 2 "text"` |
| gum interactive prompts | **Medium** | Need to handle user cancellation, validation, defaults |
| Parallel execution | **Medium** | Just `[parallel]` is simple; coordinating output/errors harder |
| mise integration | **Medium** | Tool installation works; task integration with Just needs design |
| Module organization | **Low-Medium** | Import/mod syntax simple; deciding granularity takes thought |

## Sources

**HIGH Confidence (Official Documentation):**
- [Just Programmer's Manual - Introduction](https://just.systems/man/en/)
- [Just - Documentation Comments](https://just.systems/man/en/documentation-comments.html)
- [Just - Listing Available Recipes](https://just.systems/man/en/listing-available-recipes.html)
- [Just - Recipe Parameters](https://just.systems/man/en/recipe-parameters.html)
- [Just - Parallelism](https://just.systems/man/en/parallelism.html)
- [gum GitHub Repository](https://github.com/charmbracelet/gum)
- [mise Tasks Documentation](https://mise.jdx.dev/tasks/)
- [mise Dev Tools Documentation](https://mise.jdx.dev/dev-tools/)

**MEDIUM Confidence (Community Best Practices):**
- [Just vs. Make: Which Task Runner Stands Up Best?](https://spin.atomicobject.com/just-task-runner/)
- [Justfile became my favorite task runner](https://tduyng.medium.com/justfile-became-my-favorite-task-runner-7a89e3f45d9a)
- [Shared Tooling for Diverse Systems with just](https://www.stuartellis.name/articles/just-task-runner/)
- [Beautiful bash scripts with Gum](https://maciejwalkowiak.com/blog/beautiful-bash-scripts-with-gum/)
- [Task Runners for Projects - DEV Community](https://dev.to/rudolfolah/task-runners-for-projects-57gi)
- [Using a task runner to help with context switching](https://www.caro.fyi/articles/just/)
- [How To Use mise for Tool Version Management](https://oneuptime.com/blog/post/2026-01-25-mise-tool-version-management/view)
