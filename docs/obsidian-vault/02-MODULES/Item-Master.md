---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/barang/page.tsx, src/app/(app)/barang/actions.ts, src/lib/itemCode.ts]
related: ["[[Item-and-Stock-Flow]]", "[[Stock-Ledger]]", "[[Warehouse-Master-Tables]]"]
tags: [module, inventory]
---
# Item Master

## Fungsi
CRUD terbatas untuk `Item`, kategori allowlist, harga beli/jual, stok awal, minimum stok, status aktif, barcode/QR, dan histori ledger terakhir.

## Aturan
- Hanya `ADMIN_GUDANG` dapat menyimpan, menonaktifkan, menghapus, atau mencetak barcode ber-audit.
- Kode unik; jika kosong pada create, `nextItemCode` menghasilkan `PC-{PREFIX}-{NNN}`.
- Kategori berasal dari `ITEM_CATEGORIES`.
- Penghapusan permanen hanya untuk item tanpa `TransactionItem`, `ReturnItem`, item pengganti, atau `StockLedger`.
- Perubahan `stokAwal` menginvalidasi cache `stock`.

## Event → operasi
`BarangForm`/`BarangClient` → Server Actions di `barang/actions.ts` → `Item`/`ActivityLog` → revalidate dashboard, barang, stok.
