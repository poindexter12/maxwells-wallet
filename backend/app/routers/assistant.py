"""AI assistant router: configuration status, chat, and approved-action execution.

Security posture:
- All endpoints require an authenticated user.
- API keys and provider/model are configured ONLY via the server environment
  (e.g. Docker Compose) and are never persisted or returned. The config
  endpoint reports read-only status (provider/model/configured), never a key.
- Chat runs read tools automatically; writes are returned as a proposal and
  only run via /execute after explicit user approval.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.errors import ErrorCode, bad_request, not_found
from app.orm import AppSettings, LanguagePreference, User
from app.routers.auth import get_current_user
from app.routers.settings import parse_accept_language
from app.services.assistant import DEFAULT_MODELS, SUPPORTED_PROVIDERS
from app.services.assistant.agent import Agent
from app.services.assistant.env_config import resolve_assistant_config
from app.services.assistant.providers import build_provider
from app.services.assistant.store import (
    Conversation,
    Proposal,
    conversations,
    proposals,
)
from app.services.assistant.tokenizer import Tokenizer
from app.services.assistant.tools import AssistantContext, get_tool

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AssistantConfigResponse(BaseModel):
    """Read-only assistant status. Reflects the server environment; no key."""

    provider: Optional[str] = None
    model: Optional[str] = None
    configured: bool = False
    # How the assistant is configured. Always "env" — keys live only in the
    # server environment, never the database or the browser.
    source: str = "env"
    available_providers: list[str] = Field(default_factory=lambda: list(SUPPORTED_PROVIDERS))
    default_models: dict[str, str] = Field(default_factory=lambda: dict(DEFAULT_MODELS))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_or_create_settings(session: AsyncSession) -> AppSettings:
    """App settings row — used here only to read the language preference."""
    result = await session.execute(select(AppSettings))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = AppSettings()
        session.add(settings)
        await session.commit()
        await session.refresh(settings)
    return settings


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/config", response_model=AssistantConfigResponse)
async def get_config(
    _user: User = Depends(get_current_user),
) -> AssistantConfigResponse:
    """Report assistant status as derived from the server environment."""
    cfg = resolve_assistant_config()
    return AssistantConfigResponse(
        provider=cfg.provider,
        model=cfg.model,
        configured=cfg.configured,
    )


# ---------------------------------------------------------------------------
# Chat + execute
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: Optional[str] = None


class ProposedActionView(BaseModel):
    index: int
    tool: str
    summary: str


class ProposalView(BaseModel):
    id: str
    actions: list[ProposedActionView]


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    proposal: Optional[ProposalView] = None


class ExecuteRequest(BaseModel):
    proposal_id: str
    # Which actions to run (by index). Omit/empty -> run all in the proposal.
    approved_indices: Optional[list[int]] = None


class ExecutedAction(BaseModel):
    index: int
    tool: str
    summary: str
    result: dict


class ExecuteResponse(BaseModel):
    executed: list[ExecutedAction]


def _resolve_locale(settings: AppSettings, request: Request) -> str:
    """The user's effective UI locale, so the assistant replies in their language.

    Uses the stored language preference; when it's 'browser', falls back to the
    request's Accept-Language header (same resolution the settings endpoint uses).
    """
    if settings.language == LanguagePreference.browser.value:
        return parse_accept_language(request.headers.get("Accept-Language", ""))
    return settings.language


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    request: Request,
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChatResponse:
    """Send a message. Read tools run automatically; writes come back as a proposal."""
    cfg = resolve_assistant_config()
    if cfg.provider is None or cfg.api_key is None:
        raise bad_request(
            ErrorCode.ASSISTANT_NOT_CONFIGURED,
            "The assistant is not configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY "
            "in the server environment.",
        )
    provider = build_provider(cfg.provider, cfg.api_key, cfg.model)
    settings = await _get_or_create_settings(session)  # for language preference only
    locale = _resolve_locale(settings, request)

    # Restore (or start) the conversation; the tokenizer lives server-side so the
    # model never re-sees real names across turns.
    convo = conversations.get(req.conversation_id) if req.conversation_id else None
    if convo is None:
        convo = Conversation()
    tokenizer = Tokenizer.from_dict(convo.tokenizer_map)

    history = list(convo.history)
    history.append({"role": "user", "content": req.message})

    ctx = AssistantContext(session=session, tokenizer=tokenizer)
    result = await Agent(provider, ctx, locale=locale).run(history)

    # Persist tokenized history + tokenizer for the next turn.
    convo.history = result.history
    convo.tokenizer_map = tokenizer.to_dict()
    conversation_id = conversations.put(convo, key=req.conversation_id)

    proposal_view: Optional[ProposalView] = None
    if result.proposed_actions:
        proposal_id = proposals.put(Proposal(actions=result.proposed_actions))
        proposal_view = ProposalView(
            id=proposal_id,
            actions=[
                ProposedActionView(index=i, tool=a.tool, summary=a.summary)
                for i, a in enumerate(result.proposed_actions)
            ],
        )

    return ChatResponse(conversation_id=conversation_id, reply=result.reply, proposal=proposal_view)


@router.post("/execute", response_model=ExecuteResponse)
async def execute(
    req: ExecuteRequest,
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExecuteResponse:
    """Run the user-approved actions from a stored proposal.

    Each action is re-validated against the write allowlist before running, so a
    client cannot smuggle in an action the agent never proposed.
    """
    proposal = proposals.get(req.proposal_id)
    if proposal is None:
        raise not_found(
            ErrorCode.ASSISTANT_PROPOSAL_NOT_FOUND,
            "Proposal not found or expired. Ask the assistant again.",
        )

    indices = req.approved_indices
    if not indices:
        indices = list(range(len(proposal.actions)))

    ctx = AssistantContext(session=session, tokenizer=Tokenizer())  # executors use real args
    executed: list[ExecutedAction] = []
    for i in indices:
        if i < 0 or i >= len(proposal.actions):
            raise bad_request(ErrorCode.VALIDATION_ERROR, f"No proposed action at index {i}.")
        action = proposal.actions[i]
        tool = get_tool(action.tool)
        # Defense in depth: only allowlisted *write* tools may ever execute here.
        if tool is None or not tool.is_write or tool.executor is None:
            raise bad_request(
                ErrorCode.ASSISTANT_ACTION_NOT_ALLOWED,
                f"Action '{action.tool}' is not an executable proposal.",
            )
        result = await tool.executor(ctx, action.arguments)
        executed.append(
            ExecutedAction(index=i, tool=action.tool, summary=action.summary, result=result)
        )

    await session.commit()
    proposals.delete(req.proposal_id)  # one-time use
    return ExecuteResponse(executed=executed)
