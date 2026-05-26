# AI Assistant

Ask questions about your finances in plain language, and let the assistant propose changes you approve.

## Overview

The **Assistant** is an in-app chat page in the top navigation. You type a question in natural language ("How much did I spend on groceries last month?") and get an answer drawn from your own data. It can also **propose changes** — like a new budget or a recategorization — which it never applies on its own. You review and approve each proposal before anything takes effect.

The assistant replies in your selected app language.

## Bring Your Own Key (BYOK)

The assistant works with either **Anthropic (Claude)** or **OpenAI**. You supply your own API key.

!!! important "Keys live in the server environment only"
    API keys are configured exclusively through server environment variables — never stored in the database and never sent to the browser. The in-app Assistant settings panel is **read-only**: it shows whether the assistant is configured, which provider is active, and which model is in use. There is no key entry field in the UI.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | One key required | Your Anthropic (Claude) API key |
| `OPENAI_API_KEY` | One key required | Your OpenAI API key |
| `ASSISTANT_PROVIDER` | Optional | `anthropic` or `openai`. If unset, auto-detects from whichever key is present |
| `ASSISTANT_MODEL` | Optional | Overrides the default model |

Provide a key for the provider you want to use. The default model is `claude-sonnet-4-6` for Anthropic and `gpt-4o` for OpenAI.

### Docker Compose example

The app's compose files already pass these variables through, so you can set them in your shell or a `.env` file:

```yaml
services:
  app:
    image: ghcr.io/poindexter12/maxwells-wallet
    environment:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      ASSISTANT_PROVIDER: ${ASSISTANT_PROVIDER:-}
      ASSISTANT_MODEL: ${ASSISTANT_MODEL:-}
```

The `${VAR:-}` form leaves a variable empty when it isn't set, so you only need to define the key(s) you actually use.

## Privacy

Your real account, merchant, and person names never leave the machine.

Before any data is sent to the LLM, the assistant replaces sensitive names with stable pseudonymous tokens:

- Account names → `Account 1`, `Account 2`, …
- Merchant / payee names → `Merchant 1`, `Merchant 2`, …
- People's names → `Person 1`, `Person 2`, …

The tokens are stable within a conversation, so the model can still reason about "Merchant 1" consistently. Numeric IDs, amounts, and dates pass through unchanged. **Raw transaction descriptions and memos are not sent at all.**

When the model replies, the tokens are mapped back to your real names for display, so what you read uses the actual account and merchant names.

!!! note
    Net effect: the LLM provider sees pseudonyms and numbers, never your real account, merchant, or person names — and never your raw transaction descriptions.

## What It Can Do

### Read-only questions

These run automatically — there is nothing to approve, because nothing changes. The assistant can answer questions about:

- Spending summaries
- Spending by category or bucket
- Top merchants
- Transactions
- Budgets
- Tags
- Dashboards

### Proposed changes

The assistant can propose the following, but **never executes them automatically** — you approve each proposal:

- Create or update **budgets**
- **Categorize** transactions by applying bucket tags
- Create or update **dashboards** and widgets

## What It Will Not Do

!!! warning "Hard limits"
    The assistant has no tools for these actions, so it cannot perform them under any circumstances:

    - Create, edit, or delete transactions
    - Move money
    - Import data
    - Change accounts or settings

## Approval Flow

When the assistant proposes changes, they appear as a plain-language list with two buttons:

- **Execute** — apply the proposed changes
- **Dismiss** — discard them

Nothing happens until you click **Execute**. Read-only answers never trigger this flow.

## How to Use

1. Open **Assistant** in the top navigation.
2. If it isn't configured yet, the panel tells you to set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in the server environment (see [Bring Your Own Key](#bring-your-own-key-byok)).
3. Ask a question, for example: *"How much did I spend on groceries last month?"*
4. If the assistant proposes changes, review the list and click **Execute** to apply them or **Dismiss** to discard.
