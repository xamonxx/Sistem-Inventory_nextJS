# Progress

## 2026-10-13 — Pre-production Phase 0 (dependencies and receipts)
- [x] Pin `next`/`eslint-config-next` to 15.5.27; override `postcss` ^8.5.30 and `deepmerge-ts` ^8.0.2; production audit has no critical/high.
- [x] Record ADR-004: CREDIT is an unpaid receivable; checkout and invoice settlement write CASH/TRANSFER payments only.
- [x] Print persisted paid/remaining values on Kasir receipt, invoice thermal preview, and `/invoice/[id]`; derive `Nota` status from amounts.
- [x] Add 10 checkout-rule regressions (security suite 68/68) and browser-verify split/tempo and transfer-only checkouts locally.
- [ ] Read-only production check for historical CREDIT Payment rows.

## 2026-10-13 — User guides by role
- [x] Create separate `.docx` guides for `ADMIN_GUDANG`, `ADMIN_KASIR`, and `ADMIN_NONGUDANG`.
- [x] Cover authorized menus, step-by-step workflows, control checks, troubleshooting, and escalation boundaries.
- [x] Add Markdown and Vault indexes without embedding credentials or customer data.

## 2026-10-13 — Non-Gudang UI/UX overhaul
- [x] Shared page primitives in `src/components/page/index.tsx`.
- [x] Dashboard + charts, Master Barang, Buat Invoice, Riwayat Invoice, Riwayat Pembelian, Master Konsumen, Laporan.
- [x] Browser verification as Admin Non-Gudang at 1440/1100/768/375px; KPI values unchanged.
- [ ] Manual click test of Non-Gudang Excel/PDF/print and a full invoice create/payment flow on a disposable database.

## 2026-10-13 — UI/UX modernization pass
- [x] WhatsApp number dialog replaces `window.prompt` (Invoice list/detail, Retur).
- [x] Desktop navbar 76px → 64px; mobile notification bell (single polling instance).
- [x] Calmer tables, modern checkboxes, selection state fixes.
- [x] Global tooltip engine (`GlobalTooltip`), theme-aware 404.
- [x] Barang tablet/desktop breakpoints; sidebar drawer collapsed-state leak fixed; soft border on inactive nav items.
- [x] Stok redesign (chips, compact filters, paginated grouped timeline) and unified form fields (`.field-surface`); `Select` search split bug fixed.
- [x] Laporan refresh (bento cards, segmented tabs, theme tokens).
- [x] Browser checks at 375/768/1024/1100/1280/1440/1920px for touched pages (Gudang role).
- [ ] Browser check as Admin Kasir and Non-Gudang for the shared component changes.
- [ ] Manual check of Laporan Excel/PDF buttons and Retur WhatsApp path.

## 2026-10-13 — Dashboard bento redesign
- [x] Rebuild `/` layout: hero, featured KPI + sparkline, compact KPIs, trend + alert center, top items, margin %, projects, activity.
- [x] Split charts into four dynamic components; add `bento-*` CSS without touching Non-Gudang classes.
- [x] Fix 30-day trend date keys to local dates.
- [x] Type-check, ESLint, browser check (Gudang, 1440 light/dark, 375 mobile).
- [ ] Browser check as Admin Kasir.

## 2026-10-13 — Excel export header colors
- [x] Replace flat navy headers with semantic per-column-group colors in `excelStyles.ts`.
- [x] Track header rows per sheet instead of detecting them by fill color.
- [x] Pass type-check and ESLint on `src/lib/export`; verify header-to-color mapping.
- [ ] Open a generated workbook in Excel for a visual check.

## 2026-10-12 — Context7 Agent skill
- [x] Verify official installer and choose project-scoped CLI + Skills mode.
- [x] Run `npx ctx7 setup --cli --project -y`.
- [x] Install `find-docs` for universal Agents and Claude Code plus generated Context7 rules.
- [x] Require Context7 for current external technology documentation across canonical, Codex, Claude, and Gemini policies.
- [x] Resolve `/vercel/next.js` and fetch Route Handler documentation through the live CLI.
- [x] Pass 7/7 Context7 policy assertions.

## 2026-10-12 — Caveman Agent policy
- [x] Run `npx skills add JuliusBrussee/caveman`.
- [x] Install 22 upstream project skills and write `skills-lock.json`.
- [x] Make `.agents/skills/caveman/SKILL.md` mandatory across Codex, Claude, Gemini, and canonical policy.
- [x] Add skill directories and lockfile to source-drift tracking.
- [x] Validate skill discovery, knowledge links, and 226-file source baseline.
- [x] Pass 6/6 policy assertions across the skill, lockfile, and Agent entrypoints.

## 2026-10-12 — Living knowledge system
- [x] Inventory framework, routes, server actions, roles, database models, dependencies, deployment, tests.
- [x] Reconstruct verified gudang and non-gudang business flows.
- [x] Create Obsidian taxonomy, module notes, database/API/frontend notes, graphs, ADRs, operations, issues, roadmap, templates.
- [x] Create AI memory structure and cross-agent policy.
- [x] Install source-drift baseline and validator.
- [x] Validate links, Mermaid fences, source references, and handoff context.
- [x] Record measured final report.

## Source behavior changes in this documentation phase
None intended. Existing UI overlay and port changes were observed and documented, not reimplemented here.

## Final evidence
- Knowledge validation: 85 Vault notes, 24 operational notes, 328 wikilinks, 32 relative links, 21 diagrams, 176 source refs, 0 errors.
- Source snapshot: 229 files; includes Caveman, Context7 skills/rules, root entrypoints, and operational memory.
- Clean handoff simulation: 8/8 Level-1 assertions passed.
- Lint: passed. Security tests: 58/58 passed. Type-check: failed at `KasirClient.tsx:385`.

## Evidence location
- Session: [`sessions/2026-10-12-project-knowledge-system.md`](sessions/2026-10-12-project-knowledge-system.md)
- Daily changelog: [`2026-10-12`](../docs/obsidian-vault/10-CHANGELOG/Daily/2026-10-12.md)

## 2026-10-13 — Comprehensive role verification
- [x] Create an isolated local database and deterministic fixtures for all three roles.
- [x] Pass Prisma, type, lint, security 58/58, production-build 22-route, and knowledge gates.
- [x] Pass authentication and the 50-route role matrix.
- [x] Complete Gudang and Kasir scenarios; record two receipt-payment release blockers.
- [x] Restore `NG-00001` and complete Non-Gudang edit, one-store, delete-guard, report, export, and isolation checks.
- [x] Complete shared search, public verification, theme, dialog/select, responsive, console, and network checks.
- [x] Prove concurrent stock/payment integrity and pass the final database invariant/counter sweep.
- [x] Pass production read-only smoke at `https://gudangmki.com`.
- [x] Stop port 3100, drop only the verified disposable database, restore port-3000 development server, and smoke the login page.
- [ ] Fix or explicitly accept the two receipt-payment defects before push/deploy.
