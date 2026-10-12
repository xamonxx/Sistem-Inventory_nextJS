---
type: server-actions
status: verified
last_verified: 2026-10-12
source_files:
  - src/app/(app)/barang/actions.ts
  - src/app/(app)/stok/actions.ts
  - src/app/(app)/stok/masuk/actions.ts
  - src/app/(app)/kasir/actions.ts
  - src/app/(app)/retur/actions.ts
  - src/app/(app)/invoice/actions.ts
  - src/app/(app)/pengguna/actions.ts
related: ["[[API-Overview]]", "[[Authorization]]", "[[Warehouse-Transaction-Tables]]"]
tags: [api, server-actions, gudang]
---
# Gudang Server Actions

| File | Actions utama | Role |
|---|---|---|
| `barang/actions.ts` | save/suggest/toggle/delete/history/print log | Gudang; history Kasir+Gudang |
| `stok/actions.ts` | `barangMasuk`, `koreksiStok` | Gudang |
| `stok/masuk/actions.ts` | `submitStockIn` | Gudang |
| `kasir/actions.ts` | `createTransaction` | Kasir |
| `retur/actions.ts` | `createReturn`, `findTransactionByCode` | Kasir+Gudang |
| `invoice/actions.ts` | pay/update/delete/edit lines | Kasir |
| `pengguna/actions.ts` | save/toggle/reset password | Gudang |
| `log-aktivitas/actions.ts` | clear logs | Gudang |

Semua mutasi memvalidasi input server-side. Operasi finansial/stok lintas tabel menggunakan Prisma transaction; setelah commit, action menulis audit log dan revalidasi path/tag terkait.
