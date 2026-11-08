---
name: testing-python
description: Use when adding or reviewing pytest coverage for Python and FastAPI code under backend/.
---

- Use `pytest` with clear fixtures; avoid global state. Prefer async-capable clients for FastAPI (e.g., httpx AsyncClient).
- Keep tests deterministic: seed randomness, freeze time when needed, avoid real network/file side effects unless explicitly required.
- Coverage: target meaningful coverage on branches and error paths; add regression tests for reported bugs.
- Structure: place API tests under `tests/` mirroring app modules; name tests descriptively; keep assertions focused and specific.
- Fixtures: use factory fixtures for data; keep DB setup/teardown isolated; avoid cross-test coupling.
- Mocking: prefer fakes over mocks when simple; keep monkeypatch scope tight; avoid over-mocking that hides behavior regressions.
- Lint/type: run `ruff`/`mypy` alongside pytest where useful; keep asserts readable; avoid asserting on internal/private attributes when public behavior exists.
