---
type: operations-checkpoint
status: completed
last_verified: 2026-10-13
source_files: [package.json, prisma/schema.prisma, src/app]
related: ["[[Build-and-Test]]", "[[Verification-Report]]", "[[Known-Bugs]]", "[[Current-State]]"]
tags: [operations, testing, roles, checkpoint]
---
# Comprehensive Role Verification Checkpoint

## Status
Verification resumed and completed on 2026-10-13. No application source changed during this verification pass.

The original captured browser set remains 55 cases: 52 passed, two confirmed cashier receipt defects, and one interrupted Non-Gudang edit case. The interrupted case was repaired and passed during continuation. Additional resumed scenarios covered the remaining Non-Gudang, shared UI, concurrency, invariant, production read-only, and cleanup checks.

## Completed scope
- Isolated disposable MySQL database and deterministic fixtures for `ADMIN_GUDANG`, `ADMIN_KASIR`, `ADMIN_NONGUDANG`, and an inactive user.
- Prisma validation, type-check, ESLint, security suite (58/58), production build (22 routes), and knowledge checks passed.
- Authentication: invalid and inactive login rejection, unauthenticated redirect, login/logout, invalid session, all three roles, and a 50-route allow/deny matrix passed.
- A replayed protected Server Action under the cashier role did not mutate the item. The response was HTTP 500 instead of a controlled authorization response.
- Gudang: item lifecycle, duplicate-code validation, stock receipt/correction/batch, stock invariant, report tabs, user lifecycle, notification, activity log, Excel workbook structure, and PDF print path passed.
- Kasir: cash/credit/split/project checkout persistence, insufficient-stock rejection, partial/full invoice payment, overpayment clamp, invoice edit/delete graph, return, exchange, cumulative-return limit, hold/restore, exact barcode entry, invoice Excel, receipt image, and print paths were exercised.
- Non-Gudang: product margin validation, product creation, consumer creation, TEMPO invoice `NG-00001`, partial payment, overpayment guard, and full payment passed before the interrupted edit scenario.
- The interrupted `NG-00001` state was restored to Alpha quantity 2, Beta quantity 1, total Rp220.000, paid Rp220.000, and LUNAS.
- The below-paid edit guard passed with exact validation: `Total penjualan (Rp 140.000) lebih kecil dari yang sudah dibayar (Rp 220.000).`
- Remaining Non-Gudang checks passed: one-store cart reset confirmation, referenced product/consumer deletion guards, purchase search/detail, report totals, PDF print invocation, five-sheet Excel export, and warehouse-stock isolation.
- Shared checks passed: global search and result navigation, public one-time invoice verification, light/dark theme, portaled select, mobile detail dialog, 375px no-page-overflow, and browser console/network review.
- Stock concurrency preserved inventory: one of two simultaneous final-unit checkouts succeeded and one failed; effective stock stopped at zero.
- Payment concurrency preserved the invoice invariant: one of two simultaneous full payments persisted; payment count remained one and paid total equaled invoice total.
- Final database sweep found zero violations across stock, transaction totals, invoice/payment totals and statuses, Non-Gudang totals/status/store isolation, cumulative returns, duplicate document numbers, and counter alignment.
- Production read-only smoke passed at `https://gudangmki.com`: root redirected to `/login`, login returned HTTP 200, security headers were present, and desktop/mobile surfaces rendered without page overflow.

## Confirmed defects
1. Split-payment receipt for `PC00003` persists `CASH 30,000 + TRANSFER 50,000 + CREDIT 20,000` and a LUNAS invoice, but the receipt displays only `Pembayaran Masuk Rp30.000` and `Sisa Tagihan Rp70.000`.
2. Transfer-only project receipt for `PC00004` persists `TRANSFER 100,000` and a LUNAS invoice, but the receipt displays `Sisa Tagihan Rp100.000`.

Both defects indicate that receipt paid/remaining values are derived from cash tendered instead of total persisted payments. See [[Known-Bugs]].
3. Concurrent checkout safety is correct, but the losing request displays `Terjadi kesalahan internal saat memproses checkout.` instead of a stock-specific conflict message.

## Secondary observations
- Non-Gudang access to `/kasir` is correctly blocked, but the denial message says the user is logged in as `Admin Gudang`.
- Unauthorized Server Action replay was blocked without a database mutation, but surfaced as HTTP 500.
- Credentials are intentionally absent from this note. Recreate or retrieve disposable credentials from the active local test harness only; never copy them into documentation.

## Final cleanup state
- The production-mode test server on port 3100 was stopped.
- Disposable database `sistem_inventory_e2e_20261012` was confirmed on local MySQL port 3306, dropped, and verified absent.
- Normal Turbopack development server was restored on port 3000.
- A direct browser smoke of `http://127.0.0.1:3000/login` passed after restoration.
- No production credentials were used and no production mutation was performed.

## Final evidence
1. `NG-00001` persisted as LUNAS with total and payments both Rp220.000.
2. Below-paid edits disable save and show the exact paid-total validation.
3. Non-Gudang invoice creation retained one source store and preserved `Item`/`StockLedger` counts and quantity totals.
4. The Non-Gudang Excel workbook contained `Ringkasan`, `Pembelian per Toko`, `Top Produk`, `Tren Bulanan`, and `Per Konsumen`.
5. Public invoice verification recorded the first read and showed the one-time state on reload.
6. Two-tab stock and payment races produced no oversell or overpayment.
7. All final invariant queries returned zero violations; all four counters matched the highest persisted document number.
8. Production and restored local development login surfaces passed read-only browser smoke.

## Safety
Do not push or deploy until the two receipt defects are fixed or explicitly accepted as release blockers. The concurrency error-message defect is not an integrity failure but remains open.

