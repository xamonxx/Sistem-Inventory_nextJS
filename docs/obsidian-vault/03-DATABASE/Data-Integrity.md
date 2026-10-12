---
type: database
status: verified
last_verified: 2026-10-12
source_files: [prisma/schema.prisma, src/lib/inventoryRules.ts, src/lib/counters.ts]
related: ["[[Database-Overview]]", "[[Stock-Ledger]]", "[[Technical-Debt]]"]
tags: [database, integrity]
---
# Data Integrity

## DB-enforced
- Primary key auto-increment pada model bisnis, string ID pada `Counter`.
- Unique: username, kode item, nomor transaksi, nomor return, nomor invoice gudang/non-gudang.
- Foreign key relasi Prisma.
- Cascade delete: `TransactionItem` dari Transaction; `ReturnItem` dari Return; `NgInvoiceItem` dan `NgPayment` dari NgInvoice.
- Decimal precision: uang umumnya `(15,2)`; persentase non-gudang `(6,2)`.

## Application-enforced
- Role guard dan validasi Zod sebelum write.
- Stok cukup, item aktif, item checkout unik.
- Return terikat transaksi asli dan cumulative qty tidak berlebih.
- Total invoice baru tidak boleh di bawah payment terdata.
- Harga jual non-gudang tidak boleh di bawah harga beli.
- Nomor dokumen melalui atomic `Counter.upsert` dalam transaksi.

## Referential cleanup manual
Penghapusan invoice gudang secara eksplisit menghapus ledger, return, payment, invoice terkait, dan transaction karena tidak semua relasi cascade. Perubahan pada alur delete wajib dites sebagai satu unit domain.

## Keterbatasan
`refType`/`refId` di `StockLedger` adalah polymorphic reference berbasis string/int tanpa foreign key. `NgInvoice.userId` dan `NgPayment.userId` juga tidak memiliki FK Prisma.
