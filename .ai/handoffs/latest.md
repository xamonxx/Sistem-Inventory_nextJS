# Latest Handoff

**Updated:** 2026-10-13
**State:** local multi-location Gudang catalog import completed; owner authorized a full production database replacement and staged serverone deployment.

## Latest change: Gudang catalog import
- Local database now contains 475 active items: 73 main, 18 Depok, and 384 LK.
- HPL is a supported Gudang/Kasir category. Depok/LK suffixes distinguish internal prices; `Nota` and `InvoiceDocument` hide those suffixes from customer output.
- `npm run db:add-items` is the safe preview. `npm run db:add-items -- --apply` is transactional, preserves stock on existing items, and records an audit summary only when changes occur.
- Idempotency proof: second dry-run returned 0 create / 0 update / 475 unchanged. DB invariants and formatter tests passed; type-check, ESLint, and security 68/68 passed.
- Three LK rows are intentionally excluded pending corrected prices: Block Board Polos 15mm, TACO TH 050 AA, and TACO TH 887 JG.
- Do not run the importer against production until a verified backup exists, its production dry-run is reviewed, and the user explicitly approves the mutation.
- Owner approval now covers replacing the active production database with the verified local database. Preserve and download a complete production backup before reset.
- `.github/workflows/deploy.yml` is manual-only because its job still targets the obsolete Hostinger host. Deploy serverone manually through the staged aaPanel release procedure.

## Startup
1. Read `.ai/STATUS.md`, `.ai/CONTEXT.md`, `.ai/AGENTS.md`, `.ai/TASKS.md`, this handoff, and `docs/obsidian-vault/13-OPERATIONS/Pre-Production-Bug-Audit-and-Plan.md`.
2. Run `git status --short` and `node scripts/knowledge-sync.mjs check`.
3. Preserve existing user changes and do not expose credentials.

## Latest documentation change
- Separate Word guides are available in `docs/user-guides/` for Admin Gudang, Admin Kasir, and Admin Non-Gudang.
- Canonical index: `docs/obsidian-vault/13-OPERATIONS/User-Guides-by-Role.md`.
- The guides document current role menus and operating workflows only; no application behavior or production data was changed.

## Required next task
Execute Phase 0 from the pre-production audit in this order:
1. **Done (`0dfdd83`):** `next@15.5.27` pinned; production audit 0 critical / 0 high / 2 moderate (`exceljs` -> `uuid`, unreachable path).
2. **Done (`249c400`):** CREDIT = unpaid receivable (ADR-004); all receipt paths print persisted paid/remaining values. Still needed: read-only production check for historical CREDIT Payment rows.
3. **Done:** Make mutation outcomes atomic/idempotent so post-commit audit or verification helpers cannot produce a false failure.
   - Production prerequisite: create `idempotency_keys` before deploying (`docs/obsidian-vault/13-OPERATIONS/Idempotency-Schema-Rollout.md`). Local DB already has it; `next build` was not run in this step because another session's dev server held `.next`.
4. **Done (`5b8d15b`):** invoice-edit races serialized with `runSerializable` retry; stock cache invalidated on invoice edit/delete; conflict losers get actionable messages; `npm run test:concurrency` 24/24.
5. **Next:** prove backup/restore and required production runtime env before deployment (owner action), then Phase 1.

Do not push or deploy until the audit exit criteria pass.

## Latest source change (Non-Gudang overhaul, committed 2026-10-13)
- All seven Non-Gudang pages rebuilt on `src/components/page` primitives (`PageHeader`, `StatCard`/`StatGrid`, `Panel`, `StatusDot`, `TonePill`, `IconAction`, `FilterBar`). Logic, actions, exports, and print untouched.
- Gotcha: unlayered global `h1`/`h2`/`h3` rules in `globals.css` override Tailwind text sizes; use `!text-*` on headings inside components.
- Pending: Non-Gudang Excel/PDF click test and a full create/payment/print walkthrough on a disposable database.

## Latest source change (UI/UX pass, committed 2026-10-13)
- App-wide modernization: navbar 64px, `GlobalTooltip`, `WhatsAppDialog`, `.field-surface` for Input/Select/DatePicker, global checkbox style, calmer `Th`/`Td`, redesigned Barang/Stok/Laporan, sidebar collapsed-state fix, mobile notification bell via `useMediaQuery`, theme-aware 404.
- Gotchas: `Select` routes layout classes (`w-*`, `flex-*`, `shrink-*`, `col-*`, margins), including responsive variants such as `sm:w-*` since 2026-10-13, to its wrapper; `chrome-soft-panel` and `btn-liquid-*` are unlayered CSS and beat Tailwind utilities; never put `opacity` on `<td>`.
- Pending: Kasir/Non-Gudang regression check, Laporan Excel/PDF click test, Retur WhatsApp path.

