---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/non-gudang/barang/actions.ts, src/app/(app)/non-gudang/buat-invoice/actions.ts]
related: ["[[Non-Warehouse-Order-Flow]]", "[[Non-Warehouse-Tables]]", "[[Non-Warehouse-Orders-and-Invoices]]"]
tags: [module, non-gudang]
---
# Non-Warehouse Catalog

## Fungsi
Master `NgProduk` menyimpan nama barang, toko sumber, kategori, satuan, harga beli/jual, dan status aktif. Harga jual tidak boleh di bawah harga beli.

## Hak akses
Semua mutasi memerlukan `ADMIN_NONGUDANG`.

## Integritas histori
Produk yang pernah dipakai `NgInvoiceItem` tidak dapat dihapus permanen. Invoice menyimpan snapshot nama, toko, harga beli, dan harga jual sehingga histori tidak bergantung pada harga master saat ini.

## Cart resolution
`resolveNgProductForCart` mencari produk aktif per toko/nama, lalu dapat update atau create produk sebelum dimasukkan ke cart. Alur ini tetap memvalidasi margin non-negatif.
