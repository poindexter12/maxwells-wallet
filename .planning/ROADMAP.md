# Roadmap: Maxwell's Wallet

## Milestones

- ✅ **v1.0 DevSecOps Tooling** — Phases 1-6 (shipped 2026-02-23)
- ✅ **v1.1 Codebase Health** — Phases 7-11 (shipped 2026-02-26)
- ✅ **v1.2 Build System Modernization** — Phases 12-16 (shipped 2026-02-27)

## Phases

<details>
<summary>✅ v1.0 DevSecOps Tooling (Phases 1-6) — SHIPPED 2026-02-23</summary>

See `milestones/v1.0-ROADMAP.md` for archived v1.0 phase details.

**Delivered:** Five security scanning tools running non-blocking in GitHub Actions CI, producing unified SARIF findings in the GitHub Security tab.

**Phases:**
1. Foundation & SAST (Semgrep)
2. SCA & Repository Health (OWASP Dependency-Check, OpenSSF Scorecard)
3. Container Scanning (Trivy)
4. DAST (OWASP ZAP)
5. Documentation
6. Formal Verification Sweep

</details>

<details>
<summary>✅ v1.1 Codebase Health (Phases 7-11) — SHIPPED 2026-02-26</summary>

See `milestones/v1.1-ROADMAP.md` for archived v1.1 phase details.

**Delivered:** Addressed all 11 actionable codebase audit concerns — dashboard extraction (-90%), bug fixes, error handling, type safety, 93+ unit tests, i18n pipeline, and backend hardening for Postgres migration readiness.

**Phases:**
- [x] Phase 7: Type Safety + Dashboard Extraction (1/1 plans) — completed 2026-02-24
- [x] Phase 8: Dashboard Polish + Error Handling (3/3 plans) — completed 2026-02-24
- [x] Phase 9: Performance + Frontend Tests (3/3 plans) — completed 2026-02-25
- [x] Phase 10: Internationalization (3/3 plans) — completed 2026-02-25
- [x] Phase 11: Backend Hardening (2/2 plans) — completed 2026-02-26

</details>

<details>
<summary>✅ v1.2 Build System Modernization (Phases 12-16) — SHIPPED 2026-02-27</summary>

See `milestones/v1.2-ROADMAP.md` for archived v1.2 phase details.

**Delivered:** Replaced Make with Just + gum for a modern task runner experience, with mise as the single prerequisite managing all dev tooling.

**Phases:**
- [x] Phase 12: Tool Foundation (1/1 plans) — completed 2026-02-26
- [x] Phase 13: Justfile Migration (2/2 plans) — completed 2026-02-27
- [x] Phase 14: Integration (2/2 plans) — completed 2026-02-27
- [x] Phase 15: Documentation (2/2 plans) — completed 2026-02-27
- [x] Phase 16: Cleanup (1/1 plan) — completed 2026-02-27

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & SAST | v1.0 | 1/1 | Complete | 2026-02-23 |
| 2. SCA & Repository Health | v1.0 | 2/2 | Complete | 2026-02-23 |
| 3. Container Scanning | v1.0 | 1/1 | Complete | 2026-02-23 |
| 4. DAST | v1.0 | 1/1 | Complete | 2026-02-23 |
| 5. Documentation | v1.0 | 1/1 | Complete | 2026-02-23 |
| 6. Formal Verification Sweep | v1.0 | 1/1 | Complete | 2026-02-23 |
| 7. Type Safety + Dashboard Extraction | v1.1 | 1/1 | Complete | 2026-02-24 |
| 8. Dashboard Polish + Error Handling | v1.1 | 3/3 | Complete | 2026-02-24 |
| 9. Performance + Frontend Tests | v1.1 | 3/3 | Complete | 2026-02-25 |
| 10. Internationalization | v1.1 | 3/3 | Complete | 2026-02-25 |
| 11. Backend Hardening | v1.1 | 2/2 | Complete | 2026-02-26 |
| 12. Tool Foundation | v1.2 | 1/1 | Complete | 2026-02-26 |
| 13. Justfile Migration | v1.2 | 2/2 | Complete | 2026-02-27 |
| 14. Integration | v1.2 | 2/2 | Complete | 2026-02-27 |
| 15. Documentation | v1.2 | 2/2 | Complete | 2026-02-27 |
| 16. Cleanup | v1.2 | 1/1 | Complete | 2026-02-27 |
