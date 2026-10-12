---
type: database-tables
status: verified
last_verified: 2026-10-12
source_files: [prisma/schema.prisma]
related: ["[[POS-Transactions]]", "[[Returns-and-Exchanges]]", "[[Warehouse-Invoices-and-Receivables]]"]
tags: [database, tables, gudang]
---
# Warehouse Transaction Tables

## `transactions` / `transaction_items`
Header menyimpan nomor, tanggal, tipe retail/project, relasi master, snapshot customer/bank, total, dan user. Detail menyimpan item, nama/harga jual/harga beli snapshot, qty, subtotal.

## `stock_ledger`
Item, tanggal, `LedgerType`, signed qty, keterangan, polymorphic reference, user. Sumber mutasi stok setelah `stokAwal`.

## `returns` / `return_items`
Return wajib ke transaction. Header menyimpan RETUR/TUKAR dan selisih. Detail tertaut ke transaction item asli, item retur, dan opsional item pengganti beserta snapshot/qty/subtotal.

## `invoices` / `payments`
Invoice dapat tertaut ke client, project, transaction, atau return; menyimpan total dan total dibayar. Payment dapat tertaut ke transaction dan/atau invoice dan mendukung CASH/TRANSFER/CREDIT.

## Enum
`TransactionType`, `LedgerType`, `ReturnType`, `InvoiceStatus`, `PaymentType`.
