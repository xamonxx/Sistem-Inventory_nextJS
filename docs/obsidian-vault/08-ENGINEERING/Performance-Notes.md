---
type: engineering
status: verified
last_verified: 2026-10-12
source_files: [src/lib/stock.ts, src/app/(app)/page.tsx, src/lib/reports.ts]
related: ["[[Warehouse-Dashboard-and-Reporting]]", "[[Technical-Debt]]"]
tags: [engineering, performance]
---
# Performance Notes

## Optimasi aktif
- Prisma singleton mencegah client berlebih saat development reload.
- Stok cache 60 detik dengan tag invalidation.
- Dashboard cache/revalidate 30 detik.
- Dashboard mengambil transaksi periode sekali lalu mengelompokkan di memori, bukan query per hari.
- Page invoice membatasi 100 terbaru; non-gudang 200; activity log 200.
- Report helper menerapkan take default 500/maksimum 2000.
- `optimizePackageImports` untuk Lucide, date-fns, Recharts, Framer Motion, dan TanStack packages.

## Risiko
- `getStokAkhirMap` tanpa item IDs membaca semua item/ledger; dipakai dashboard.
- `laporanMargin` dipanggil lagi oleh `barangTerlaris`, sehingga page laporan dapat mengulang query/data transform.
- Notification polling tiap client 60 detik dan gudang menghitung stok semua item.
- Dashboard memiliki banyak query berurutan; beberapa dapat diparalelkan jika konsistensi snapshot tidak disyaratkan.
- Reporting/export besar masih memuat data ke memori proses.
