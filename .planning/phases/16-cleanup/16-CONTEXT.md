# Phase 16: Cleanup - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove deprecated Make build system files and legacy tool-version files, now that mise + just fully replace them. This is a pure deletion phase — no new functionality, no refactoring.

</domain>

<decisions>
## Implementation Decisions

### Deletion scope
- Remove `Makefile` (root)
- Remove `make/` directory (7 module files: db.mk, dev.mk, docker.mk, i18n.mk, release.mk, test.mk, utils.mk)
- Remove `.nvmrc` (replaced by `.mise.toml` `[tools]` node version)
- `.python-version` already removed — no action needed (CLEAN-03 partially satisfied)

### Reference sweep
- Run a final grep for any remaining Make references in code, scripts, CI configs, and comments that Phase 15 may have missed
- Remove or update any straggling references found

### Validation
- CI must remain green after deletion — all workflows already migrated to just in Phase 14
- No local pre-validation needed beyond the sweep; CI is the gate

### Claude's Discretion
- Commit granularity (single commit vs per-requirement)
- Order of operations for deletion
- Whether to update .gitignore if it references Make artifacts

</decisions>

<specifics>
## Specific Ideas

No specific requirements — this is a mechanical deletion with a validation sweep.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-cleanup*
*Context gathered: 2026-02-26*
