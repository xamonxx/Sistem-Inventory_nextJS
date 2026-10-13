---
type: database-tables
status: verified
last_verified: 2026-10-13
source_files: [prisma/schema.prisma]
related: ["[[Authentication-and-Access]]", "[[User-and-Activity-Administration]]", "[[Idempotency-Schema-Rollout]]"]
tags: [database, tables]
---
# Identity and Audit Tables

## `users` (`User`)
`id`, unique `username`, `nama`, bcrypt `password`, `role`, `aktif`, `createdAt`. Berelasi ke activity logs, transactions, stock ledgers, dan returns.

## `activity_logs` (`ActivityLog`)
`userId?`, `aksi`, `entitas`, `entitasId?`, JSON-as-text `detail`, `createdAt`. Index pada user dan waktu. Relasi user opsional agar event sistem atau histori dapat tetap ada. Sejak 2026-10-13 log untuk checkout, pembayaran, retur, invoice/pembayaran Non-Gudang, dan mutasi stok ditulis di transaksi yang sama dengan datanya (`logActivity(input, tx)`).

## `idempotency_keys` (`IdempotencyKey`)
Primary key `key` (VARCHAR 64), `scope`, `userId`, JSON-as-text `response`, `createdAt` (indexed). Menyimpan hasil mutasi yang sudah commit agar retry dengan key sama tidak membuat transaksi/pembayaran ganda. Tanpa FK. Production rollout: [[Idempotency-Schema-Rollout]].

## Enum `Role`
`ADMIN_KASIR`, `ADMIN_GUDANG`, `ADMIN_NONGUDANG`.

Password hash dan token tidak boleh disalin ke dokumentasi atau log perubahan.
