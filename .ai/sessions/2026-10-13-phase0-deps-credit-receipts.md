# Session — 2026-10-13 — Phase 0: dependencies and CREDIT receipts

## Scope
Execute Phase 0 steps 1–3 of the pre-production audit: patch Next.js, decide CREDIT semantics, fix receipt totals.

## Decisions
- Owner decision in chat: CREDIT means an unpaid tempo receivable. Recorded as ADR-004.

## Changes
- `0dfdd83` — pin `next`/`eslint-config-next` 15.5.27, override `postcss` and `deepmerge-ts`, record audit documentation.
- `249c400` — CREDIT excluded from paid totals and Payment rows; persisted paid/remaining values on every `Nota` entry point; `bayarInvoice` restricted to CASH/TRANSFER; 10 regression cases.

## Verification observed
- Prisma validate, type-check, ESLint, security 68/68, production build (22 routes, Next.js 15.5.27).
- Production-like `next start`: `/` 307, `/login` 200, APIs 401, `/logout` 303; `webapp-smoke-test.py --no-server` passed.
- Local browser checkouts `PC00102` and `PC00103` matched the database on receipt, `/invoice/[id]`, and invoice thermal preview.
- Local database had 0 historical CREDIT Payment rows (read-only query).

## Notes
- A separate Codex session worked in parallel (role user guides) and owned the port-3000 dev server; shared status files were edited with targeted changes only.
- The dev server rendered the A4 signature from `file:///C:/Program Files/Git/ttd/disetujui.png`, which suggests MSYS path conversion of `NEXT_PUBLIC_SIGNATURE_DISETUJUI` in the shell that launched it. This is not caused by this change.

## Next
- Read-only production check for historical CREDIT Payment rows.
- Phase 0 step 4: atomic/idempotent checkout and payment outcomes.

## Continuation — AUD-003 (Phase 0 step 4)
- Part A (`2cb5d66`): audit rows commit inside the domain transaction; `invalidateAfterCommit`/`afterCommit` make post-commit work best-effort; outer `try` wraps only the transaction.
- Part B: owner approved an additive `idempotency_keys` table. Local database updated with `prisma db push` after confirming the target was the local `sistem_inventory` database. Production is untouched; the rollout order is in `docs/obsidian-vault/13-OPERATIONS/Idempotency-Schema-Rollout.md`.
- Verification observed: type-check, ESLint, security 68/68, `npm run test:idempotency` 6/6, browser checkout with the first response dropped after commit then retried (`PC00104`: one transaction, one payment, one audit row, one key; receipt replayed).
- Not run: `next build`, because another session restarted `next dev` on port 3000 (Git Bash, PID 11776) using the shared `.next` directory. The port-3000 dev server had been stopped once in this session to regenerate the Prisma client.
