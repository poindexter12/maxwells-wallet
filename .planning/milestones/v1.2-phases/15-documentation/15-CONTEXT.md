# Phase 15: Documentation - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Update all project documentation to reference `just` instead of `make`. This covers CLAUDE.md, README.md, .claude/ agent and skill files, docs/ directory, e2e test docs, and any other file in the repo containing backtick-wrapped `make` commands. The Makefile itself is not deleted (Phase 16 handles that).

</domain>

<decisions>
## Implementation Decisions

### Prerequisite framing
- mise is THE single prerequisite — "install mise, then just setup" is the entire onboarding story
- Include inline mise install snippet directly in README (curl one-liner) so developers never leave the page
- No manual fallback path documented (no "alternatively install Node + Python + uv manually")
- mise + just appear in setup/development sections only, not in the project intro or tech stack bullet points

### Docs audit scope
- All files in the entire repo are in scope for the DOC-03 audit
- .claude/skills/ files (Next.js, FastAPI, testing, etc.) get updated — all make references become just equivalents
- .claude/agents/ files get updated
- docs/ directory files (i18n-workflow.md, etc.) get audited and updated
- e2e/README.md and any other scattered READMEs get updated
- Success criteria: `git grep -i "\`make"` returns zero results (excluding Makefile itself and make/ directory, which Phase 16 handles)

### Command presentation
- Commands organized by domain in docs, mirroring current grouped structure (Setup, Development, Build & Test, Database, Linting, Docker, i18n, etc.)
- Remove the "Direct Commands (When Necessary)" section from CLAUDE.md entirely — everything goes through just
- No need to document `just --list` since bare `just` (no args) shows the recipe list
- Stronger emphasis than before: just is THE way to run things, no direct npm/uv/alembic in normal workflows

### Migration posture
- Clean break — no mention of make anywhere in docs
- Docs read as if just was always the tool; no "migrated from make" notes
- The CLAUDE.md "IMPORTANT: Always prefer make commands" callout becomes a stronger version for just: just is THE way to run things, no backdoors

### Claude's Discretion
- Whether to keep or simplify the devcontainer section in CLAUDE.md (agents don't typically use devcontainers, but it's existing context)
- Whether to add a deprecation header comment to the Makefile itself (since Phase 16 deletes it)
- Level of detail for gum UX notes (spinners, confirmations) in command docs — note interactive commands or keep it discoverable

</decisions>

<specifics>
## Specific Ideas

- User wants bare `just` (no args) to act as the discovery command — this may need a default recipe configured if not already done
- "Stronger emphasis" on just means the CLAUDE.md guidance should be more forceful than the current make guidance

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-documentation*
*Context gathered: 2026-02-26*
