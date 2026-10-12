---
type: architecture
status: verified
last_verified: 2026-10-12
source_files:
  - src/app/layout.tsx
  - src/app/(app)/layout.tsx
  - src/lib/prisma.ts
  - prisma/schema.prisma
related: ["[[Frontend-Architecture]]", "[[Backend-Architecture]]", "[[Database-Overview]]"]
tags: [architecture]
---
# System Architecture

Aplikasi adalah monolit Next.js. Browser mengonsumsi React Server Components, Client Components, Server Actions, dan Route Handlers dari deployment yang sama. Prisma adalah satu-satunya jalur akses database aplikasi yang ditemukan.

```mermaid
flowchart LR
    B[Browser]
    RSC[App Router Server Components]
    CC[Client Components]
    SA[Server Actions]
    RH[Route Handlers]
    LIB[Domain and utility modules]
    P[Prisma Client]
    DB[(MySQL)]
    B --> RSC
    B --> CC
    CC --> SA
    CC --> RH
    RSC --> LIB
    SA --> LIB
    RH --> LIB
    LIB --> P
    SA --> P
    RSC --> P
    P --> DB
```

## Lapisan implementasi
1. `src/app`: routing, pages, layouts, Route Handlers, dan Server Actions.
2. `src/components`: UI lintas halaman dan komponen bisnis.
3. `src/lib`: auth, aturan domain, cache stok, laporan, state client, ekspor, dan utilitas.
4. `prisma/schema.prisma`: model relasional dan enum.

Tidak ditemukan service directory, middleware Next.js, queue, worker, atau scheduler server. Polling notifikasi terjadi di browser setiap 60 detik.

## Batas penting
- Auth diterapkan pada layout `(app)` dan kembali ditegakkan di sebagian besar mutasi melalui `requireRole`.
- Domain gudang dan non-gudang memiliki tabel dan alur terpisah.
- Side effect bisnis kritis dibungkus transaksi Prisma, sering dengan isolasi `Serializable`.
