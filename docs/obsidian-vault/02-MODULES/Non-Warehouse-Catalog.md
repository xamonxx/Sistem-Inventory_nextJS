---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/app/(app)/non-gudang/barang/actions.ts, src/app/(app)/non-gudang/buat-invoice/actions.ts, src/app/(app)/non-gudang/barang/NgBarangClient.tsx, src/app/(app)/non-gudang/buat-invoice/NgBuatInvoiceClient.tsx]
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

## Tampilan (2026-10-13)
- Master Barang: `PageHeader` (+ Tambah Barang), 4 `StatCard`, filter (cari, status, toko), tabel mulai `xl` (nama + kategori, harga jual menonjol, margin `TonePill`, status `StatusDot` yang bisa diklik untuk aktif/nonaktif, edit `IconAction`), daftar ringkas di bawah `xl`; checkbox header indeterminate dan baris terpilih `rose-500/7%`.
- Buat Invoice: `PageHeader`, stepper ringkas `StepPill` (Toko · Barang · Invoice) + strip `SlimMetric` (toko, item, keuntungan); kartu memakai `.bento-card !overflow-visible` agar dropdown saran tidak terpotong; saran katalog berupa daftar ringkas yang di-scroll (maks 360px).
- Semua halaman Non-Gudang memakai primitif `src/components/page` (lihat [[Core-UI-Components]]).
