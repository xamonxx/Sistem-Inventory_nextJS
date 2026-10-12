---
type: frontend-components
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app), src/components/InvoiceDocument.tsx, src/components/Nota.tsx]
related: ["[[Core-UI-Components]]", "[[State-Management]]", "[[Routes]]"]
tags: [frontend, components]
---
# Business Components

## Gudang
- `BarangClient`/`BarangForm`: list, filter, edit, barcode, stock opname print.
- `KasirClient`: POS wizard/cart/checkout, pencarian barang, dan filter `ITEM_CATEGORIES`.
- `StokClient`/`StokForm`/`StockInClient`: ledger, manual mutation, batch restock.
- `ReturClient`: pencarian transaksi dan stepper retur/tukar.
- `InvoiceClient`/`InvoiceActions`/`EditInvoiceClient`: list, payment, print, sharing, edit.
- `LaporanClient`, `DashboardCharts`: analytics/export display.
- `PenggunaClient`/`PenggunaForm`, `LogAktivitasClient`.

## Non-gudang
`NgBarangClient/Form`, `NgKonsumenClient/Form`, `NgBuatInvoiceClient`, `NgInvoiceClient`, `NgDashboardClient/Charts`, `NgLaporanClient`, `NgPembelianClient`.

## Dokumen
`InvoiceDocument`, `Nota`, dan `PrintBar` membentuk tampilan print/PDF. Export Excel berada di `src/lib/export` dan dipanggil dari client laporan/invoice.
