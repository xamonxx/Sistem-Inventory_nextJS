---
type: server-actions
status: verified
last_verified: 2026-10-12
source_files:
  - src/app/(app)/non-gudang/barang/actions.ts
  - src/app/(app)/non-gudang/konsumen/actions.ts
  - src/app/(app)/non-gudang/buat-invoice/actions.ts
  - src/app/(app)/non-gudang/invoice/actions.ts
related: ["[[API-Overview]]", "[[Non-Warehouse-Orders-and-Invoices]]"]
tags: [api, server-actions, non-gudang]
---
# Non-Gudang Server Actions

Semua action memerlukan `ADMIN_NONGUDANG`.

| File | Actions utama |
|---|---|
| `barang/actions.ts` | save/toggle/delete katalog |
| `konsumen/actions.ts` | save/delete konsumen |
| `buat-invoice/actions.ts` | create invoice/CO, resolve product untuk cart |
| `invoice/actions.ts` | cicilan/pelunasan dan edit invoice |

Create invoice dan pembayaran memakai transaksi DB; edit invoice mengganti seluruh snapshot line dalam transaksi. Semua perubahan utama dicatat ke `ActivityLog` dan me-revalidate route non-gudang terkait.
