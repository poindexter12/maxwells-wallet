"""Tests for the AI assistant: tokenizer, tool allowlist, propose-not-execute,
execute re-validation, and config key handling.

The LLM provider is always mocked — no network calls.
"""

import json
from datetime import date

import pytest
from sqlalchemy import func, select

from app.orm import Budget, Tag, Transaction, User
from app.utils.auth import create_access_token, hash_password

from app.services.assistant.agent import Agent
from app.services.assistant.prompts import build_system_prompt, language_directive
from app.services.assistant.providers import AssistantTurn, LLMProvider, ToolCall
from app.services.assistant.store import Proposal, ProposedAction, proposals
from app.services.assistant.tokenizer import Tokenizer
from app.services.assistant import tools as tools_mod
from app.services.assistant.tools import AssistantContext, get_tool


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def test_user(async_session):
    user = User(username="assistant_user", password_hash=hash_password("pw123456"))
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


@pytest.fixture
async def seed_txns(async_session):
    """A couple of transactions with merchant + account for tokenization tests."""
    rows = [
        Transaction(date=date(2026, 4, 1), amount=-50.0, description="x", merchant="Trader Joes", account_source="Chase Checking"),
        Transaction(date=date(2026, 4, 2), amount=-30.0, description="y", merchant="Costco", account_source="Chase Checking"),
        Transaction(date=date(2026, 4, 3), amount=1000.0, description="z", merchant="Employer Inc", account_source="Chase Checking"),
    ]
    async_session.add_all(rows)
    await async_session.commit()
    return rows


class MockProvider(LLMProvider):
    """Returns scripted turns in order; records nothing over the network."""

    name = "mock"

    def __init__(self, script):
        self.script = script
        self.i = 0

    async def complete(self, *, system, history, tools):
        turn = self.script[self.i]
        self.i += 1
        return turn


# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------


class TestTokenizer:
    def test_stable_and_distinct(self):
        t = Tokenizer()
        assert t.tokenize("Trader Joes", "merchant") == "Merchant 1"
        assert t.tokenize("Trader Joes", "merchant") == "Merchant 1"  # stable
        assert t.tokenize("Costco", "merchant") == "Merchant 2"
        assert t.tokenize("Chase Checking", "account") == "Account 1"

    def test_round_trip_and_collision_safe(self):
        t = Tokenizer()
        first = t.tokenize("Trader Joes", "merchant")  # Merchant 1
        for n in range(10):
            t.tokenize(f"Shop{n}", "merchant")
        eleventh = t.tokenize("Eleventh", "merchant")  # Merchant 12-ish
        text = f"Top: {first}, then {eleventh}."
        assert t.detokenize(text) == "Top: Trader Joes, then Eleventh."

    def test_passthrough_and_serialize(self):
        t = Tokenizer()
        assert t.tokenize(None, "merchant") is None
        assert t.tokenize("", "merchant") == ""
        t.tokenize("Acme", "merchant")
        t2 = Tokenizer.from_dict(t.to_dict())
        assert t2.detokenize("Merchant 1") == "Acme"


# ---------------------------------------------------------------------------
# Tool registry / allowlist
# ---------------------------------------------------------------------------


class TestToolRegistry:
    def test_integrity(self):
        for tool in tools_mod.all_tools():
            if tool.is_write:
                assert tool.executor and tool.summarizer, tool.name
            else:
                assert tool.handler, tool.name

    def test_write_allowlist_is_narrow(self):
        writes = {t.name for t in tools_mod.all_tools() if t.is_write}
        assert writes == {
            "create_budget",
            "update_budget",
            "categorize_transactions",
            "create_dashboard",
            "update_dashboard",
            "add_dashboard_widget",
        }

    def test_no_dangerous_tools_exist(self):
        names = {t.name for t in tools_mod.all_tools()}
        forbidden = {
            "create_transaction", "update_transaction", "delete_transaction",
            "create_transfer", "import_transactions", "create_account",
            "delete_budget", "delete_dashboard", "run_sql", "update_settings",
        }
        assert names.isdisjoint(forbidden)


# ---------------------------------------------------------------------------
# Read tools tokenize their output
# ---------------------------------------------------------------------------


class TestReadToolsTokenize:
    async def test_merchants_and_accounts_are_tokenized(self, async_session, seed_txns):
        ctx = AssistantContext(session=async_session, tokenizer=Tokenizer())
        out = await get_tool("list_transactions").handler(ctx, {"limit": 10})
        blob = json.dumps(out)
        # Real PII must not appear; tokens must.
        assert "Trader Joes" not in blob and "Chase Checking" not in blob
        assert "Merchant" in blob and "Account" in blob
        # ids/amounts pass through
        assert out["transactions"][0]["amount"] in (-50.0, -30.0, 1000.0)


# ---------------------------------------------------------------------------
# Agent loop: reads run, writes are proposed (not executed), reply detokenized
# ---------------------------------------------------------------------------


