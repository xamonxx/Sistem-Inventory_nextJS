---
type: adr
status: accepted-reconstructed
last_verified: 2026-10-12
source_files: [src/lib/auth.ts, src/app/(app)/kasir/actions.ts, src/app/(app)/stok/actions.ts]
related: ["[[Backend-Architecture]]", "[[Authorization]]"]
tags: [adr, backend, security]
---
# ADR-002: Server Actions and Role Guards

## Context
Mayoritas mutasi dipicu oleh form/client pada App Router dan memerlukan session serta role.

## Decision
Mutasi domain utama diimplementasikan sebagai Next.js Server Actions. Setiap mutation memanggil `requireRole` dengan allowlist domain, memvalidasi input server-side, menulis audit log, lalu revalidate.

## Consequences
- Contract internal berbentuk fungsi/payload, bukan REST endpoint publik.
- Authorization tetap harus di action walaupun UI disembunyikan.
- Error action perlu disanitasi sebelum kembali ke client.
- Read page harus memiliki guard role sendiri; saat ini belum seluruhnya konsisten dan tercatat di [[Security-Notes]].

## Evidence
Action files pada `src/app/(app)/**/actions.ts` dan `src/lib/auth.ts`.
