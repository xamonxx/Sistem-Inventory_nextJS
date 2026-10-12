---
type: database-tables
status: verified
last_verified: 2026-10-12
source_files: [prisma/schema.prisma]
related: ["[[Item-Master]]", "[[POS-Transactions]]"]
tags: [database, tables, gudang]
---
# Warehouse Master Tables

## `items` (`Item`)
Unique `kode`, `nama`, optional `kategori`, `hargaBeli`, `hargaJual`, `stokAwal`, `minStok`, `aktif`, timestamps. Parent untuk ledger, transaction item, dan return item.

## `clients` (`Client`)
Nama/alamat/telepon dan relasi ke transactions/invoices. POS mencari berdasarkan nama sebelum create.

## `workshops` (`Workshop`)
Nama/alamat dan relasi ke transactions. POS mencari berdasarkan nama sebelum create.

## `project_groups` dan `projects`
Project opsional memiliki group; transaction dan invoice dapat tertaut ke project. POS membuat master ini secara dinamis berdasarkan nama.
