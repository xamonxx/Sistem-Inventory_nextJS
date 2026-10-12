---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/lib/ngReports.ts, src/app/(app)/non-gudang/laporan/page.tsx, src/app/(app)/non-gudang/pembelian/page.tsx, src/app/(app)/non-gudang/NgDashboardClient.tsx, src/app/(app)/non-gudang/NgDashboardCharts.tsx, src/app/(app)/non-gudang/laporan/NgLaporanClient.tsx, src/app/(app)/non-gudang/pembelian/NgPembelianClient.tsx]
related: ["[[Non-Warehouse-Orders-and-Invoices]]", "[[Warehouse-Dashboard-and-Reporting]]"]
tags: [module, reporting, non-gudang]
---
# Non-Warehouse Reporting and Purchases

`ngAnalisa` membangun summary, agregasi per toko, produk, dan tren dari invoice non-gudang. `ngPembelian` menyajikan sisi modal/pembelian per toko dan per invoice. `ngLaporanKonsumen` mengelompokkan penjualan/piutang/profit dari snapshot nama konsumen.

Semua page memerlukan `ADMIN_NONGUDANG` dan menerima rentang `YYYY-MM-DD`. Modul pembelian bersifat read-only; tidak ditemukan model payable/supplier invoice terpisah. Satu `NgInvoice` diperlakukan sebagai satu pembelian dari satu toko.

## Tampilan (2026-10-13)
- Dashboard `/non-gudang`: `PageHeader` (periode + Unduh Excel), 4 `StatCard` utama (Omzet, Keuntungan + margin, Sisa Piutang + jumlah terlambat, Pembelian) dan satu strip sekunder (jumlah invoice, toko aktif, terlambat). Grafik di `NgDashboardCharts`: `NgTrendChart` (area bergradasi) dan `NgRankBarChart` (batang satu gradasi, 3 teratas penuh) menggantikan palet pelangi `BAR_COLORS`. Tabel per toko dan top produk memakai `TonePill` untuk margin.
- Riwayat Pembelian: `PageHeader` (periode), 4 `StatCard` (mini-stat duplikat di hero dihapus), peringkat toko dengan batang kontribusi satu warna, riwayat per invoice berupa baris ringkas yang bisa dibuka.
- Laporan & Unduhan: `PageHeader` (periode, Cetak PDF, Unduh Excel; aksi tetap `no-print`), 5 `StatCard` (kartu ke-5 melebar di bawah `lg`), rekap per konsumen dengan warna uang yang tenang dan baris total.
- Logika periode, export Excel, dan cetak tidak berubah. Semua halaman Non-Gudang memakai primitif `src/components/page` (lihat [[Core-UI-Components]]).
