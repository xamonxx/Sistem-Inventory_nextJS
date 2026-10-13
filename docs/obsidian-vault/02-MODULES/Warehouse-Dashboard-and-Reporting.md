---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/app/(app)/page.tsx, src/components/DashboardCharts.tsx, src/components/DashboardChartsWrapper.tsx, src/app/(app)/laporan/page.tsx, src/app/(app)/laporan/actions.ts, src/lib/reports.ts, src/lib/export/excelStyles.ts, src/lib/export/exportAnalyticExcel.ts, src/lib/export/exportInvoiceExcel.ts, src/lib/export/exportNgExcel.ts]
related: ["[[Warehouse-Reporting-Flow]]", "[[Stock-Ledger]]", "[[Warehouse-Invoices-and-Receivables]]"]
tags: [module, reporting]
---
# Warehouse Dashboard and Reporting

## Cakupan
Dashboard mengagregasi omset, margin, piutang, proyek, klien, tren 30 hari, barang terlaris, stok kritis/minus, nilai aset, dan aktivitas. Laporan menyediakan margin, barang terlaris, stok snapshot, dan piutang berdasarkan rentang tanggal.

## Tata letak dashboard (bento, 2026-10-13)
- Hero ringkas: badge mode, judul, sapaan, toggle Operasional/Owner, filter tanggal. Link mode/filter/Reset tidak berubah.
- Role Kasir (3 kartu ringkas): di `xl` ditumpuk sebagai baris horizontal agar tingginya sejajar kartu unggulan.
- KPI: kartu unggulan (Omzet Hari Ini / Omzet Bulan Ini) dengan sparkline SVG 30 hari yang dirender server, badge delta vs kemarin (mode operasional), dan ringkasan kemarin/30 hari atau 30 hari/rata-rata. KPI lain berupa kartu ringkas; Stok Menipis/Minus menautkan ke `/stok`, Piutang ke `/invoice`.
- Baris analitik: Tren Omzet & Margin (8/12) + Pusat Peringatan (4/12, selalu satu kolom; state "Semua stok aman" bila kosong).
- 10 Barang Terlaris berupa bar horizontal; Persentase Margin hanya memakai hari dengan omzet (hari tanpa penjualan = `null`) plus garis rata-rata; Omzet per Proyek berupa donut atau empty state ringkas; Riwayat Aktivitas memakai avatar inisial dan label aksi berbahasa Indonesia (`AKSI_LABEL`).
- Grafik dipecah menjadi `RevenueTrendChart`, `MarginPctChart`, `TopItemsChart`, `ProjectSalesChart` (dynamic, `ssr: false`) di `DashboardChartsWrapper`.
- Kelas CSS baru `bento-*` di `globals.css`; kelas lama (`liquid-panel`, `kpi-glass-card`, `chart-glass-card`, `dashboard-hero`, `dashboard-chip`) tetap dipakai halaman Non-Gudang.
- Perbaikan data: kunci tanggal tren 30 hari kini memakai tanggal lokal (`localDateKey`), bukan `toISOString()` (UTC), sehingga label hari dan delta tidak bergeser satu hari di WIB.

## Tampilan Laporan `/laporan` (2026-10-13)
- Judul dan tombol Unduh Excel / PDF A4 dirender di `LaporanClient` (judul dihapus dari `page.tsx`).
- Tab berupa segmented control mengikuti tema (sebelumnya aktif di-hardcode `#0f2236`), berdampingan dengan `PeriodFilter`; catatan "posisi terkini" hanya di Ringkasan dan Stok & Aset.
- `StatCard`/`Panel` memakai `.bento-card`; ikon panel lewat `IconChip`; tabel memakai token teks tema. Pada tabel sempit (Terlaris, Peringatan Stok, Cepat/Lambat Laku) kode barang ditaruh di bawah nama sehingga panel tetap dua kolom mulai `xl`.
- Tidak berubah: query server, tab, fungsi export, dan `LaporanPrintDocument`.

## Hak akses
Dashboard utama tersedia bagi Kasir/Gudang; `ADMIN_NONGUDANG` dialihkan ke dashboard sendiri. Margin, aset, laporan gudang, dan mode owner dibatasi oleh role di UI/page.

## Data dependencies
`Transaction`, `TransactionItem`, `Invoice`, `Item`, `StockLedger`, `Project`, `Client`, `User`, `ActivityLog`.

## Batasan
`reports.ts` membatasi page default 500 dan maksimum 2000. `laporanOmset` diekspor tetapi tidak ditemukan dipakai oleh page aktif. Stok/aset pada laporan adalah posisi terkini, bukan snapshot historis sesuai periode.

## Export Excel (ExcelJS, client-side)

| Halaman | Modul | Sheet |
|---|---|---|
| `/laporan` | `exportAnalyticExcel` | Ringkasan, Penjualan, Margin, Piutang & Umur Piutang, Stok & Aset, Stok Keluar |
| `/invoice` | `exportInvoiceExcel` | Ringkasan, Daftar Invoice, Rincian Barang, Riwayat Pembayaran (mengikuti filter aktif) |
| `/non-gudang`, `/non-gudang/laporan` | `exportNgExcel` | Ringkasan, Pembelian per Toko, Top Produk, Tren Bulanan, Per Konsumen (opsional) |

