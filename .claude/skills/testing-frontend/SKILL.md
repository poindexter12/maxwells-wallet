---
name: testing-frontend
description: Use when adding or reviewing React, Next.js, component, integration, or Playwright frontend tests under frontend/.
---

- Prefer React Testing Library for component/integration tests; focus on user-observable behavior over implementation details.
- Mock network via fetch mock/handlers; avoid real backend calls. Keep snapshots small and meaningful or avoid them.
- For end-to-end flows, prefer Playwright with stable selectors (data-testid) and deterministic seeds; avoid brittle timing waits.
- Cover loading/error/empty states; test server actions/route handlers through API-like calls instead of unit-mocking internals.
- Keep tests fast: minimal renders, cleanup between tests, and scoped fixtures.
- State and events: assert on screen text/roles; avoid testing implementation props/state directly; simulate keyboard/mouse with RTL helpers.
- Accessibility: query by role/name/label where possible; ensure focus management is tested for modals/dialogs.
- Organization: co-locate tests near components or under `__tests__`; name tests by behavior; avoid massive kitchen-sink specs.
