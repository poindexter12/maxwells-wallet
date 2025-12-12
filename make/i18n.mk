# =============================================================================
# Translation / Internationalization Targets
# =============================================================================

.PHONY: translate-upload translate-download translate-status translate-pseudo translate-test
.PHONY: translate-harvest translate-harvest-new translate-harvest-preview translate-describe

# Crowdin CLI via npx (config is at project root)
CROWDIN := cd $(FRONTEND_DIR) && npx crowdin
CROWDIN_CONFIG := -c ../crowdin.yaml

# Crowdin Context Harvester - uses AI to extract context from code
# Requires: CROWDIN_PERSONAL_TOKEN and one of OPENAI_KEY or ANTHROPIC_API_KEY
CROWDIN_PROJECT_ID := 854226
HARVESTER := cd $(FRONTEND_DIR) && npx crowdin-context-harvester

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

# -----------------------------------------------------------------------------
# Context Harvester - AI-powered context extraction
# Requires: CROWDIN_PERSONAL_TOKEN and ANTHROPIC_API_KEY env vars
# NOTE: High token usage (~28k per string). Requires API tier with generous rate limits.
# Consider using --since to process incrementally or OpenAI with higher limits.
# -----------------------------------------------------------------------------

translate-harvest: ## Extract context for ALL strings using AI (costs $$)
	@echo "$(BLUE)Harvesting context for all strings...$(NC)"
	@echo "$(YELLOW)⚠ This uses AI API calls - may incur costs$(NC)"
	$(HARVESTER) harvest \
		--token=$(CROWDIN_PERSONAL_TOKEN) \
		--project=$(CROWDIN_PROJECT_ID) \
		--ai=anthropic \
		--model=claude-sonnet-4-20250514 \
		--output=crowdin \
		--concurrency=2
	@echo "$(GREEN)✓ Context harvested and uploaded to Crowdin$(NC)"

translate-harvest-new: ## Extract context for strings added in last 7 days
	@echo "$(BLUE)Harvesting context for new strings (last 7 days)...$(NC)"
	$(HARVESTER) harvest \
		--token=$(CROWDIN_PERSONAL_TOKEN) \
		--project=$(CROWDIN_PROJECT_ID) \
		--ai=anthropic \
		--model=claude-sonnet-4-20250514 \
		--output=crowdin \
		--since="7 days ago" \
		--concurrency=2
	@echo "$(GREEN)✓ Context harvested for new strings$(NC)"

translate-harvest-preview: ## Preview context extraction (CSV output, no upload)
	@echo "$(BLUE)Previewing context harvest (dry run)...$(NC)"
	$(HARVESTER) harvest \
		--token=$(CROWDIN_PERSONAL_TOKEN) \
		--project=$(CROWDIN_PROJECT_ID) \
		--ai=anthropic \
		--model=claude-sonnet-4-20250514 \
		--output=csv \
		--concurrency=2
	@echo "$(GREEN)✓ Context preview saved to CSV$(NC)"

translate-describe: ## Generate AI project description for Crowdin
	@echo "$(BLUE)Generating project description...$(NC)"
	$(HARVESTER) describe \
		--token=$(CROWDIN_PERSONAL_TOKEN) \
		--project=$(CROWDIN_PROJECT_ID) \
		--output=crowdin
	@echo "$(GREEN)✓ Project description updated$(NC)"
