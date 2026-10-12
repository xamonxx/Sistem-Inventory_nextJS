---
type: business-flow
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/barang/actions.ts, src/lib/stock.ts]
related: ["[[Item-Master]]", "[[Stock-Mutation-Flow]]"]
tags: [flow, inventory]
---
# Item and Stock Flow

```mermaid
flowchart LR
    F[BarangForm] --> A[saveItem]
    A --> G[requireRole Gudang]
    G --> V[Zod and unique code]
    V --> I[(Item)]
    I --> C[revalidate stock tag and paths]
    L[(StockLedger)] --> S[getStokAkhirMap]
    I --> S
    S --> UI[Barang/Stok/Dashboard]
```

Create tanpa kode menjalankan generator SKU. Edit dapat mengubah `stokAwal`; karena stok akhir adalah turunan, perubahan ini mengubah saldo seluruh histori tanpa menulis ledger. Penghapusan hanya diizinkan jika tidak ada histori transaksi, return, item pengganti, atau ledger.
