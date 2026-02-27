# Phase 16: Cleanup - Research

**Research Question:** What do I need to know to PLAN this phase well?

**Researched:** 2026-02-26
**Researcher:** gsd-phase-researcher

---

## Executive Summary

Phase 16 is a mechanical deletion phase to remove deprecated Make build system files after the migration to just+gum is fully validated. The scope is tightly bounded: delete 3 files/directories in the repo root, with a final grep sweep to catch any lingering references Phase 15 may have missed.

**Key Finding:** `.python-version` still exists at `backend/.python-version` (not yet removed). All other targets confirmed present. Two sub-project Makefiles (`data/Makefile` and `deploy/swag-test/Makefile`) are intentionally out of scope.

---

## Requirements Coverage

### CLEAN-01: Remove Makefile and make/ directory

**Target files:**
- `/Makefile` (4722 bytes, confirmed exists)
- `/make/` directory (7 module files: db.mk, dev.mk, docker.mk, i18n.mk, release.mk, test.mk, utils.mk)

**Dependencies:** None — CI already migrated to just (Phase 14), docs already migrated (Phase 15).

**Risk:** Low — Phase 15 validated CI/docs migration is complete.

### CLEAN-02: Remove .nvmrc

**Target file:**
- `/.nvmrc` (3 bytes, confirmed exists)

**Replacement:** `.mise.toml` `[tools]` section specifies `node = "22"`.

**Risk:** Minimal — mise handles Node version management via `.mise.toml`.

### CLEAN-03: Remove .python-version

**Target file:**
- `/backend/.python-version` (confirmed exists)

**Context note from 16-CONTEXT.md:**
> "`.python-version` already removed — no action needed (CLEAN-03 partially satisfied)"

This was incorrect. The file still exists at `backend/.python-version`.

**Replacement:** `.mise.toml` `[tools]` section specifies `python = "3.11"`.

**Risk:** Minimal — mise handles Python version management.

---

## What Phase 15 Left Behind

Phase 15 focused on documentation and marked these items as **intentionally excluded**:

1. **`.planning/`** — Historical planning records (not user-facing)
2. **`CHANGELOG.md`** — Historical release notes
3. **`deploy/swag-test/README.md` and `deploy/swag-test/Makefile`** — Separate demo sub-project with its own Makefile (just recipes don't cover this area)
4. **`data/Makefile`** — Separate data anonymization sub-project; just recipes delegate to it via `make -C data`

Phase 15's DOC-03 grep audit confirmed zero backtick-wrapped make command references in active docs (`git grep -in '`make '` returned no matches).

---

## Reference Sweep Targets

A final grep for Make/Makefile references found **40 files** containing one or more of: `Make`, `make/`, `Makefile`, `.nvmrc`, `.python-version`.

### Out of Scope (Intentional)

These references are **legitimate and should remain**:

1. **`.planning/` directory** (17 files)
   - Historical planning artifacts (phases 12-15 research/plans/summaries)
   - Example: `12-RESEARCH.md` compares Make vs just design decisions
   - Action: None (historical context)

2. **`CHANGELOG.md`**
   - Historical release notes mentioning Makefile features in past versions
   - Action: None (historical record)

3. **`deploy/swag-test/README.md` and `Makefile`**
   - Separate demo deployment sub-project
   - Has its own Makefile for Docker Compose orchestration (`make up`, `make cloudflare`, etc.)
   - Not covered by root justfile
   - Action: None (separate concern)

4. **`data/Makefile` and `data/CLAUDE.md`**
   - Data anonymization sub-project
   - Root justfile delegates to it: `data-setup: make -C data setup`, etc.
   - Documented pattern: agents use `just utils::data-*`, which calls `make -C data`
   - Action: None (intentional delegation pattern)

5. **Backend test files**
   - `backend/tests/test_backup.py` — test code (not user-facing)
   - `backend/alembic/versions/f29bca4459fc_add_date_range_type_to_dashboards.py` — migration file
   - Action: None (code artifacts)

### Potential Cleanup Targets

These files may contain **stale references** worth reviewing:

1. **`setup.sh`** (lines 86-89)
   ```bash
   echo "Using Makefile:"
   echo "  make dev          # Start both servers"
   echo "  make backend      # Start backend only"
   echo "  make frontend     # Start frontend only"
   ```
   - Alternative setup script (not documented in CLAUDE.md or README)
   - Header comment: "Alternative to Makefile for first-time setup"
   - Action: Update to reference just or remove if obsolete

