---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/kasir/page.tsx, src/app/(app)/kasir/KasirClient.tsx, src/app/(app)/kasir/actions.ts, src/lib/kasirStore.ts]
related: ["[[POS-Checkout-Flow]]", "[[Stock-Ledger]]", "[[Warehouse-Invoices-and-Receivables]]"]
tags: [module, pos]
---
# POS Transactions

## Fungsi
Keranjang retail/project, metadata client/workshop/project, pembayaran cash/transfer/credit atau split, transaksi penjualan, pengurangan stok, dan invoice opsional.

## Hak akses
Page dan `createTransaction` membatasi ke `ADMIN_KASIR`.

## Write set
Dalam transaksi Serializable: lookup/create `Client`, `Workshop`, `ProjectGroup`, `Project`; create `Transaction`; snapshot `TransactionItem`; create ledger `KELUAR`; create `Payment`; opsional create `Invoice`; increment `Counter`.

## Validasi
- Item harus ada dan stok mencukupi.
- Item duplikat ditolak.
- Total payment tidak boleh melebihi grand total.
- Cash/transfer tanpa invoice harus lunas.
- Credit memicu invoice.

Client state dikelola `useKasirStore`; perhitungan tampilan keranjang memakai `computeCart`.
