# Session — Non-Gudang UI/UX Overhaul

**Date:** 2026-10-13
**Status:** completed and committed
**Source changes:** `src/components/page/index.tsx` (new) and the seven Non-Gudang client components.

## Goal
Redesign every Non-Gudang page to match the modernized Gudang UI without changing data, actions, exports, or print output.

## Changes
- Shared primitives: `PageHeader`, `StatCard`, `StatGrid`, `Panel`, `IconChip`, `StatusDot`, `TonePill`, `IconAction`, `FilterBar`.
- Dashboard: compact header with period + export, 4 primary KPIs + secondary strip, area trend chart, single-gradient rank bars, calm tables.
- Master Barang / Master Konsumen: compact header with add action, stat cards, filter bar, calm tables with status dots and ghost edit actions, compact lists on smaller screens, indeterminate select-all.
- Buat Invoice: compact step pills + summary strip, bento cards that keep dropdowns visible, scrollable catalog list.
- Riwayat Invoice: stat cards, filter bar, status dots, four borderless icon actions, compact list below `xl`.
- Riwayat Pembelian: duplicate hero stats removed, single-color contribution bars, compact invoice rows.
- Laporan & Unduhan: header actions (period, Cetak PDF, Unduh Excel), five stat cards, calm per-konsumen table with totals.

## Verification
- Type-check and ESLint passed.
- Browser (Admin Non-Gudang) at 1440/1100/768/375px: no page overflow; KPI values identical to pre-change screenshots; drawer, add form, and Buat Invoice step 2 exercised without saving data; console clean.
- Not done: Excel/PDF/print clicks; full create/payment flow.