Konvensi bersama di `excelStyles.ts` (audit 2026-10-12):
- Blok judul navy (`<Laporan> — <Sheet>` + baris perusahaan), metadata Periode/Filter, Tanggal Unduh (tanggal+jam), Diekspor oleh.
- Header tabel navy teks putih, zebra, baris TOTAL (`COLOR.totalBg`) tebal dengan garis atas tegas; status hanya mewarnai sel status, bukan seluruh baris.
- **Header berwarna per kelompok kolom** (2026-10-13): `applyHeaderStyle` memilih warna tiap sel header dari teksnya lewat `HEADER_TONES` / `headerToneFor` (aturan pertama yang cocok menang): status/catatan slate, persentase violet, piutang/risiko/keluar rose, tanggal/umur cyan, identitas (No., Kode, KPI) navy, kuantitas/stok teal, nominal uang emerald, selain itu (pihak/barang) indigo. Tiap header punya garis aksen bawah warna terang senada dan pemisah putih antar kolom; baris perusahaan di blok judul mendapat aksen sky. Baris header dicatat per sheet (`headerRows`) sehingga `applyBorder`/`autoFitColumns` tidak lagi mendeteksi header dari warna. Wajib menulis teks header sebelum memanggil `applyHeaderStyle`.
- `finalizeWorkbook`: gridline disembunyikan, A4 (landscape bila >6 kolom, fit 1 halaman lebar), header tabel (`setPrintHeaderRow`) diulang tiap halaman cetak, footer `Halaman &P dari &N`. Tidak ada freeze pane (permintaan pengguna 2026-10-12): judul dan header bergulir normal di Excel.
- Tanggal digeser ke waktu lokal saat finalisasi karena ExcelJS menulis `Date` sebagai UTC (tanpa ini transaksi 00:00–06:59 WIB tercatat tanggal kemarin).
- Jatuh tempo seragam `DUE_DAYS = 30` dari tanggal invoice; status stok memakai `sisa < minStok` (sama dengan aplikasi & notifikasi).
- Nama file `<Prefix>_YYYY-MM-DD_HHmm.xlsx` (`Laporan-Analitik`, `Invoice-Piutang`, `Analisa-NonGudang`).
- Kolom placeholder yang selalu "Tidak tersedia" dihapus (No/Tgl transaksi di Penjualan; Stok Masuk/Keluar di Stok). Stok kini memuat Kategori (`laporanStok` mengirim `kategori`), Min. Stok, dan Harga Jual.
- Sheet **Stok Keluar** (2026-10-12): data dari `laporanStokKeluar(range)` lewat server action `fetchStokKeluarForExport` (khusus `ADMIN_GUDANG`, dipanggil hanya saat ekspor). Sumber: `StockLedger` tipe `KELUAR` + `KOREKSI` bernilai minus dalam periode aktif, digabung nomor transaksi, pelanggan, dan harga snapshot `TransactionItem`. Isi: rekap per barang (jumlah keluar, dari koreksi, jumlah transaksi, nilai penjualan) + riwayat per mutasi (tanggal-jam, jenis, no. transaksi, pelanggan, barang, kategori, jumlah, harga, nilai, petugas, keterangan). Dibatasi `STOK_KELUAR_MAX_ROWS = 5000` mutasi terbaru; bila terpotong, sheet menampilkan catatan. `parseReportRange` kini dipakai bersama halaman & action.
- Sheet **Stok & Aset** (2026-10-12) memuat mutasi global sepanjang waktu per barang: Stok Awal, Stok Masuk (ledger qty > 0), Stok Keluar (ledger qty < 0), Sisa Stok, sehingga `Stok Awal + Masuk - Keluar = Sisa`. Data dari `laporanStok` (dua `groupBy` ledger tambahan); ringkasan menambah total masuk/keluar/sisa. Diverifikasi: 173 barang, 0 selisih rekonsiliasi, total keluar sama dengan sheet Stok Keluar.
- Gaya kolom mutasi di Stok & Aset (`STOCK_TONE`): latar lembut per kelompok (Awal slate-50, Masuk green-50, Keluar rose-50, Sisa blue-50) dengan teks warna kelompok; angka 0 diredupkan (`STOCK_ZERO_TEXT`), kecuali Sisa 0 tetap merah. Nilai Aset & Kontribusi bernilai 0 juga diredupkan.
- Sheet Stok Keluar memakai tone yang sama lewat `toneCell` + `TONE`: Jumlah Keluar rose (tebal), Dari Koreksi orange, Jumlah Transaksi slate, Jenis Penjualan biru / Koreksi orange; angka 0 diredupkan.
- **Margin total keseluruhan** (2026-10-12): `laporanMargin` kini agregasi SQL (`$queryRaw` GROUP BY item) atas SEMUA baris penjualan periode. Sebelumnya hanya 500 baris `TransactionItem` terbaru dijumlah (`pageArgs`), sehingga total omzet/margin/persen bisa terlalu kecil. UI: kartu Margin Keuntungan menampilkan persen margin total (laba kotor ÷ omzet, 2 desimal) dan tab Margin punya baris *Total keseluruhan*; laporan PDF memakai format 2 desimal yang sama. Excel: Ringkasan (Persentase Acuan) dan baris TOTAL sheet Margin. Diverifikasi: agregasi = hitung manual (Semua Waktu 21,46%, Sep-2026 22,03%).
