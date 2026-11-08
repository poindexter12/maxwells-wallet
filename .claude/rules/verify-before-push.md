---
description: Run the same gates CI runs before pushing or calling work done
priority: 60
---
CI blocks on gates that a quick local test run skips. Before you push, or before you report a change
as verified, run every gate the change touches:

- Backend changed (`backend/**`, including `uv.lock` or `pyproject.toml`): `just test::quality`
  (ruff + vulture + mypy) **and** `just test::backend`. mypy is the one that gets missed: a
  dependency bump can break it before a single test runs. On 2026-11-08 SQLAlchemy 2.1 removed the
  `sqlalchemy.ext.mypy` plugin, and only CI noticed.
- Frontend changed (`frontend/**`): `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, run from
  `frontend/`. Run `just dev::build-frontend` too when deps or config changed.
- Report what you actually ran and what you skipped. Tests passing does not mean typecheck passed.
