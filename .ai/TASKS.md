# Operational Tasks

## Pre-production release blockers
- [ ] Upgrade `next` from 15.5.19 to at least the patched 15.5.27 line; clear critical/high production advisories or record explicit risk acceptance.
- [ ] Decide whether `CREDIT` means paid financing or unpaid tempo before changing payment totals.
- [ ] Fix POS and invoice thermal receipt paid/remaining values across split, transfer, partial, LUNAS, reprint, image, and PDF paths.
- [ ] Make checkout/payment outcomes atomic and idempotent; prevent post-commit audit/token failures from returning mutation failure.
- [ ] Serialize Gudang invoice edit stock checks and Non-Gudang edit-vs-payment checks; add race regressions.
- [ ] Invalidate stock cache/tag after invoice edit/delete ledger mutations.
- [ ] Enforce inactive-item stock rules in direct Server Actions.
- [ ] Verify required Hostinger runtime env presence without exposing values; stage artifacts before restart.
- [ ] Complete an isolated backup/restore rehearsal and introduce versioned Prisma migrations.
- [ ] Convert logout to exact-origin POST, revoke sessions after password reset, and resolve public verification trust semantics.
- [ ] Pass authenticated release-artifact smoke for all three roles.
- [x] Produce the comprehensive pre-production audit and remediation plan.

## Non-Gudang UI follow-ups
- [ ] Click Unduh Excel / Cetak PDF on Non-Gudang Dashboard and Laporan once.
- [ ] Walk through create invoice → payment → print on a disposable database to confirm modals after the restyle.
- [ ] Optionally migrate Gudang Laporan local `Panel`/`StatCard` to `src/components/page`.

## UI/UX modernization follow-ups
- [ ] Check Kasir and Non-Gudang pages for regressions from shared changes (field surface, checkbox, tooltip, table primitives).
- [ ] Click Laporan "Unduh Excel" / "Unduh PDF A4" once and confirm output.
- [ ] Exercise the Retur WhatsApp dialog path (requires creating a return).

## Dashboard redesign
- [x] Bento redesign of `/` for Gudang/Kasir.
- [x] Verify the Admin Kasir layout (4 KPIs, no margin chart or activity feed) in the browser; KPI rows stacked at xl.

## Excel export styling
- [x] Semantic header colors for all Excel exports.
- [ ] Visual check of exported workbooks in Excel (Laporan, Invoice, Non-Gudang).

## Context7 integration
- [x] Inspect the official Context7 installer and client support.
- [x] Install project-scoped CLI + Skills mode.
- [x] Apply Context7 policy to universal, Codex, Claude, and Gemini instructions.
- [x] Validate live library resolution/docs retrieval and policy discovery.

## Caveman integration
- [x] Install `JuliusBrussee/caveman`.
- [x] Require Caveman in canonical and tool-specific Agent entrypoints.
- [x] Track installed skills and lockfile in the source baseline.
- [x] Validate installation and documentation.

## Current verification session
- [x] Create an isolated disposable database and deterministic fixtures for all three roles.
- [x] Pass Prisma, type, lint, security (58/58), production-build (22 routes), and knowledge gates.
- [x] Pass authentication plus the 50-route role matrix.
- [x] Complete Gudang verification.
- [x] Complete Kasir verification and record two receipt-payment release blockers.
- [x] Continue Non-Gudang verification from the saved `NG-00001` edit checkpoint.
- [x] Complete shared search/verification/theme/responsive/console/network checks.
- [x] Complete concurrency and final database invariant checks.
- [x] Complete production read-only smoke.
- [x] Clean only the disposable resources and restore the normal local development server.
- [ ] Fix or explicitly accept the two receipt defects before push/deploy.

## Repository backlog
- [x] Fix the POS checkout result type mismatch at `KasirClient.tsx:385`; type-check and lint pass.
- [x] Run POS checkout smoke on an isolated disposable DB; cash, credit, split, project, return, exchange, payment, edit, delete, hold/restore, barcode, print, and export paths exercised.
- [x] Align direct-page role guards with domain navigation/policy (retur, invoice, invoice/[id], stok/[id] guarded).
- [x] Align dev port to 3000 across package.json, README, launcher, smoke test (`.env` NEXT_PUBLIC_APP_URL still 3001, user-owned).
- [x] Mobile responsiveness round 1: dvh heights, POS dock safe-area, 40px password toggle, 11px min text on screen <=640px. Login verified at 375/768.
- [x] Mobile round 2 verification: kasir/gudang/nongudang pages at 375 (all), kasir at 768; zero horizontal page overflow.
- [x] Mobile round 3a: card layout <768px for non-gudang/barang and non-gudang/konsumen (empty state verified; cards with data not yet verified, DB empty); soft border on inactive sidebar items.
- [x] Mobile round 3b: card layout <768px for stok and log-aktivitas; 40px mobile tap targets for stok view toggle, laporan tabs, NotificationCenter actions. `next build` passes.
- [x] Redesign NotificationCenter: grouped sections, structured stock rows with progress, clear Buka/Tutup actions (verified dark desktop + light 375px).
- [x] Remove activity logs from notification polling (server no longer queries ActivityLog for /api/notifications).
- [x] Disable notification fetch/polling for ADMIN_KASIR and ADMIN_NONGUDANG (verified: 0 requests as kasir).
- [x] Audit & restyle all Excel exports (shared excelStyles: navy header, zebra, totals, print setup, local-time dates, unified file names; removed placeholder columns). Verified by generating sample workbooks and rendering via Excel.
- [x] Additive dummy data (`npm run db:seed:dummy`, 2026-10-12): 100 gudang items (8 empty, 12 low), 100 POS transactions (60 invoices: 25 LUNAS/20 PARTIAL/15 PENDING), 100 NG products, 100 NG consumers, 100 NG invoices. Integrity verified (no negative stock, totals/payments/status consistent, no duplicate document numbers). Cleanup: `npm run db:clear:dummy` (not run).
- [x] Excel Laporan: new "Stok Keluar" sheet (per-item recap + full outbound ledger history within active period; gudang-only server action at export time). Verified with real DB data (257 rows) rendered via Excel.
- [x] Excel Stok & Aset: global Stok Awal/Masuk/Keluar/Sisa columns (all-time ledger), reconciled 0 mismatch on 173 items.
- [x] Show overall margin % (UI card badge, Margin tab total row, PDF 2-decimal) and fix `laporanMargin` 500-row truncation via SQL aggregate (verified equal to manual sum).
- [~] Mobile round 4: NG Barang & Konsumen cards verified with real data at 375px; Stok and Log Aktivitas cards still to check with data. Laporan tables (~700px) scroll horizontally by design.
- [ ] Establish tested MySQL backup/restore and Prisma migration history.
- [ ] Add database-backed integration tests for checkout, return/exchange, payments, invoice edit/delete.
- [ ] Audit apparently unused dependencies and `laporanOmset` before removal.
- [ ] Review logout origin policy and production CSP.

These are identified tasks, not approved product scope. Follow [`protocols/startup.md`](protocols/startup.md) before selecting work.
