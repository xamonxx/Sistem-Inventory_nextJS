---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/lib/ngReports.ts, src/app/(app)/non-gudang/laporan/page.tsx, src/app/(app)/non-gudang/pembelian/page.tsx]
related: ["[[Non-Warehouse-Orders-and-Invoices]]", "[[Warehouse-Dashboard-and-Reporting]]"]
tags: [module, reporting, non-gudang]
---
# Non-Warehouse Reporting and Purchases

`ngAnalisa` membangun summary, agregasi per toko, produk, dan tren dari invoice non-gudang. `ngPembelian` menyajikan sisi modal/pembelian per toko dan per invoice. `ngLaporanKonsumen` mengelompokkan penjualan/piutang/profit dari snapshot nama konsumen.

Semua page memerlukan `ADMIN_NONGUDANG` dan menerima rentang `YYYY-MM-DD`. Modul pembelian bersifat read-only; tidak ditemukan model payable/supplier invoice terpisah. Satu `NgInvoice` diperlakukan sebagai satu pembelian dari satu toko.
