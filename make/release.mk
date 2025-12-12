# =============================================================================
# Release Targets
# =============================================================================

.PHONY: release release-patch release-minor release-major release-check release-validate

# Get current version from backend/pyproject.toml and frontend/package.json
CURRENT_VERSION := $(shell grep -E '^version = ' $(BACKEND_DIR)/pyproject.toml | sed 's/version = "\(.*\)"/\1/')
FRONTEND_VERSION := $(shell grep -E '"version":' $(FRONTEND_DIR)/package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
LAST_TAG := $(shell git describe --tags --abbrev=0 2>/dev/null || echo "")

# Files that should be updated for each release
RELEASE_DOCS := CHANGELOG.md README.md docs-site/index.md

release-check: ## Validate versions match and docs updated (dry-run)
	@echo "\033[0;34mRelease Pre-flight Check\033[0m"
	@echo "========================="
	@echo ""
	@echo "\033[0;33m1. Version Numbers:\033[0m"
	@echo "   Backend (pyproject.toml):  $(CURRENT_VERSION)"
	@echo "   Frontend (package.json):   $(FRONTEND_VERSION)"
	@if [ "$(CURRENT_VERSION)" = "$(FRONTEND_VERSION)" ]; then \
		echo "   \033[0;32m✓ Versions match\033[0m"; \
	else \
		echo "   \033[0;31m✗ Version mismatch!\033[0m"; \
	fi
	@echo ""
	@echo "\033[0;33m2. Last Release Tag:\033[0m $(LAST_TAG)"
	@echo ""
	@echo "\033[0;33m3. Docs Changed Since $(LAST_TAG):\033[0m"
	@for doc in $(RELEASE_DOCS); do \
		if [ -n "$(LAST_TAG)" ]; then \
			if git diff --quiet $(LAST_TAG) HEAD -- "$$doc" 2>/dev/null; then \
				echo "   \033[0;31m✗ $$doc - NO CHANGES\033[0m"; \
			else \
				echo "   \033[0;32m✓ $$doc - updated\033[0m"; \
			fi; \
		else \
			echo "   ? $$doc (no previous tag)"; \
		fi; \
	done
	@echo ""
	@echo "\033[0;33m4. CHANGELOG has section for $(CURRENT_VERSION):\033[0m"
	@if grep -q "\[$(CURRENT_VERSION)\]" CHANGELOG.md; then \
		echo "   \033[0;32m✓ Found [$(CURRENT_VERSION)] in CHANGELOG.md\033[0m"; \
	else \
		echo "   \033[0;31m✗ Missing [$(CURRENT_VERSION)] section in CHANGELOG.md\033[0m"; \
	fi

release-validate: ## Fail if release checks don't pass
	@ERRORS=0; \
	if [ "$(CURRENT_VERSION)" != "$(FRONTEND_VERSION)" ]; then \
		echo "\033[0;31mError: Version mismatch - backend=$(CURRENT_VERSION) frontend=$(FRONTEND_VERSION)\033[0m"; \
		ERRORS=1; \
	fi; \
	if [ -n "$(LAST_TAG)" ]; then \
		if git diff --quiet $(LAST_TAG) HEAD -- CHANGELOG.md 2>/dev/null; then \
			echo "\033[0;31mError: CHANGELOG.md has no changes since $(LAST_TAG)\033[0m"; \
			ERRORS=1; \
		fi; \
	fi; \
	if ! grep -q "\[$(CURRENT_VERSION)\]" CHANGELOG.md; then \
		echo "\033[0;31mError: CHANGELOG.md missing section for [$(CURRENT_VERSION)]\033[0m"; \
		ERRORS=1; \
	fi; \
	if [ $$ERRORS -ne 0 ]; then \
		echo ""; \
		echo "Run '\033[0;33mmake release-check\033[0m' for details"; \
		exit 1; \
	fi; \
	echo "\033[0;32m✓ All release checks passed\033[0m"

release: ## Create a release (usage: make release VERSION=x.y.z)
	@if [ -z "$(VERSION)" ]; then \
		echo "\033[0;34mRelease Commands:\033[0m"; \
		echo ""; \
		echo "  \033[0;33mmake release VERSION=x.y.z\033[0m  - Release specific version"; \
		echo "  \033[0;33mmake release-patch\033[0m          - $(CURRENT_VERSION) -> next patch"; \
		echo "  \033[0;33mmake release-minor\033[0m          - $(CURRENT_VERSION) -> next minor"; \
		echo "  \033[0;33mmake release-major\033[0m          - $(CURRENT_VERSION) -> next major"; \
		echo "  \033[0;33mmake release-check\033[0m          - Pre-flight validation (dry-run)"; \
		echo ""; \
		echo "Current version: \033[0;32m$(CURRENT_VERSION)\033[0m"; \
		echo "Last tag: $(LAST_TAG)"; \
	else \
		echo "\033[0;34mPre-flight checks...\033[0m"; \
		if ! grep -q "\[$(VERSION)\]" CHANGELOG.md; then \
			echo "\033[0;31mError: CHANGELOG.md missing section for [$(VERSION)]\033[0m"; \
			echo "Please add a changelog entry before releasing."; \
			exit 1; \
		fi; \
		echo "\033[0;32m✓ CHANGELOG.md has [$(VERSION)] section\033[0m"; \
		echo ""; \
		echo "\033[0;34mCreating release v$(VERSION)...\033[0m"; \
		sed -i '' 's/^version = ".*"/version = "$(VERSION)"/' $(BACKEND_DIR)/pyproject.toml; \
		sed -i '' 's/"version": ".*"/"version": "$(VERSION)"/' $(FRONTEND_DIR)/package.json; \
		git add -A; \
		git commit -m "chore: release v$(VERSION)"; \
		git tag v$(VERSION); \
		echo "\033[0;34mPushing to GitHub...\033[0m"; \
		git push origin main --tags; \
		echo ""; \
		echo "\033[0;32m✓ Release v$(VERSION) created!\033[0m"; \
		echo ""; \
		echo "GitHub Actions will now:"; \
		echo "  1. Create GitHub Release with changelog"; \
		echo "  2. Build Docker image"; \
		echo "  3. Push to ghcr.io/poindexter12/maxwells-wallet:$(VERSION)"; \
		echo ""; \
		echo "Monitor progress: \033[0;33mgh run watch\033[0m"; \
	fi

release-patch: ## Create a patch release (x.y.Z+1)
	@NEW_VERSION=$$(echo $(CURRENT_VERSION) | awk -F. '{print $$1"."$$2"."$$3+1}'); \
	$(MAKE) release VERSION=$$NEW_VERSION

release-minor: ## Create a minor release (x.Y+1.0)
	@NEW_VERSION=$$(echo $(CURRENT_VERSION) | awk -F. '{print $$1"."$$2+1".0"}'); \
	$(MAKE) release VERSION=$$NEW_VERSION

release-major: ## Create a major release (X+1.0.0)
	@NEW_VERSION=$$(echo $(CURRENT_VERSION) | awk -F. '{print $$1+1".0.0"}'); \
	$(MAKE) release VERSION=$$NEW_VERSION
