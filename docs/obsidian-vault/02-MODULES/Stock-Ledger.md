---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/lib/stock.ts, src/app/(app)/stok/actions.ts, src/app/(app)/stok/masuk/actions.ts, src/app/(app)/stok/page.tsx, src/app/(app)/stok/StokClient.tsx, src/app/(app)/stok/StokForm.tsx]
related: ["[[Stock-Mutation-Flow]]", "[[Item-Master]]", "[[Warehouse-Transaction-Tables]]"]
tags: [module, inventory, stock]
---
# Stock Ledger

## Tampilan kartu stok `/stok` (2026-10-13)
- Header: judul + tombol Barang Masuk / Koreksi Stok (modal di `StokForm`).
- Filter jenis berupa chip dengan jumlah per jenis (`rowsBeforeTipe` → `countsByTipe` → `processedRows`); filter barang, rentang tanggal, cari, dan Reset dalam satu kartu.
- Tabel (mulai `xl`) dan garis waktu memakai paginasi yang sama (10/halaman); garis waktu dikelompokkan per tanggal dengan jumlah dan net per hari. Di bawah `xl` tampil daftar ringkas.
- Saldo berjalan hanya ditampilkan bila satu barang dipilih; perhitungannya tidak berubah (urut kronologis dari `itemStokAwal`).
- Data server tetap dibatasi 300 mutasi terbaru bila tidak memfilter barang.

## Invariant
Stok efektif = `Item.stokAwal + SUM(StockLedger.qty)`. Ledger bertanda: masuk/retur positif, keluar negatif, koreksi dapat keduanya.

## Operasi
- `barangMasuk`: satu entri `MASUK` manual.
- `koreksiStok`: hitung stok saat ini dalam transaksi Serializable, lalu tulis delta `KOREKSI`.
- `submitStockIn`: batch `MASUK`, update `Item.hargaBeli` ke unit cost terakhir, simpan supplier/ref/catatan sebagai teks ledger.
- POS dan tukar menulis ledger dengan `refType` dan `refId`.

## Cache
`getStokAkhir` dan `getStokAkhirMap` memakai `unstable_cache` 60 detik/tag `stock`. Semua mutasi stok yang ditemukan melakukan invalidasi tag.

## Batasan aktual
Komentar lama menyatakan stok boleh minus, tetapi checkout terbaru memanggil `validateStockDemand` dan menolak pengeluaran melebihi stok. Stok negatif masih bisa berasal dari stok awal/koreksi atau data historis.
