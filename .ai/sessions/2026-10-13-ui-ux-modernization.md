# Session — UI/UX Modernization Pass

**Date:** 2026-10-13
**Status:** completed and committed
**Source changes:** shared UI primitives, shell (Sidebar/TopNav/layout), Dashboard, Barang, Stok, Laporan, Invoice/Retur WhatsApp flow, 404.

## Goal
Modernize and align the Gudang/Kasir UI with the bento dashboard style, reduce visual noise in dark mode, and fix layout issues on tablet and laptop widths.

## Changes
- WhatsApp number dialog (`WhatsAppDialog`) replacing `window.prompt`.
- Desktop navbar 64px; notification bell added to the mobile/tablet header with a single mounted instance (`useMediaQuery`).
- Calmer tables (`Th`/`Td`), modern global checkboxes, dark-mode selection state, no `opacity` on table cells.
- `GlobalTooltip` for `data-tooltip` and `title`; shared `.app-tooltip` style; theme-aware 404 page.
- Barang breakpoints (cards below `xl`, Stok Awal column at `2xl`), sidebar collapsed-state leak fixed, soft border on inactive nav items.
- Stok redesign (header actions, type chips with counts, compact filters, paginated date-grouped timeline).
- `.field-surface` shared by Input, Select, DatePicker; `Select` search split bug fixed.
- Laporan refresh (bento stat cards and panels, segmented tabs, theme text tokens).

## Verification
- Type-check and ESLint passed for every touched file.
- Browser checks (Gudang role) at 375/768/1024/1100/1280/1440/1920px on the touched pages: no page overflow, measured control/field consistency, tab/filter behavior, tooltip placement, 404 in light and dark.
- Not done: Kasir/Non-Gudang browser pass, Laporan export button clicks, Retur WhatsApp path.
