---
type: database-tables
status: verified
last_verified: 2026-10-12
source_files: [prisma/schema.prisma]
related: ["[[Non-Warehouse-Catalog]]", "[[Non-Warehouse-Orders-and-Invoices]]"]
tags: [database, tables, non-gudang]
---
# Non-Warehouse Tables

## `ng_produk`
Master produk per toko sumber: nama, kategori, satuan, harga beli/jual, aktif, timestamps.

## `ng_konsumen`
Master konsumen: grup, nama, alamat, workshop, createdAt.

## `ng_invoices`
Nomor, tanggal, status, satu toko sumber, jatuh tempo, relasi/snapshot konsumen, data bank, total modal/penjualan/profit, margin, markup, total dibayar, userId.

## `ng_invoice_items`
Opsional tertaut master produk; menyimpan seluruh snapshot harga/nama/toko, qty, subtotal modal/penjualan/profit. Cascade saat invoice dihapus.

## `ng_payments`
Invoice, tanggal, CASH/TRANSFER, jumlah, keterangan, userId, createdAt. Cascade saat invoice dihapus.

Tidak ada relasi dengan `Item`, `StockLedger`, `Transaction`, `Invoice`, atau `Payment` gudang.
