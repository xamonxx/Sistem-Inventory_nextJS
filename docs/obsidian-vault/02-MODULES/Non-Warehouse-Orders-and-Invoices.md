---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/app/(app)/non-gudang/buat-invoice/actions.ts, src/app/(app)/non-gudang/invoice/actions.ts, src/lib/ngMargin.ts, src/app/(app)/non-gudang/invoice/NgInvoiceClient.tsx]
related: ["[[Non-Warehouse-Order-Flow]]", "[[Non-Warehouse-Invoice-Lifecycle]]", "[[Non-Warehouse-Catalog]]"]
tags: [module, non-gudang, invoice]
---
# Non-Warehouse Orders and Invoices

## Model bisnis
Satu invoice/CO hanya boleh berisi produk dari satu toko sumber. Domain ini tidak menyentuh `Item`, `StockLedger`, `Transaction`, atau invoice gudang.

## Create
Server merge item duplikat, membaca harga master, menghitung modal/penjualan/profit/margin/markup, membuat `NG-xxxxx`, snapshot line, menghubungkan konsumen, dan opsional membuat pelunasan awal. TEMPO menetapkan jatuh tempo +7 hari.

## Payment
`bayarNgInvoice` berjalan Serializable, clamp ke sisa, menambah `NgPayment`, dan mengubah PENDING/PARTIAL/LUNAS.

## Edit
Line lama dihapus dan dibuat ulang karena tidak ada stok. Total baru tidak boleh di bawah pembayaran yang sudah tercatat. Payment historis tidak diubah.

## Tampilan Riwayat Invoice (2026-10-13)
`PageHeader` + 4 `StatCard` (Invoice, Omzet, Piutang, Belum lunas), `FilterBar` (cari, status, periode), panel daftar dengan tabel mulai `xl` (no. invoice sebagai tautan, konsumen, toko teks redup, total, sisa kuning bila > 0, `StatusDot` Lunas/Terlambat/Sebagian/Tempo, 4 `IconAction`: detail, edit, struk thermal, invoice A4) dan daftar ringkas di bawahnya. Drawer detail, modal bayar/edit, dan pratinjau nota tidak berubah. Semua halaman Non-Gudang memakai primitif `src/components/page` (lihat [[Core-UI-Components]]).
