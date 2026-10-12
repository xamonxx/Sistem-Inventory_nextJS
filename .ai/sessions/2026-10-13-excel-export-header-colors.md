# Session — Excel Export Header Colors

**Date:** 2026-10-13
**Status:** completed
**Source changes:** `src/lib/export/excelStyles.ts`

## Goal
Make Excel export table headers modern and color-coded instead of one flat navy color.

## Changes
- `HEADER_TONES` / `headerToneFor` map header text to a color group: status slate, percent violet, receivable/risk rose, date cyan, identity navy, quantity teal, money emerald, default indigo.
- `applyHeaderStyle` applies the group fill, white column separators, and a lighter accent bottom border.
- Header rows are tracked per sheet so `applyBorder` and `autoFitColumns` no longer rely on the header fill color.
- The company line under each sheet title has a sky accent border.

## Verification
- `npx tsc --noEmit` and `npx eslint src/lib/export` passed.
- Header-to-color mapping checked for Invoice and item-detail headers.
- Not done: opening a generated workbook in Excel.
