# Latest Handoff

**Updated:** 2026-10-13
**State:** comprehensive three-role verification completed; application source was not changed.

## Startup
1. Read `.ai/STATUS.md`, `.ai/CONTEXT.md`, `.ai/AGENTS.md`, `.ai/TASKS.md`, this handoff, and `docs/obsidian-vault/13-OPERATIONS/Comprehensive-Role-Verification-Checkpoint.md`.
2. Run `git status --short` and `node scripts/knowledge-sync.mjs check`.
3. Preserve existing user changes and do not expose credentials.

## Required next task
Fix and retest the two receipt-payment defects before push/deploy:
1. Split payment must derive paid and remaining values from all persisted payment methods, not cash tendered only.
2. Transfer-only LUNAS receipt must show the persisted transfer as paid and zero remaining.

After those fixes, improve the losing concurrent checkout response so it reports a stock conflict instead of `Terjadi kesalahan internal saat memproses checkout.`

## Latest source change (Non-Gudang overhaul, committed 2026-10-13)
- All seven Non-Gudang pages rebuilt on `src/components/page` primitives (`PageHeader`, `StatCard`/`StatGrid`, `Panel`, `StatusDot`, `TonePill`, `IconAction`, `FilterBar`). Logic, actions, exports, and print untouched.
- Gotcha: unlayered global `h1`/`h2`/`h3` rules in `globals.css` override Tailwind text sizes; use `!text-*` on headings inside components.
- Pending: Non-Gudang Excel/PDF click test and a full create/payment/print walkthrough on a disposable database.

## Latest source change (UI/UX pass, committed 2026-10-13)
- App-wide modernization: navbar 64px, `GlobalTooltip`, `WhatsAppDialog`, `.field-surface` for Input/Select/DatePicker, global checkbox style, calmer `Th`/`Td`, redesigned Barang/Stok/Laporan, sidebar collapsed-state fix, mobile notification bell via `useMediaQuery`, theme-aware 404.
- Gotchas: `Select` forwards only un-prefixed `col-*`/`w-*` classes to its wrapper; `chrome-soft-panel` and `btn-liquid-*` are unlayered CSS and beat Tailwind utilities; never put `opacity` on `<td>`.
- Pending: Kasir/Non-Gudang regression check, Laporan Excel/PDF click test, Retur WhatsApp path.

## Latest source change (dashboard)
- `/` dashboard redesigned in a bento layout; charts split in `DashboardChartsWrapper` (`RevenueTrendChart`, `MarginPctChart`, `TopItemsChart`, `ProjectSalesChart`); new `bento-*` CSS. 30-day trend keys now use local dates. Admin Kasir layout still needs a browser check. Not committed yet.

## Latest source change
- Excel export headers now use semantic per-column-group colors via `HEADER_TONES` in `src/lib/export/excelStyles.ts`; header text must be written before `applyHeaderStyle`. Type-check and lint passed; a visual check in Excel is still pending.

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
- `PC00003`: database has cash 30k + transfer 50k + credit 20k and LUNAS, but receipt says paid 30k / remaining 70k.
- `PC00004`: database has transfer 100k and LUNAS, but receipt says remaining 100k.
- Do not push/deploy until both are fixed or explicitly accepted.

## Do not lose
- Dev port is 3000 everywhere except user-owned `.env` drift (`NEXT_PUBLIC_APP_URL` still points to 3001).
- Dev DB contains pre-existing additive `DMY-`/`DMY ` dummy data; never clear it without approval.
- `CustomSelect` overlay uses a body portal and z-index 2147483005.
- Caveman is mandatory for chat until the user explicitly says `stop caveman` or `normal mode`.
- Context7 is mandatory for current external library/framework/API documentation.
- Never run `next build` while `next dev` or `next start` uses the same `.next` output.

## Evidence
- Final checkpoint: `docs/obsidian-vault/13-OPERATIONS/Comprehensive-Role-Verification-Checkpoint.md`
- Verification report: `docs/obsidian-vault/00-HOME/Verification-Report.md`
- Known bugs: `docs/obsidian-vault/11-ISSUES/Known-Bugs.md`
- Vault dashboard: `docs/obsidian-vault/00-HOME/Dashboard.md`
