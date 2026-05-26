"""Agent loop: turns a user message into a reply plus an optional write proposal.

Contract enforced here (not left to the model):
- read tools execute and their (already tokenized) output is returned to the model;
- write tools are NEVER executed — they are validated, summarized in plain
  language, and recorded as proposed actions; the model is told they await
  approval;
- the loop is bounded by MAX_AGENT_ITERATIONS;
- the reply shown to the user is detokenized; the stored history keeps tokens so
  the model never re-sees real names on later turns.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from typing import Any

from app.errors import AppException

from . import MAX_AGENT_ITERATIONS
from .providers import LLMProvider, ToolCall
from .store import ProposedAction
from .tokenizer import Tokenizer
from .tools import AssistantContext, get_tool, tool_schemas

_SYSTEM_PROMPT = """You are the assistant for Maxwell's Wallet, a personal finance app. Today is {today}.

You help the user understand their money and can PROPOSE constructive changes for them to approve.
You have read-only tools (spending, budgets, transactions, dashboards) that run automatically, and
proposal tools for three areas ONLY: budgets, categorization (applying bucket tags to transactions),
and dashboards.

Rules:
- You can NEVER create, edit, or delete transactions, move money, import data, or change accounts or
  settings — no such tools exist. Do not claim you can.
- Calling a write tool does NOT perform the action. It queues a proposal the user must approve.
  Describe what you've proposed; never say it's done.
- Privacy: account, merchant, and person names appear to you as tokens like "Merchant 1" or
  "Account 2". Use them naturally — the user sees the real names. Amounts, dates, and ids are real.
- When proposing categorization or an update, use the ids returned by the read tools.
- Be concise and concrete. Prefer calling a tool over guessing.
"""


@dataclass
class AgentResult:
    reply: str
    proposed_actions: list[ProposedAction]
    history: list[dict]


def _system_prompt() -> str:
    return _SYSTEM_PROMPT.format(today=date.today().isoformat())


def _detokenize_args(tokenizer: Tokenizer, args: dict) -> dict:
    """Map any tokens in string arguments back to real values for execution/display."""
    out: dict[str, Any] = {}
    for key, value in args.items():
        if isinstance(value, str):
            out[key] = tokenizer.detokenize(value)
        elif isinstance(value, list):
            out[key] = [tokenizer.detokenize(v) if isinstance(v, str) else v for v in value]
        else:
            out[key] = value
    return out


class Agent:
    def __init__(
        self,
        provider: LLMProvider,
        ctx: AssistantContext,
        max_iterations: int = MAX_AGENT_ITERATIONS,
    ) -> None:
        self.provider = provider
        self.ctx = ctx
        self.max_iterations = max_iterations

    async def _run_tool(self, call: ToolCall, proposed: list[ProposedAction]) -> str:
        """Execute a read tool (returns tokenized JSON) or record a write proposal."""
        tool = get_tool(call.name)
        if tool is None:
            return json.dumps({"error": f"Unknown tool '{call.name}'."})

        try:
            if tool.is_write:
                # Writes are never executed here — validate, detokenize, summarize, queue.
                real_args = _detokenize_args(self.ctx.tokenizer, call.arguments)
                summary = tool.summarizer(real_args)  # type: ignore[misc]
                proposed.append(ProposedAction(tool=tool.name, arguments=real_args, summary=summary))
                return json.dumps({
                    "status": "proposed",
                    "summary": summary,
                    "note": "Not executed. Awaiting the user's approval.",
                })
            result = await tool.handler(self.ctx, call.arguments)  # type: ignore[misc]
            return json.dumps(result, default=str)
        except AppException as exc:
            # Surface validation-style errors to the model so it can correct course.
            return json.dumps({"error": exc.detail if hasattr(exc, "detail") else str(exc)})
        except Exception:  # noqa: BLE001 - keep the chat alive; don't leak internals
            return json.dumps({"error": f"Tool '{call.name}' failed."})

    async def run(self, history: list[dict]) -> AgentResult:
        """Drive the tool-use loop. ``history`` already includes the new user message."""
        system = _system_prompt()
        proposed: list[ProposedAction] = []
        tools = tool_schemas()
        last_text = ""

        for _ in range(self.max_iterations):
            turn = await self.provider.complete(system=system, history=history, tools=tools)
            last_text = turn.text or last_text
            history.append({"role": "assistant", "text": turn.text, "tool_calls": turn.tool_calls})

            if not turn.wants_tools:
                break

            results = []
            for call in turn.tool_calls:
                content = await self._run_tool(call, proposed)
                results.append({"id": call.id, "name": call.name, "content": content})
            history.append({"role": "tool", "results": results})

        reply = self.ctx.tokenizer.detokenize(last_text) or ""
        return AgentResult(reply=reply, proposed_actions=proposed, history=history)
