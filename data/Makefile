# Data anonymization Makefile
#
# Usage:
#   make status              # Show what's pending/processed
#   make anonymize           # Process all pending files
#   make anonymize-force     # Reprocess all files
#
# Single file mode:
#   make anonymize FILE=raw/MyBank/statement.csv OUT=anonymized/mybank_anon.csv

PYTHON := python3

.PHONY: help status anonymize anonymize-force install-deps

help:
	@echo "Data anonymization targets:"
	@echo "  make status           - Show pending/processed files"
	@echo "  make anonymize        - Process all pending files in raw/"
	@echo "  make anonymize-force  - Reprocess all files (ignores cache)"
	@echo ""
	@echo "Single file mode:"
	@echo "  make anonymize FILE=raw/Bank/file.csv OUT=anonymized/file_anon.csv"
	@echo ""
	@echo "Setup:"
	@echo "  make install-deps     - Install required Python packages"

install-deps:
	pip install scrubadub faker

status:
	$(PYTHON) anonymize.py --status

# Process all pending files, or a single file if FILE and OUT are specified
anonymize:
ifdef FILE
ifndef OUT
	$(error OUT is required when FILE is specified. Usage: make anonymize FILE=raw/x.csv OUT=anonymized/x_anon.csv)
endif
	$(PYTHON) anonymize.py $(FILE) $(OUT)
else
	$(PYTHON) anonymize.py
endif

# Force reprocess all files, or a single file if FILE and OUT are specified
anonymize-force:
ifdef FILE
ifndef OUT
	$(error OUT is required when FILE is specified. Usage: make anonymize-force FILE=raw/x.csv OUT=anonymized/x_anon.csv)
endif
	$(PYTHON) anonymize.py $(FILE) $(OUT)
else
	$(PYTHON) anonymize.py --force
endif
