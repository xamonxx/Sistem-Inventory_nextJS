---
type: database-tables
status: verified
last_verified: 2026-10-12
source_files: [prisma/schema.prisma]
related: ["[[Authentication-and-Access]]", "[[User-and-Activity-Administration]]"]
tags: [database, tables]
---
# Identity and Audit Tables

## `users` (`User`)
`id`, unique `username`, `nama`, bcrypt `password`, `role`, `aktif`, `createdAt`. Berelasi ke activity logs, transactions, stock ledgers, dan returns.

## `activity_logs` (`ActivityLog`)
`userId?`, `aksi`, `entitas`, `entitasId?`, JSON-as-text `detail`, `createdAt`. Index pada user dan waktu. Relasi user opsional agar event sistem atau histori dapat tetap ada.

## Enum `Role`
`ADMIN_KASIR`, `ADMIN_GUDANG`, `ADMIN_NONGUDANG`.

Password hash dan token tidak boleh disalin ke dokumentasi atau log perubahan.
