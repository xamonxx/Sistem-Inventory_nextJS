# Current Status

**Updated:** 2026-10-13
**Knowledge status:** pre-production audit completed; canonical release decision and remediation plan are documented in [`Pre-Production Bug Audit and Remediation Plan`](../docs/obsidian-vault/13-OPERATIONS/Pre-Production-Bug-Audit-and-Plan.md).
**Application behavior:** no application source, schema, dependency, or data was changed by the audit. Documentation now records the expanded release blockers.

## Current source and runtime state
- Development command: `next dev --turbo` on port 3000; production start defaults to 3010.
- Normal local development server is restored and passes the login browser smoke at `http://127.0.0.1:3000/login`.
- Disposable port-3010 audit runtime is stopped.
- Compile gates are green: Prisma validation, type-check, ESLint, security 58/58, production build with 22 routes, production-like browser smoke, and local database invariant sweeps.
- Three-role authentication and workflow evidence from the comprehensive checkpoint remain current; this audit added source, dependency, deployment, recovery, and read-only production checks.
- Release is NO-GO: vulnerable `next@15.5.19`, false receipt totals, post-commit false-failure risk, concurrency gaps, and unproven recovery must be resolved.
- `CustomSelect`, POS category filtering, mobile work, and export changes remain as previously documented.
- Dashboard `/` redesigned in a bento layout (`bento-*` CSS, split chart components); 30-day trend now keyed by local date.
- UI/UX modernization pass (uncommitted until this checkpoint): 64px navbar, calmer tables, global tooltip engine, WhatsApp number dialog, modern checkboxes, unified `.field-surface` fields, redesigned Barang/Stok/Laporan layouts, sidebar drawer fixes, mobile notification bell, theme-aware 404. Details: daily changelog 2026-10-13.
- Non-Gudang UI/UX overhaul: all seven Non-Gudang pages use the shared `src/components/page` primitives (compact headers, bento stat cards and panels, calm tables, single-gradient charts).
- Excel export table headers are colored by column group (identity, date, party, quantity, money, receivable/risk, percent, status) in all three exporters.
- Project-scoped Caveman suite is installed from `JuliusBrussee/caveman`; `caveman` is the mandatory default chat-response skill.
- Context7 `find-docs` is installed project-scoped for current external technology documentation.

## Knowledge evidence
- 88 Vault notes; 30 operational notes; 20/20 Prisma models inventoried.
- 367 resolved wikilinks, 21 Mermaid diagrams, 213 source references, 0 validation errors.
- Source baseline covers 242 files after the audit documentation sync.
- Fresh Level-1 handoff simulation passed 8/8 assertions.
- Caveman policy smoke passed 6/6: skill, lockfile, canonical policy, Codex, Claude, and Gemini entrypoints.
- Context7 policy smoke passed 7/7; live `library` and `docs` CLI lookups succeeded.

## Immediate risks
1. `next@15.5.19` is inside critical advisory ranges; upgrade to at least the audited patched `15.5.27` line before release.
2. Receipt totals are wrong for split-payment, transfer-only, and thermal invoice reprint paths.
3. Post-commit audit/token failures can report a persisted mutation as failed and invite duplicate retries.
4. Gudang invoice edits and Non-Gudang edit-vs-payment paths have unguarded read-check-write races.
5. No tested backup/restore runbook or Prisma migration history exists.
6. Production deployment depends on undocumented host env state and restarts before artifact upload completes.
7. Core transaction flows lack repeatable DB-backed integration tests.

Deep details: [`Risks`](../docs/obsidian-vault/11-ISSUES/Risks.md), [`Known Bugs`](../docs/obsidian-vault/11-ISSUES/Known-Bugs.md), [`Technical Debt`](../docs/obsidian-vault/08-ENGINEERING/Technical-Debt.md).
