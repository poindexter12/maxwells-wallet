"""AI assistant: bring-your-own-key chat agent with reversible PII tokenization.

Privacy model: real account/merchant/person names never leave the machine.
They are replaced with stable tokens before any data reaches the LLM, and
mapped back for display and for executing approved actions. Numeric IDs,
amounts, and dates pass through (IDs are not PII).

Capability model: read tools auto-execute; write tools are NEVER executed by
the agent loop. Writes are surfaced as a proposal the user explicitly approves.
The write allowlist is intentionally narrow: budgets, categorization (tags),
and dashboards. Transactions, transfers, imports, accounts, admin, and
settings are off-limits to writes.
"""

# Providers we know how to call. Picked at runtime by which key is configured.
SUPPORTED_PROVIDERS = ("anthropic", "openai")

# Sensible defaults; the model is user-overridable via assistant settings.
DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-sonnet-4-6",
    "openai": "gpt-4o",
}

# Hard cap on agent tool-use iterations to bound cost and prevent runaway loops.
MAX_AGENT_ITERATIONS = 8
