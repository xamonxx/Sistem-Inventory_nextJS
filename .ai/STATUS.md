# Current Status

**Updated:** 2026-10-12 23:18:31 +07:00
**Knowledge status:** complete and validated; see [`Verification Report`](../docs/obsidian-vault/00-HOME/Verification-Report.md).
**Application behavior:** the knowledge-system phase did not intentionally modify application source.

## Current source state
- Development command: `next dev --turbo` (default port 3000, matches README, launcher, smoke test); production start: 3010.
- `CustomSelect` menu is portaled to `document.body` with fixed positioning/z-index 2147483005.
- Repository contains many pre-existing/uncommitted application changes; preserve them.
- External source drift during validation added a POS category filter and terminology/export-label updates; relevant component documentation was synchronized.
- Compile gate is green: `npm run type-check` passes. `KasirClient.tsx:385` uses `res.grandTotal ?? 0`; producer (`kasir/actions.ts`) always returns `grandTotal: number` on `ok`. Checkout smoke against a real DB is not yet run (needs approval: it mutates stock).
- Lint passed (re-run 2026-10-12); security validation passed 58/58.
- `npx next build` passes (2026-10-12, 22 static pages). `npm run build` fails with Prisma EPERM while a dev server is running because `prisma generate` cannot replace the locked query engine DLL; stop the dev server first or build with `npx next build` when the schema is unchanged.
- Known local observation: Turbopack ENOENT on a generated `.next` manifest path; root cause not verified.
- Project-scoped Caveman suite is installed from `JuliusBrussee/caveman`; `caveman` is the mandatory default chat-response skill.
- Context7 `find-docs` is installed project-scoped for current external technology documentation.

## Knowledge evidence
- 85 Vault notes; 14 identified module notes; 20/20 Prisma models inventoried.
- 328 resolved wikilinks, 21 Mermaid diagrams, 181 source references, 0 validation errors.
- Source baseline covers 232 files, including project Agent skills, root entrypoints, operational memory, and Context7 rules.
- Fresh Level-1 handoff simulation passed 8/8 assertions.
- Caveman policy smoke passed 6/6: skill, lockfile, canonical policy, Codex, Claude, and Gemini entrypoints.
- Context7 policy smoke passed 7/7; live `library` and `docs` CLI lookups succeeded.

## Immediate risks
1. Behavior-test POS checkout against a disposable DB (type mismatch itself is fixed).
2. (resolved) Read-page role guards now aligned; no browser role test yet.
3. No tested backup/restore runbook or Prisma migration history.
4. Core transaction flows lack DB integration tests.
5. Feature documentation drift (port drift fixed; `.env` APP_URL still 3001).

Deep details: [`Risks`](../docs/obsidian-vault/11-ISSUES/Risks.md), [`Known Bugs`](../docs/obsidian-vault/11-ISSUES/Known-Bugs.md), [`Technical Debt`](../docs/obsidian-vault/08-ENGINEERING/Technical-Debt.md).
