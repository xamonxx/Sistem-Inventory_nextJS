---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/app/(app)/non-gudang/konsumen/actions.ts, src/app/(app)/non-gudang/buat-invoice/actions.ts, src/app/(app)/non-gudang/konsumen/NgKonsumenClient.tsx]
related: ["[[Non-Warehouse-Order-Flow]]", "[[Non-Warehouse-Tables]]"]
tags: [module, non-gudang, crm]
---
# Non-Warehouse Consumers

`NgKonsumen` menyimpan nama, grup, alamat, dan workshop. Create invoice dapat memakai ID terpilih jika nama masih cocok, mencari berdasarkan nama, atau auto-create konsumen baru.

## Aturan
- Mutasi membutuhkan `ADMIN_NONGUDANG`.
- Penghapusan konsumen diblokir jika `NgInvoice.konsumenId` pernah mereferensikannya.
- Invoice menyimpan snapshot data konsumen, sehingga edit master tidak mengubah dokumen historis.

## Dampak perubahan
Perubahan matching nama memengaruhi kemungkinan duplikasi konsumen dan relasi laporan per konsumen.

## Tampilan (2026-10-13)
Master Konsumen: `PageHeader` (+ Tambah Konsumen), 4 `StatCard`, kotak cari, tabel mulai `lg` (nama + grup, alamat/bengkel redup dengan "–", jumlah invoice berupa pil hanya bila > 0, edit `IconAction`), daftar ringkas di bawah `lg`; seleksi hapus sama dengan Master Barang. Semua halaman Non-Gudang memakai primitif `src/components/page` (lihat [[Core-UI-Components]]).
