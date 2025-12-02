# =============================================================================
# Release Targets
# =============================================================================

.PHONY: release release-patch release-minor release-major

# Get current version from backend/pyproject.toml
CURRENT_VERSION := $(shell grep -E '^version = ' $(BACKEND_DIR)/pyproject.toml | sed 's/version = "\(.*\)"/\1/')

release: ## Create a release (usage: make release VERSION=x.y.z)
	@if [ -z "$(VERSION)" ]; then \
		echo "\033[0;34mRelease Commands:\033[0m"; \
		echo ""; \
		echo "  \033[0;33mmake release VERSION=x.y.z\033[0m  - Release specific version"; \
		echo "  \033[0;33mmake release-patch\033[0m          - $(CURRENT_VERSION) -> next patch"; \
		echo "  \033[0;33mmake release-minor\033[0m          - $(CURRENT_VERSION) -> next minor"; \
		echo "  \033[0;33mmake release-major\033[0m          - $(CURRENT_VERSION) -> next major"; \
		echo ""; \
		echo "Current version: \033[0;32m$(CURRENT_VERSION)\033[0m"; \
	else \
		echo "\033[0;34mCreating release v$(VERSION)...\033[0m"; \
		sed -i '' 's/^version = ".*"/version = "$(VERSION)"/' $(BACKEND_DIR)/pyproject.toml; \
		sed -i '' 's/"version": ".*"/"version": "$(VERSION)"/' $(FRONTEND_DIR)/package.json; \
		./scripts/generate-changelog.sh $(VERSION); \
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
