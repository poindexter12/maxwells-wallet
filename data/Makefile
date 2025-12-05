# Data anonymization Makefile
#
# Usage:
#   make setup               # First-time setup (creates venv, installs deps)
#   make status              # Show what's pending/processed
#   make anonymize           # Process all pending files
#   make force               # Reprocess all files
#   make anonymize FILE      # Process a single file (auto-generates output name)

# Use local venv via uv
RUN := uv run python anonymize.py

# Allow positional args: `make anonymize raw/file.csv`
FILE ?= $(filter-out $@,$(MAKECMDGOALS))

.PHONY: help setup status anonymize force clean

help:
	@echo "Data anonymization targets:"
	@echo "  make setup                     - First-time setup (venv + deps)"
	@echo "  make status                    - Show pending/processed files"
	@echo "  make anonymize                 - Process all pending files in raw/"
	@echo "  make force                     - Reprocess all files"
	@echo "  make anonymize <file>          - Process a single file"
	@echo "  make clean                     - Remove venv"
	@echo ""
	@echo "Examples:"
	@echo "  make anonymize raw/BofA/stmt.csv"
	@echo "  make anonymize raw/Venmo/jan.csv anonymized/venmo_anon.csv"

setup: ## First-time setup - create venv and install dependencies
	@echo "Setting up data anonymization environment..."
	@uv venv
	@uv sync
	@echo "✓ Setup complete. Run 'make status' to see pending files."

status: .venv ## Show status of raw vs anonymized files
	@$(RUN) --status

anonymize: .venv ## Process all pending files, or a single file if args provided
ifeq ($(FILE),)
	@$(RUN)
else
	@# If two args: input and output. If one arg: auto-generate output name
	$(eval ARGS := $(FILE))
	$(eval INPUT := $(word 1,$(ARGS)))
	$(eval OUTPUT := $(word 2,$(ARGS)))
	@if [ -z "$(OUTPUT)" ]; then \
		BASENAME=$$(basename "$(INPUT)" .csv); \
		$(RUN) "$(INPUT)" "anonymized/$${BASENAME}_anon.csv"; \
	else \
		$(RUN) "$(INPUT)" "$(OUTPUT)"; \
	fi
endif

force: .venv ## Force reprocess all files
ifeq ($(FILE),)
	@$(RUN) --force
else
	@# Same logic as anonymize for single file
	$(eval ARGS := $(FILE))
	$(eval INPUT := $(word 1,$(ARGS)))
	$(eval OUTPUT := $(word 2,$(ARGS)))
	@if [ -z "$(OUTPUT)" ]; then \
		BASENAME=$$(basename "$(INPUT)" .csv); \
		$(RUN) "$(INPUT)" "anonymized/$${BASENAME}_anon.csv"; \
	else \
		$(RUN) "$(INPUT)" "$(OUTPUT)"; \
	fi
endif

clean: ## Remove virtual environment
	@rm -rf .venv
	@echo "✓ Cleaned venv"

# Auto-setup if venv doesn't exist
.venv:
	@echo "Virtual environment not found. Running setup..."
	@$(MAKE) setup

# Catch-all to allow positional arguments (prevents "No rule to make target" errors)
%:
	@:
