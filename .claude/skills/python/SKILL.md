---
name: python
description: Use when editing Python 3.14 application, service, test, or tooling code, especially asynchronous FastAPI-adjacent code.
---

- Type-hint everything (including dependency returns); avoid mutable default args.
- Prefer dataclasses or Pydantic for structured data; isolate side effects at module boundaries.
- Concurrency: await all IO; avoid blocking calls in async handlers; use background tasks sparingly.
- Logging: structured logs over `print`; add context without leaking secrets.
- Error handling: raise specific exceptions; map to typed HTTP errors at boundaries; avoid broad excepts.
- Packaging: keep dependencies minimal; pin versions in lockfiles; avoid mixing `pip`/`uv` flows.
- Code quality: keep modules small; extract pure functions for business logic; prefer composition over inheritance.
