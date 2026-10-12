---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/non-gudang/buat-invoice/actions.ts, src/app/(app)/non-gudang/invoice/actions.ts, src/lib/ngMargin.ts]
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
