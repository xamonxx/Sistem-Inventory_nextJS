---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/lib/stock.ts, src/app/(app)/stok/actions.ts, src/app/(app)/stok/masuk/actions.ts]
related: ["[[Stock-Mutation-Flow]]", "[[Item-Master]]", "[[Warehouse-Transaction-Tables]]"]
tags: [module, inventory, stock]
---
# Stock Ledger

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