class TestAgentLoop:
    async def test_chat_proposes_without_executing(self, async_session, seed_txns):
        tok = Tokenizer()
        ctx = AssistantContext(session=async_session, tokenizer=tok)
        script = [
            AssistantTurn(text="Checking.", tool_calls=[ToolCall("c1", "get_top_merchants", {"limit": 1})]),
            AssistantTurn(text="", tool_calls=[ToolCall("c2", "create_budget", {"tag": "bucket:dining", "amount": 200})]),
            AssistantTurn(text="Your top merchant is Merchant 1; I proposed a dining budget.", tool_calls=[]),
        ]
        before = (await async_session.execute(select(func.count(Budget.id)))).scalar()
        res = await Agent(MockProvider(script), ctx).run(
            [{"role": "user", "content": "set a dining budget; who's my top merchant?"}]
        )
        after = (await async_session.execute(select(func.count(Budget.id)))).scalar()

        assert after == before, "chat must NOT execute writes"
        assert len(res.proposed_actions) == 1
        assert res.proposed_actions[0].tool == "create_budget"
        # reply detokenized to a real merchant name (not the token)
        assert "Merchant 1" not in res.reply
        assert "Trader Joes" in res.reply


# ---------------------------------------------------------------------------
# Prompts + language directive
# ---------------------------------------------------------------------------


class TestPrompts:
    def test_core_sections_present(self):
        p = build_system_prompt(today="2026-05-25")
        assert "Maxwell's Wallet" in p
        assert "TOOLS" in p and "RULES" in p and "PRIVACY" in p
        assert "2026-05-25" in p
        assert "LANGUAGE" not in p  # English default needs no directive

    def test_directive_for_non_english_locales(self):
        assert language_directive("es-ES").startswith("LANGUAGE")
        assert "Spanish" in language_directive("es-ES")
        p = build_system_prompt(today="2026-05-25", locale="fr-FR")
        assert "LANGUAGE" in p and "French" in p

    def test_no_directive_for_english_or_unknown(self):
        for loc in ("en-US", "en-GB", "pseudo", None, "zz-ZZ"):
            assert language_directive(loc) == ""

    async def test_locale_reaches_system_prompt(self, async_session):
        captured: dict = {}

        class CapturingProvider(LLMProvider):
            name = "cap"

            def __init__(self):
                pass

            async def complete(self, *, system, history, tools):
                captured["system"] = system
                return AssistantTurn(text="Hola", tool_calls=[])

        ctx = AssistantContext(session=async_session, tokenizer=Tokenizer())
        await Agent(CapturingProvider(), ctx, locale="es-ES").run(
            [{"role": "user", "content": "hola"}]
        )
        assert "Spanish" in captured["system"]


# ---------------------------------------------------------------------------
# Execute endpoint: runs approved actions, re-validates against the allowlist
# ---------------------------------------------------------------------------


class TestExecuteEndpoint:
    async def test_execute_runs_proposed_budget(self, client, auth_headers, async_session):
        before = (await async_session.execute(select(func.count(Budget.id)))).scalar()
        pid = proposals.put(Proposal(actions=[
            ProposedAction(tool="create_budget", arguments={"tag": "bucket:travel", "amount": 500, "period": "monthly"}, summary="Create a monthly budget of $500.00 for bucket:travel"),
        ]))
        resp = await client.post("/api/v1/assistant/execute", json={"proposal_id": pid}, headers=auth_headers)
        assert resp.status_code == 200, resp.text
        after = (await async_session.execute(select(func.count(Budget.id)))).scalar()
        assert after == before + 1
        assert resp.json()["executed"][0]["tool"] == "create_budget"

    async def test_execute_rejects_non_write_tool(self, client, auth_headers, async_session):
        """Defense in depth: a proposal naming a READ tool must not execute."""
        pid = proposals.put(Proposal(actions=[
            ProposedAction(tool="get_spending_summary", arguments={}, summary="(forged)"),
        ]))
        resp = await client.post("/api/v1/assistant/execute", json={"proposal_id": pid}, headers=auth_headers)
        assert resp.status_code == 400
        assert resp.json()["detail"]["error_code"] == "ASSISTANT_ACTION_NOT_ALLOWED"

    async def test_execute_unknown_proposal_404(self, client, auth_headers):
        resp = await client.post("/api/v1/assistant/execute", json={"proposal_id": "nope"}, headers=auth_headers)
        assert resp.status_code == 404

    async def test_execute_requires_auth(self, client):
        resp = await client.post("/api/v1/assistant/execute", json={"proposal_id": "x"})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Config endpoint: key is write-only, provider validated, auth required
# ---------------------------------------------------------------------------


class TestConfigEndpoint:
    async def test_requires_auth(self, client):
        assert (await client.get("/api/v1/assistant/config")).status_code == 401

    async def test_set_key_is_write_only(self, client, auth_headers):
        resp = await client.put(
            "/api/v1/assistant/config",
            json={"provider": "anthropic", "api_key": "sk-secret-123", "model": "claude-sonnet-4-6"},
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["configured"] is True
        assert body["key_stored"] is True
        # The key must never be echoed back anywhere in the payload.
        assert "sk-secret-123" not in json.dumps(body)
        assert "api_key" not in body

        got = (await client.get("/api/v1/assistant/config", headers=auth_headers)).json()
        assert got["provider"] == "anthropic"
        assert "sk-secret-123" not in json.dumps(got)

    async def test_invalid_provider_rejected(self, client, auth_headers):
        resp = await client.put(
            "/api/v1/assistant/config", json={"provider": "bogus"}, headers=auth_headers
        )
        assert resp.status_code == 400

    async def test_chat_requires_configuration(self, client, auth_headers):
        """With no provider/key configured, chat returns a clear 'not configured' error."""
        resp = await client.post(
            "/api/v1/assistant/chat", json={"message": "hi"}, headers=auth_headers
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["error_code"] == "ASSISTANT_NOT_CONFIGURED"