2. **`CONTRIBUTING.md`** (line 18)
   ```markdown
   2. Make your changes, following the code style guidelines below
   ```
   - False positive — "Make" is the verb, not the tool
   - Action: None (English word, not tool reference)

3. **`.gitignore`**
   - Currently does not reference Make artifacts
   - Action: Consider adding `Makefile` and `make/` to .gitignore? (Unlikely needed — we're deleting them permanently)

---

## CI Validation Strategy

**Gate:** CI must remain green after deletion.

**What validates this:**
- Phase 14 migrated all GitHub Actions workflows to `mise-action` + `just <recipe>`
- Phase 15 confirmed no docs reference make commands
- Running the full CI suite post-deletion will confirm no hidden Make dependencies remain

**No pre-deletion validation needed** beyond the sweep — CI is the gate.

---

## Sub-Project Makefiles: Why They Stay

### data/Makefile

**Purpose:** Data anonymization workflow (process real CSV files → anonymized test fixtures).

**Integration pattern:**
- Root justfile recipes delegate to it: `data-setup`, `data-status`, `data-anonymize`, `data-force`, `data-clean`
- Each recipe runs `make -C data <target>`
- Documented in `data/CLAUDE.md` line 40: "make anonymize raw/MyBank/statement.csv" (direct usage from data/ directory)

**Why it stays:**
- Separate concern (data processing, not build system)
- Uses uv-managed venv in `data/.venv`
- Positional arg handling (Make's `%:` catch-all pattern) makes the interface ergonomic
- Converting to just would require recreating this pattern in `.just/utils.just` — no user-facing benefit

**Action:** None (intentional delegation).

### deploy/swag-test/Makefile

**Purpose:** Docker Compose orchestration for demo deployment with Cloudflare tunnels.

**Integration:**
- Not integrated with root justfile
- Standalone demo project (`docker-compose.yaml`, `test_config.py`, LXC bootstrap script)
- Targets: `make up`, `make cloudflare`, `make logs`, `make down`, `make help`

**Why it stays:**
- Separate deployment demo (not part of core dev workflow)
- Not referenced in CLAUDE.md or README
- No overlap with root build system

**Action:** None (out of scope).

---

## .gitignore Considerations

Current `.gitignore` does not reference Make artifacts.

**Question:** Should we add `Makefile` and `make/` to `.gitignore` after deletion?

**Answer:** No. We're permanently removing them from the repo. Adding them to `.gitignore` implies they might be regenerated locally, which is not the intent. If someone accidentally creates a local Makefile, git will track it (and they should notice).

**Action:** No `.gitignore` changes needed.

---

## Commit Granularity

**User decision (from 16-CONTEXT.md):** Claude's discretion.

**Options:**

1. **Single atomic commit:**
   - Delete Makefile, make/, .nvmrc, backend/.python-version in one commit
   - Message: "chore(cleanup): remove deprecated Make build system files"
   - Pros: Clean history, easy to revert if needed
   - Cons: None

2. **Per-requirement commits:**
   - Commit 1: Remove Makefile + make/ (CLEAN-01)
   - Commit 2: Remove .nvmrc (CLEAN-02)
   - Commit 3: Remove backend/.python-version (CLEAN-03)
   - Pros: Granular traceability
   - Cons: Unnecessarily verbose for a deletion phase

3. **Two commits:**
   - Commit 1: Cleanup sweep (update setup.sh or other stale references)
   - Commit 2: Delete Make files (.nvmrc, .python-version, Makefile, make/)
   - Pros: Separates reference cleanup from file deletion
   - Cons: Only worth it if sweep finds meaningful references

**Recommendation:** Use approach based on sweep findings:
- If sweep is clean → single atomic commit
- If sweep finds references requiring updates → two commits (sweep fixes, then deletions)

---

## Potential Pitfalls

### 1. Hidden Make invocations in CI

**Risk:** Low. Phase 14 migrated all workflows.

**Mitigation:** CI is the gate — if anything breaks, it will fail loudly.

### 2. Local developer workflows relying on Make

**Risk:** Minimal. CLAUDE.md and README both reference just exclusively (Phase 15).

**Mitigation:** Developers pull main, see missing Makefile, read README → directed to `just setup`.

### 3. Confusion about sub-project Makefiles

**Risk:** Low. Both are clearly documented as separate concerns.

**Mitigation:** If questions arise, point to this research section ("Sub-Project Makefiles: Why They Stay").

### 4. .python-version removal breaking local pyenv users

**Risk:** Minimal. Project onboarding uses mise, not pyenv.

**Context:** `.mise.toml` specifies `python = "3.11"` which mise auto-installs. Developers using pyenv would have already hit issues during Phase 12-15 (no evidence of this in planning artifacts).

**Mitigation:** None needed — project standardized on mise in Phase 12.

---

## Dependencies on Previous Phases

| Phase | Deliverable | Why Phase 16 Depends on It |
|-------|-------------|----------------------------|
| Phase 12 | `.mise.toml` manages all tools | Replaces `.nvmrc` and `.python-version` |
| Phase 13 | All Make targets ported to just | Ensures `Makefile` and `make/` are obsolete |
| Phase 14 | CI workflows use just | Ensures CI won't break when Make is removed |
| Phase 15 | Docs reference just exclusively | Ensures new developers won't see Make references |

**All dependencies satisfied.** Phase 15 marked complete 2026-02-27.

---

## Questions for Planning

### Answered by Research

1. **What files exactly need deletion?**
   - `Makefile` (root)
   - `make/` directory (7 files)
   - `.nvmrc` (root)
   - `backend/.python-version` (NOT already removed — 16-CONTEXT.md was incorrect)

2. **Are there hidden Make dependencies in CI?**
   - No. Phase 14 migrated all workflows.

3. **What about data/Makefile and deploy/swag-test/Makefile?**
   - Intentionally out of scope (sub-projects with separate concerns).

4. **Does .gitignore need updates?**
   - No.

### Open for Planner

1. **Commit granularity:** Single atomic commit vs two commits (sweep + deletion)?
   - Recommendation: Decide based on sweep findings.

2. **setup.sh handling:** Update to reference just, or delete entirely?
   - Context: Not documented in CLAUDE.md or README as a supported workflow.
   - Recommendation: Update if it's still useful; delete if obsolete (defer to planner judgment).

---

## Success Criteria Validation Plan

From ROADMAP.md Phase 16:

1. ✅ **Makefile and make/ directory no longer exist in repository**
   - Validation: `ls Makefile make/` returns "No such file or directory"

2. ✅ **`.nvmrc` and `.python-version` removed**
   - Validation: `ls .nvmrc backend/.python-version` returns "No such file or directory"

3. ✅ **CI remains green after deletion**
   - Validation: Push branch, GitHub Actions must pass

4. ✅ **Developer workflows unchanged**
   - Validation: `just setup && just dev::dev` works identically to pre-cleanup

All criteria are **objectively measurable** and can be validated via automated checks + CI.

---

## Planner Inputs

### Scope Confirmation

**In scope:**
- Delete `Makefile`, `make/`, `.nvmrc`, `backend/.python-version`
- Grep sweep for stale references (focus: `setup.sh`, non-planning docs)
- Validate CI remains green

**Out of scope:**
- `data/Makefile` (intentional delegation)
- `deploy/swag-test/Makefile` (separate sub-project)
- `.planning/` directory (historical records)
- `CHANGELOG.md` (historical entries)

### Risk Assessment

**Overall risk: LOW**

- All prerequisites complete (Phases 12-15)
- CI already using just (Phase 14)
- Docs already using just (Phase 15)
- No code dependencies on Make (all recipes ported in Phase 13)

**Highest risk area:** Hidden references in uncommon dev workflows (e.g., `setup.sh`).

**Mitigation:** Grep sweep will catch these.

### Recommended Plan Structure

1. **Sweep:** Grep for stale Make references, update or remove findings
2. **Delete:** Remove target files/directories
3. **Validate:** Run `just setup && just dev::dev` locally, push for CI validation
4. **Commit:** Single commit (or two if sweep found meaningful changes)

---

## References

- 16-CONTEXT.md (user decisions)
- REQUIREMENTS.md (CLEAN-01, CLEAN-02, CLEAN-03)
- STATE.md (Phase 15 completion confirmed)
- Phase 15 summaries (DOC-03 grep audit results)
- CLAUDE.md (current project onboarding — mise + just only)

---

*Research complete. Ready for planning.*
