# Makefile to manage AI agent/skill symlinks for Claude, Codex, and Cursor.

TOOLS ?= all
TOOL_LIST := claude codex cursor

WAYPOINT_DIR := $(abspath $(dir $(firstword $(MAKEFILE_LIST))))
PROJECT_ROOT := $(abspath $(WAYPOINT_DIR)/..)

ifeq ($(TOOLS),all)
SELECTED_TOOLS := $(TOOL_LIST)
else
SELECTED_TOOLS := $(TOOLS)
endif

.PHONY: help link status clean

help:
	@echo "Usage: make -f .waypoint/Makefile <target> [TOOLS=claude|codex|cursor|all]"
	@echo "Targets:"
	@echo "  link   - create/update symlinks for selected tools"
	@echo "  status - show symlink status for selected tools"
	@echo "  clean  - remove symlinks for selected tools (non-symlink paths are untouched)"

define link_one
	@echo "Linking $(1)..."
	@mkdir -p $(PROJECT_ROOT)/.$(1)
	@ln -snf ../.waypoint/agents $(PROJECT_ROOT)/.$(1)/agents
	@ln -snf ../.waypoint/skills $(PROJECT_ROOT)/.$(1)/skills
	@ln -snf ../.waypoint/README.md $(PROJECT_ROOT)/.$(1)/README.md
endef

define status_one
	@echo "Status for $(1):"
	@ls -l $(PROJECT_ROOT)/.$(1) 2>/dev/null || echo "  (missing .$(1) folder)"
endef

define clean_one
	@echo "Cleaning $(1)..."
	@if [ -L $(PROJECT_ROOT)/.$(1)/agents ]; then rm -f $(PROJECT_ROOT)/.$(1)/agents; else echo "  agents: not a symlink, skipped"; fi
	@if [ -L $(PROJECT_ROOT)/.$(1)/skills ]; then rm -f $(PROJECT_ROOT)/.$(1)/skills; else echo "  skills: not a symlink, skipped"; fi
	@if [ -L $(PROJECT_ROOT)/.$(1)/README.md ]; then rm -f $(PROJECT_ROOT)/.$(1)/README.md; else echo "  README.md: not a symlink, skipped"; fi
endef

link:
	$(foreach tool,$(SELECTED_TOOLS),$(call link_one,$(tool)))

status:
	$(foreach tool,$(SELECTED_TOOLS),$(call status_one,$(tool)))

clean:
	$(foreach tool,$(SELECTED_TOOLS),$(call clean_one,$(tool)))
