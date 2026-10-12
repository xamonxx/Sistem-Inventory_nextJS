---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/app/(app)/barang/page.tsx, src/app/(app)/barang/actions.ts, src/app/(app)/barang/BarangClient.tsx, src/lib/itemCode.ts]
related: ["[[Item-and-Stock-Flow]]", "[[Stock-Ledger]]", "[[Warehouse-Master-Tables]]"]
tags: [module, inventory]
---
# Item Master

## Fungsi
CRUD terbatas untuk `Item`, kategori allowlist, harga beli/jual, stok awal, minimum stok, status aktif, barcode/QR, dan histori ledger terakhir.

## Tampilan `/barang` (2026-10-13)
- Tabel hanya mulai `xl` (butuh ±1.000px); di bawahnya kartu 1 kolom (HP) / 2 kolom (tablet). Kolom Stok Awal hanya di `2xl`.
- Statistik: grid 2 kolom (HP, Nilai Aset lebar di atas), 6 kolom sampai `2xl`, lalu 5 kolom. Toolbar filter dua baris sampai `2xl`.
- Gaya tenang: kode/kategori redup, harga jual menonjol, nilai nol diredupkan lewat warna teks, titik stok hanya untuk menipis/minus, status berupa titik + teks.
- Seleksi hapus massal: baris terpilih `rose-500/7%` di mode gelap, checkbox header indeterminate saat sebagian terpilih.

## Aturan
- Hanya `ADMIN_GUDANG` dapat menyimpan, menonaktifkan, menghapus, atau mencetak barcode ber-audit.
- Kode unik; jika kosong pada create, `nextItemCode` menghasilkan `PC-{PREFIX}-{NNN}`.
- Kategori berasal dari `ITEM_CATEGORIES`.
- Penghapusan permanen hanya untuk item tanpa `TransactionItem`, `ReturnItem`, item pengganti, atau `StockLedger`.
- Perubahan `stokAwal` menginvalidasi cache `stock`.

## Event → operasi
`BarangForm`/`BarangClient` → Server Actions di `barang/actions.ts` → `Item`/`ActivityLog` → revalidate dashboard, barang, stok.
