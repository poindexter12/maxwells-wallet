# Waypoint (Shared AI Configs)

Canonical home for agent and skill configs. Edit files here; symlinks keep Claude, Codex, and Cursor in sync.

## Layout
```
.waypoint/
  agents/   # Agent definitions (techlead, frontend-lead, backend-lead, db-lead, testlead)
  skills/   # Per-topic skill cards (Next.js, FastAPI, Postgres, TS, Python, DB design, testing, etc.)
  README.md # This file
```

## Symlinks (tool entry points)
- `.claude/agents`  → `.waypoint/agents`
- `.claude/skills`  → `.waypoint/skills`
- `.codex/agents`   → `.waypoint/agents`
- `.codex/skills`   → `.waypoint/skills`
- `.cursor/agents`  → `.waypoint/agents`
- `.cursor/skills`  → `.waypoint/skills`

If you add a new agent or skill, place it under `.waypoint/…` and the tools will see it through the symlinks.
