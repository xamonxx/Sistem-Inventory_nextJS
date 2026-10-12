# Session — Dashboard Bento Redesign

**Date:** 2026-10-13
**Status:** completed (uncommitted)
**Source changes:** `src/app/(app)/page.tsx`, `src/components/DashboardCharts.tsx`, `src/components/DashboardChartsWrapper.tsx`, `src/app/globals.css`

## Goal
Make the Gudang/Kasir dashboard modern (bento style) without changing data, permissions, or filter behavior. Scope limited to the dashboard page.

## Changes
- Compact hero with mode badge, segmented mode toggle, and the existing date filter.
- Featured revenue KPI with a server-rendered SVG sparkline, day-over-day delta, and summary stats; compact tone-colored KPI cards, linked where useful.
- Trend chart beside a single-column alert center; horizontal top-items bars; margin % that skips zero-revenue days and shows an average line; project donut or compact empty state; activity feed with initials and Indonesian action labels.
- Charts split into four dynamically imported client components.
- New `bento-*` CSS classes; existing glass classes left untouched for Non-Gudang pages.
- 30-day trend keyed by local date (`localDateKey`) instead of UTC.

## Verification
- `npx tsc --noEmit` and ESLint on the touched files passed.
- Browser (Admin Gudang): 1440px light and dark, owner mode, 375px mobile; no horizontal overflow; no console errors; mode/filter/Reset links unchanged.
- Not done: Admin Kasir browser check.
