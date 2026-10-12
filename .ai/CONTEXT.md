# Project Context

Sistem Inventory & Kasir berbasis Next.js 15 App Router, React 19, TypeScript strict, Prisma, dan MySQL. Tiga role aktif: `ADMIN_KASIR`, `ADMIN_GUDANG`, `ADMIN_NONGUDANG`.

## Domain
- Gudang: item, ledger stok, POS, retur/tukar, invoice/piutang, dashboard/laporan, user/activity.
- Non-gudang: katalog luar, konsumen, order/invoice/payment dan laporan terpisah; tidak memutasi stok gudang.
- Platform: JWT session, search, notifications, print, public invoice verification.

## Critical invariants
- Stok akhir = `Item.stokAwal + SUM(StockLedger.qty)`.
- Semua nilai historis transaksi memakai snapshot.
- Mutasi keuangan/stok lintas tabel memakai Prisma transaction; beberapa Serializable.
- Server mutation harus role-guarded dan input server-validated.
- Non-gudang tidak menulis `Item`/`StockLedger`.

## Read next by task
- Arsitektur: [`context/architecture.md`](context/architecture.md)
- Rules: [`context/domain-rules.md`](context/domain-rules.md)
- Conventions: [`context/conventions.md`](context/conventions.md)
- Dependencies: [`context/dependencies.md`](context/dependencies.md)
- Deep docs: [`Dashboard`](../docs/obsidian-vault/00-HOME/Dashboard.md)
