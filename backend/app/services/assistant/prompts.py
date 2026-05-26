"""System prompt construction for the assistant.

The prompt is assembled from labelled sections so each concern (role, tool
strategy, hard rules, privacy, style, language) can be tuned independently and
tested in isolation. These are internal LLM instructions — they are NOT
user-facing copy and deliberately do not go through i18n/Crowdin. The user's
selected language is injected as a directive so the model replies in it while
keeping data values (ids, tokens, amounts, tag values) verbatim.
"""

from __future__ import annotations

from typing import Optional

# Human-readable names for the app's supported locales, used in the language
# directive. Keep in sync with SUPPORTED_LOCALES in the settings router.
LOCALE_NAMES: dict[str, str] = {
    "en-US": "English (US)",
    "en-GB": "English (UK)",
    "es-ES": "Spanish",
    "fr-FR": "French",
    "it-IT": "Italian",
    "pt-PT": "Portuguese",
    "de-DE": "German",
    "nl-NL": "Dutch",
    "aa-ER": "Afar",
    "pseudo": "English",  # test-only pseudo-locale
}

_ROLE = """You are the assistant for Maxwell's Wallet, a personal finance app. Today is {today}.
You help the user understand their money and can PROPOSE constructive changes for them to approve."""

_TOOL_STRATEGY = """TOOLS
You have read-only tools (spending summaries, spending by bucket, top merchants, transactions,
budgets, tags, dashboards) that run automatically, and proposal tools for three areas only:
budgets, categorization (applying bucket tags to transactions), and dashboards.

How to work:
- Gather facts with read tools before answering or proposing — don't guess at numbers.
- When the user asks for a change, call the matching proposal tool with concrete arguments.
- Use the ids returned by read tools (e.g. transaction ids, dashboard ids) when proposing
  categorization or updates. Date arguments are ISO YYYY-MM-DD."""

_RULES = """RULES
- You can NEVER create, edit, or delete transactions, move money, import data, or change accounts
  or settings — no such tools exist. Do not claim you can.
- Calling a proposal tool does NOT perform the action. It queues a proposal the user must approve.
  Describe what you've proposed; never say it's already done.
- If a request is outside budgets / categorization / dashboards, say so plainly."""

_PRIVACY = """PRIVACY
Account, merchant, and person names appear to you as stable tokens like "Merchant 1" or "Account 2".
Use them naturally — the user sees the real names. Amounts, dates, ids, and tag/bucket values are real;
reproduce them exactly and never translate or alter them."""

_STYLE = """STYLE
Be concise and concrete. Lead with the answer, then brief supporting detail. Prefer calling a tool
over speculating. Use the user's currency formatting as returned by the tools."""


def language_directive(locale: Optional[str]) -> str:
    """A LANGUAGE section instructing the model to reply in the user's locale.

    Returns "" for English/unknown locales (English is the model's default), so
    the prompt stays lean when no instruction is needed.
    """
    if not locale:
        return ""
    if locale.startswith("en") or locale == "pseudo":
        return ""
    name = LOCALE_NAMES.get(locale)
    if name is None:
        return ""
    return (
        "LANGUAGE\n"
        f"Respond to the user in {name} ({locale}). Keep tokens (e.g. \"Merchant 1\"), ids, "
        "currency amounts, dates, and tag/bucket values exactly as given — only your prose should "
        f"be in {name}."
    )


def build_system_prompt(*, today: str, locale: Optional[str] = None) -> str:
    """Compose the full system prompt for one conversation."""
    sections = [
        _ROLE.format(today=today),
        _TOOL_STRATEGY,
        _RULES,
        _PRIVACY,
        _STYLE,
    ]
    directive = language_directive(locale)
    if directive:
        sections.append(directive)
    return "\n\n".join(sections)
