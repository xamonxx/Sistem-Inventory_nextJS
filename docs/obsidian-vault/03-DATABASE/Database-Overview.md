---
type: database
status: verified
last_verified: 2026-10-12
source_files: [prisma/schema.prisma, src/lib/prisma.ts]
related: ["[[Entity-Relationship]]", "[[Data-Integrity]]", "[[System-Architecture]]"]
tags: [database, mysql, prisma]
---
# Database Overview

MySQL diakses dengan Prisma Client singleton. Schema mendefinisikan 20 model dan 8 enum.

## Kelompok tabel
- Identity/audit: [[Identity-and-Audit-Tables]]
- Master gudang: [[Warehouse-Master-Tables]]
- Transaksi gudang: [[Warehouse-Transaction-Tables]]
- Domain non-gudang: [[Non-Warehouse-Tables]]
- Nomor dokumen: [[Counter-Table]]

## Prinsip data
- Nilai uang menggunakan `Decimal`; konversi ke `number` dilakukan untuk serialisasi/perhitungan UI.
- Harga transaksi disnapshot pada detail.
- Stok efektif diturunkan dari stok awal dan ledger.
- Detail transaksi/invoice tertentu memakai cascade delete; banyak relasi lain mengandalkan penghapusan eksplisit di Server Action.
- Index tersedia pada kolom pencarian, tanggal, status, dan foreign key utama.

Tidak ditemukan folder migration Prisma pada tree aktif; provisioning terdokumentasi menggunakan `prisma db push`.
