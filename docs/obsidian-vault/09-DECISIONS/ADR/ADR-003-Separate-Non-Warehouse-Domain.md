---
type: adr
status: accepted-reconstructed
last_verified: 2026-10-12
source_files: [prisma/schema.prisma, src/app/(app)/non-gudang]
related: ["[[Non-Warehouse-Orders-and-Invoices]]", "[[System-Architecture]]"]
tags: [adr, non-gudang]
---
# ADR-003: Separate Non-Warehouse Domain

## Context
Perdagangan non-gudang mencatat pembelian/jual produk luar tanpa mengelola `Item` atau `StockLedger` gudang.

## Decision
Gunakan model `NgProduk`, `NgKonsumen`, `NgInvoice`, `NgInvoiceItem`, dan `NgPayment` serta namespace route `/non-gudang`. Invoice menyimpan snapshot biaya, jual, profit, margin, markup, konsumen, dan toko.

## Consequences
- Transaksi non-gudang tidak memutasi stok gudang.
- Reporting dan receivable lifecycle terpisah.
- Satu invoice hanya boleh memuat satu toko.
- Ada duplikasi konsep invoice/payment yang disengaja demi batas domain; perubahan shared UI tidak boleh menyamakan aturan bisnis tanpa verifikasi.

## Evidence
`prisma/schema.prisma` dan action files di `src/app/(app)/non-gudang`.
