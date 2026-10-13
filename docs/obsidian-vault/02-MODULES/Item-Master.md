---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/app/(app)/barang/page.tsx, src/app/(app)/barang/actions.ts, src/app/(app)/barang/BarangClient.tsx, src/lib/itemCode.ts, src/lib/itemCategories.ts, src/lib/itemDisplayName.ts, scripts/add-items.ts]
related: ["[[Item-and-Stock-Flow]]", "[[Stock-Ledger]]", "[[Warehouse-Master-Tables]]"]
tags: [module, inventory]
---
# Item Master

## Fungsi
CRUD terbatas untuk `Item`, kategori allowlist, harga beli/jual, stok awal, minimum stok, status aktif, barcode/QR, dan histori ledger terakhir. Kategori aktif adalah BAHAN UTAMA, MATERIAL, AKSESORIS, KELISTRIKAN, dan HPL.

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
- Barang dengan harga lokasi khusus memakai suffix `(DEPOK)` atau `(LK)` agar identitas harga terlihat pada layar internal dan Kasir.
- `itemNameForCustomer` menghapus suffix lokasi terminal hanya pada dokumen pelanggan (`Nota` dan `InvoiceDocument`); snapshot dan tampilan internal tetap menyimpan nama lengkap.

## Import master multi-lokasi
- `npm run db:add-items` menampilkan dry-run; `npm run db:add-items -- --apply` menerapkan perubahan dalam satu transaksi.
- Dataset aktif memuat 475 barang: 73 utama, 18 Depok, dan 384 LK. Barang LK dimulai dengan stok nol.
- Dataset yang sama aktif di production sejak release `7032e5f` pada 2026-10-13; browser smoke Gudang dan Kasir menampilkan total 475 item serta kategori HPL.
- Import berdasarkan nama ternormalisasi, menjaga `stokAwal` dan `minStok` barang lama, menghasilkan kode unik untuk barang baru, dan mencatat satu audit ringkasan bila ada perubahan.
- Tiga baris ditahan: Block Board Polos 15mm tanpa harga, TACO TH 050 AA dengan harga beli mencurigakan, dan TACO TH 887 JG dengan dua pasangan harga berbeda.

## Event → operasi
`BarangForm`/`BarangClient` → Server Actions di `barang/actions.ts` → `Item`/`ActivityLog` → revalidate dashboard, barang, stok.