## Latest source change (dashboard)
- `/` dashboard redesigned in a bento layout; charts split in `DashboardChartsWrapper` (`RevenueTrendChart`, `MarginPctChart`, `TopItemsChart`, `ProjectSalesChart`); new `bento-*` CSS. 30-day trend keys now use local dates. Admin Kasir layout still needs a browser check. Not committed yet.

## Latest source change
- Excel export headers now use semantic per-column-group colors via `HEADER_TONES` in `src/lib/export/excelStyles.ts`; header text must be written before `applyHeaderStyle`. Type-check and lint passed; a visual check in Excel is still pending.

## Pre-production audit evidence
- Canonical report: `docs/obsidian-vault/13-OPERATIONS/Pre-Production-Bug-Audit-and-Plan.md`.
- `npm audit --omit=dev`: 1 critical, 8 high, 3 moderate; `next@15.5.19` is a direct critical finding and the dry-run selected `15.5.27`.
- Prisma validation, type-check, ESLint, security 58/58, and production build with 22 routes passed.
- Production-like `next start` passed HTTP and browser smoke; unauthenticated APIs returned 401.
- Local database sweeps returned zero financial, payment, status, and stock violations.
- Production read-only smoke and security headers passed; CSP still permits `'unsafe-inline'` and `'unsafe-eval'`.
- No production mutation, source change, dependency update, schema change, or data cleanup occurred.

## Completed verification
- Prisma validation, type-check, ESLint, security 58/58, production build with 22 routes, and knowledge gates passed.
- Three-role authentication and the 50-route allow/deny matrix passed.
- Gudang, Kasir, Non-Gudang, shared UI, concurrency, final database invariants, and production read-only smoke are complete.
- `NG-00001` was repaired and its below-paid edit guard passed with exact validation text.
- Concurrent final-stock checkout produced one winner, no oversell, and one generic-error loser.
- Concurrent invoice payment persisted one payment only; no overpayment occurred.
- Final invariant queries returned zero violations and all counters matched persisted document numbers.
- Production read-only smoke passed at `https://gudangmki.com`.

## Cleanup state
- Port-3100 test server stopped.
- Disposable database `sistem_inventory_e2e_20261012` verified local, dropped, and confirmed absent.
- Normal development server restored on port 3000; login browser smoke passed.
- No production credentials were used and no production mutation occurred.

## Release blockers
- `PC00003`/`PC00004` receipt defects are fixed in source and verified locally with `PC00102` (split + tempo, PARTIAL 80k/75k) and `PC00103` (transfer, LUNAS).
- Remaining Phase 0 blockers: production `idempotency_keys` table before deploy, deployment env/cutover, backup/restore.
- Local QA transactions `PC00102`–`PC00104` were removed by the 2026-10-13 data clear.
- Do not push/deploy until the audit exit criteria pass.

## Do not lose
- Building in a git worktree with a `node_modules` junction: remove the junction with `cmd /c rmdir <junction>` BEFORE deleting the worktree. `git worktree remove --force` followed the junction on 2026-10-13 and deleted `node_modules/.bin`; it was restored with `npm rebuild --ignore-scripts`.
- Dev port is 3000 everywhere except user-owned `.env` drift (`NEXT_PUBLIC_APP_URL` still points to 3001).
- Local dev DB `sistem_inventory` was cleared on 2026-10-13 at the user's request (no backup): only the three role accounts (`kasir`, `gudang`, `nongudang`) remain; counters restart at 00001. Never clear again without approval.
- `CustomSelect` overlay uses a body portal and z-index 2147483005.
- Caveman is mandatory for chat until the user explicitly says `stop caveman` or `normal mode`.
- Context7 is mandatory for current external library/framework/API documentation.
- Never run `next build` while `next dev` or `next start` uses the same `.next` output.

## Evidence
- Final checkpoint: `docs/obsidian-vault/13-OPERATIONS/Comprehensive-Role-Verification-Checkpoint.md`
- Verification report: `docs/obsidian-vault/00-HOME/Verification-Report.md`
- Known bugs: `docs/obsidian-vault/11-ISSUES/Known-Bugs.md`
- Vault dashboard: `docs/obsidian-vault/00-HOME/Dashboard.md`
