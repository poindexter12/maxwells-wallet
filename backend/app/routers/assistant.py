"""AI assistant router: configuration, chat, and approved-action execution.

Security posture:
- All endpoints require an authenticated user.
- The API key is write-only: it can be set but is never returned (the config
  endpoint reports only whether a key is configured).
- Chat runs read tools automatically; writes are returned as a proposal and
  only run via /execute after explicit user approval.
"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_config
from app.database import get_session
from app.errors import ErrorCode, bad_request, not_found
from app.orm import AppSettings, User
from app.routers.auth import get_current_user
from app.services.assistant import DEFAULT_MODELS, SUPPORTED_PROVIDERS
from app.services.assistant.agent import Agent
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
    """Assistant configuration as seen by the client. Never includes the key."""

    provider: Optional[str] = None
    model: Optional[str] = None
    # True when a usable key exists (stored in the DB or supplied via env).
    configured: bool = False
    # Whether a key is present specifically in the DB (vs. env-only).
    key_stored: bool = False
    available_providers: list[str] = Field(default_factory=lambda: list(SUPPORTED_PROVIDERS))
    default_models: dict[str, str] = Field(default_factory=lambda: dict(DEFAULT_MODELS))


class AssistantConfigUpdate(BaseModel):
    """Update assistant configuration.

    - Set ``api_key`` to a non-empty string to store a new key.
    - Set ``clear_api_key=True`` to remove the stored key.
    - Omitted fields are left unchanged.
    """

    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = Field(default=None, repr=False)
    clear_api_key: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_or_create_settings(session: AsyncSession) -> AppSettings:
    result = await session.execute(select(AppSettings))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = AppSettings()
        session.add(settings)
        await session.commit()
        await session.refresh(settings)
    return settings


def _env_key_for(provider: Optional[str]) -> str:
    """API key supplied via environment for the given provider, if any."""
    if provider == "anthropic":
        return app_config.anthropic_api_key
    if provider == "openai":
        return app_config.openai_api_key
    return ""


def resolve_api_key(settings: AppSettings) -> str:
    """Effective API key: stored key wins, else the env fallback. Never returned to clients."""
    return settings.assistant_api_key or _env_key_for(settings.assistant_provider)


def _to_response(settings: AppSettings) -> AssistantConfigResponse:
    key_stored = bool(settings.assistant_api_key)
    configured = bool(resolve_api_key(settings)) and bool(settings.assistant_provider)
    return AssistantConfigResponse(
        provider=settings.assistant_provider,
        model=settings.assistant_model,
        configured=configured,
        key_stored=key_stored,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/config", response_model=AssistantConfigResponse)
async def get_config(
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AssistantConfigResponse:
    """Return assistant configuration status. Never returns the API key."""
    settings = await _get_or_create_settings(session)
    return _to_response(settings)


@router.put("/config", response_model=AssistantConfigResponse)
async def update_config(
    updates: AssistantConfigUpdate,
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AssistantConfigResponse:
    """Update provider, model, and/or API key. The key is write-only."""
    settings = await _get_or_create_settings(session)

    if updates.provider is not None:
        if updates.provider not in SUPPORTED_PROVIDERS:
            raise bad_request(
                ErrorCode.VALIDATION_ERROR,
                f"Unsupported provider '{updates.provider}'. "
                f"Choose one of: {', '.join(SUPPORTED_PROVIDERS)}.",
            )
        settings.assistant_provider = updates.provider
        # Default the model when switching providers and none is set/given.
        if updates.model is None and not settings.assistant_model:
            settings.assistant_model = DEFAULT_MODELS.get(updates.provider)

    if updates.model is not None:
        settings.assistant_model = updates.model or None

    if updates.clear_api_key:
        settings.assistant_api_key = None
    elif updates.api_key:
        settings.assistant_api_key = updates.api_key

    await session.commit()
    await session.refresh(settings)
    return _to_response(settings)


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


async def _build_agent_provider(session: AsyncSession):
    """Resolve assistant config into a ready provider, or 400 if not configured."""
    settings = await _get_or_create_settings(session)
    api_key = resolve_api_key(settings)
    if not settings.assistant_provider or not api_key:
        raise bad_request(
            ErrorCode.ASSISTANT_NOT_CONFIGURED,
            "The assistant is not configured. Set a provider and API key first.",
        )
    return build_provider(settings.assistant_provider, api_key, settings.assistant_model)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChatResponse:
    """Send a message. Read tools run automatically; writes come back as a proposal."""
    provider = await _build_agent_provider(session)

    # Restore (or start) the conversation; the tokenizer lives server-side so the
    # model never re-sees real names across turns.
    convo = conversations.get(req.conversation_id) if req.conversation_id else None
    if convo is None:
        convo = Conversation()
    tokenizer = Tokenizer.from_dict(convo.tokenizer_map)

    history = list(convo.history)
    history.append({"role": "user", "content": req.message})

    ctx = AssistantContext(session=session, tokenizer=tokenizer)
    result = await Agent(provider, ctx).run(history)

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
