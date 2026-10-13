---
type: adr
status: accepted
last_verified: 2026-10-13
source_files: [src/lib/checkoutRules.ts, src/app/(app)/kasir/actions.ts, src/app/(app)/invoice/actions.ts, src/components/Nota.tsx]
related: ["[[Pre-Production-Bug-Audit-and-Plan]]", "[[Known-Bugs]]", "[[Warehouse-Transaction-Tables]]", "[[Decision-Log]]"]
tags: [adr, payment, invoice, kasir]
---
# ADR-004: CREDIT Is an Unpaid Receivable

## Status
Accepted on 2026-10-13 by the product owner: "CREDIT = piutang tempo belum dibayar".

## Context
The Kasir UI labels `CREDIT` as `Kredit / Piutang (Tempo)`, but checkout counted CREDIT amounts in `totalPaid`, persisted them as `Payment` rows, and could mark an invoice `LUNAS` (audit finding AUD-016). Receipts also derived the remaining balance from cash only (AUD-002, `PC00003`/`PC00004`).

## Decision
`CREDIT` is an unpaid trade receivable, not money received.

- `Invoice.totalDibayar` and `Payment` rows contain only money actually received: `CASH` and `TRANSFER`.
- A CREDIT portion is not persisted as a `Payment`; it is the invoice remaining balance `total - totalDibayar`.
- Invoice status derives from received money only: `LUNAS` when paid ≥ total, `PARTIAL` when paid > 0, otherwise `PENDING`.
- A checkout containing CREDIT always creates an invoice. Received money plus CREDIT must not exceed the transaction total.
- Invoice settlement (`bayarInvoice`) accepts `CASH` or `TRANSFER` only.
- Receipts print the persisted `totalDibayar` and remaining balance on every `Nota` entry point.

## Alternatives
- **CREDIT as paid financing (third-party credit/card):** rejected by the owner; it would keep receivables invisible.
- **Persist CREDIT as a zero-effect `Payment` marker:** rejected; it breaks the invariant that `SUM(payments) = totalDibayar` and invites double counting in reports.

## Consequences
- The `PaymentType.CREDIT` enum value remains for backward compatibility; new code does not write it.
- Historical rows written before this change may contain `CREDIT` payments counted in `totalDibayar`. They must be reviewed read-only and corrected only with explicit approval and a verified backup.
- Receivable dashboards and invoice lists already compute `total - totalDibayar`, so tempo sales now appear as outstanding receivables.

## Rollout and verification
- Regression: `npm run test:security` includes CREDIT split, transfer-only, credit-only, overpayment, and cash-short cases.
- Browser checkout on the local database: split cash 30.000 + transfer 50.000 + tempo 75.000 persisted two payments, `PARTIAL`, paid 80.000; receipt, `/invoice/[id]`, and invoice thermal preview show paid 80.000 / remaining 75.000. Transfer-only persisted `LUNAS` and printed no remaining balance.
- Rollback: revert the commit; no schema change is involved.

## Related notes
[[Pre-Production-Bug-Audit-and-Plan]], [[Known-Bugs]], [[Warehouse-Transaction-Tables]], [[Decision-Log]].
