# Latest Handoff

**Updated:** 2026-10-12 23:18:31 +07:00
**State:** application compile, lint, security, and knowledge-validation gates pass.

## Startup
1. Read `.ai/STATUS.md`, `.ai/CONTEXT.md`, `.ai/AGENTS.md`, `.ai/TASKS.md`, and this handoff.
2. Run `git status --short` and `node scripts/knowledge-sync.mjs check`.
3. Preserve existing uncommitted source changes.
4. Load only the affected Vault/source context.

## Recommended next task
Checkout type mismatch at `src/app/(app)/kasir/KasirClient.tsx:385` is resolved (`res.grandTotal ?? 0`; producer always returns a number on `ok`). `npm run type-check` and `npm run lint` pass. Remaining: run an actual checkout smoke on a disposable DB (approval needed), then pick the next backlog item in `TASKS.md`.

## Do not lose
- Dev port is 3000 everywhere (package.json dev script reverted to default). `.env` NEXT_PUBLIC_APP_URL still says 3001: user must update.
- Dev DB now contains additive dummy data marked `DMY-` (gudang item codes) and `DMY ` (NG product/consumer names); remove with `npm run db:clear:dummy` only after approval.
- `CustomSelect` overlay uses a body portal and z-index 2147483005.
- Caveman is mandatory for chat. Read `.agents/skills/caveman/SKILL.md` before responding; only explicit `stop caveman` or `normal mode` disables it.
- Context7 is mandatory for current external library/framework/API documentation. Read `.agents/skills/find-docs/SKILL.md`; Claude also uses `.claude/rules/context7.md`.
- POS now has `ITEM_CATEGORIES` filtering from concurrent external edits.
- Mobile rounds 1-3b applied (see TASKS); `npx next build` passes. `npm run build` hits Prisma EPERM while dev server runs.
- Never run `next build` while `next start` serves port 3000: the running server keeps the old manifest and the app breaks with a client-side exception. Stop it first, rebuild, restart. Dev server now runs via `npm run dev` in Terminal tab "dev server".
- Mobile round 1 applied (see TASKS). Authenticated pages not visually verified; the 11px text floor in globals.css is blind-applied (screen <=640px only) and may need tuning.
- Core risks: no tested migration/backup path, limited DB integration tests, and no real checkout smoke on a disposable database.
- Knowledge validator currently reports 85 Vault notes, 328 wikilinks, 21 diagrams, 181 source refs, 0 errors; source baseline covers 232 files.
- Caveman policy smoke passed 6/6.
- Context7 policy smoke passed 7/7; live library resolution and docs retrieval succeeded.

## Deep entry
Vault dashboard: `docs/obsidian-vault/00-HOME/Dashboard.md`. Measured report: `docs/obsidian-vault/00-HOME/Verification-Report.md`.
