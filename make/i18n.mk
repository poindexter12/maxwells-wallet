# =============================================================================
# Translation / Internationalization Targets
# =============================================================================

.PHONY: translate-upload translate-download translate-status translate-pseudo translate-test

# Crowdin CLI via npx (config is at project root)
CROWDIN := cd $(FRONTEND_DIR) && npx crowdin
CROWDIN_CONFIG := -c ../crowdin.yaml

translate-upload: ## Upload source strings to Crowdin
	@echo "$(BLUE)Uploading source strings to Crowdin...$(NC)"
	@$(CROWDIN) upload sources $(CROWDIN_CONFIG)
	@echo "$(GREEN)✓ Source strings uploaded$(NC)"

translate-download: ## Download translations from Crowdin
	@echo "$(BLUE)Downloading translations from Crowdin...$(NC)"
	@$(CROWDIN) download $(CROWDIN_CONFIG)
	@echo "$(GREEN)✓ Translations downloaded$(NC)"

translate-status: ## Show Crowdin project status
	@$(CROWDIN) status $(CROWDIN_CONFIG)

translate-pseudo: ## Generate pseudo-locale for i18n testing
	@echo "$(BLUE)Generating pseudo-locale...$(NC)"
	@cd $(FRONTEND_DIR) && node scripts/generate-pseudo-locale.mjs
	@echo "$(GREEN)✓ Pseudo-locale generated$(NC)"

translate-test: ## Run translation validation tests
	@echo "$(BLUE)Running translation tests...$(NC)"
	@cd $(FRONTEND_DIR) && npm run test:run -- src/test/i18n.test.ts
	@echo "$(GREEN)✓ Translation tests passed$(NC)"
