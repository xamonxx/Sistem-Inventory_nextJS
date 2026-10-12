---
type: architecture
status: verified
last_verified: 2026-10-12
source_files:
  - src/lib/auth.ts
  - src/lib/prisma.ts
  - src/lib/validation.ts
  - src/app/(app)/kasir/actions.ts
related: ["[[API-Overview]]", "[[Authentication]]", "[[Data-Integrity]]"]
tags: [backend, architecture]
---
# Backend Architecture

Backend berjalan di runtime Next.js yang sama.

## Pola handler
- **Server Components**: query read langsung melalui Prisma dan fungsi laporan.
- **Server Actions**: mutasi bisnis dengan `"use server"`, Zod, `requireRole`, Prisma transaction, audit log, lalu revalidation.
- **Route Handlers**: `GET /api/search`, `GET /api/notifications`, dan `GET|POST /logout`.
- **Public verification page**: memvalidasi JWT khusus invoice sebelum membaca invoice.

## Modul domain inti
- Validasi generik: `src/lib/validation.ts`.
- Aturan stok: `src/lib/inventoryRules.ts` dan `src/lib/stock.ts`.
- Checkout: `src/lib/checkoutRules.ts`.
- Retur: `src/lib/returnRules.ts`.
- Invoice: `src/lib/invoiceRules.ts`.
- Nomor dokumen: `src/lib/counters.ts`.
- Margin non-gudang: `src/lib/ngMargin.ts`.
- Audit: `src/lib/activity.ts`.

## Error dan atomicity
Aksi utama mengembalikan objek `{ ok, error }`, menggunakan `safeError` untuk pesan aman, dan menjalankan operasi lintas tabel dalam `prisma.$transaction`. Checkout, retur, pembayaran, koreksi stok, dan stock-in menggunakan transaksi; sejumlah alur memakai isolasi `Serializable`.
