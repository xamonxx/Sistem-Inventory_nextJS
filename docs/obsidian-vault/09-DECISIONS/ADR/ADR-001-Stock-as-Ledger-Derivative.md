---
type: adr
status: accepted-reconstructed
last_verified: 2026-10-12
source_files: [src/lib/stock.ts, prisma/schema.prisma]
related: ["[[Stock-Ledger]]", "[[Data-Integrity]]"]
tags: [adr, stock]
---
# ADR-001: Stock as Ledger Derivative

## Context
`Item` menyimpan `stokAwal`; semua mutasi disimpan pada `StockLedger.qty` bertanda.

## Decision
Stok akhir dihitung sebagai `stokAwal + SUM(StockLedger.qty)`. Tidak ada kolom current stock terpisah.

## Consequences
- Histori mutasi dapat diaudit dan source of truth tunggal.
- Query saldo membutuhkan agregasi; cache 60 detik mengurangi biaya baca.
- Semua write stok wajib menulis ledger dan menginvalidasi tag `stock`.
- Mengubah `stokAwal` mengubah saldo kini tanpa baris ledger; perlakukan sebagai operasi sensitif.
- Ref polymorphic harus dijaga aplikasi karena tidak ada FK.

## Evidence
`src/lib/stock.ts`, `src/app/(app)/stok/actions.ts`, `src/app/(app)/kasir/actions.ts`.
