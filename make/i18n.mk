# =============================================================================
# Translation / Internationalization Targets
# =============================================================================

.PHONY: translate-upload translate-download translate-status translate-pseudo

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
	@cd $(FRONTEND_DIR) && node scripts/generate-pseudo-locale.js
	@echo "$(GREEN)✓ Pseudo-locale generated$(NC)"
