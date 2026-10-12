---
type: overview
status: verified
last_verified: 2026-10-12
source_files:
  - package.json
  - src/app/layout.tsx
  - prisma/schema.prisma
related: ["[[System-Architecture]]", "[[Database-Overview]]", "[[Routes]]"]
tags: [overview, architecture]
---
# Project Overview

Aplikasi web internal untuk inventory gudang, kasir/POS, retur atau tukar, invoice/piutang, laporan, serta domain trading non-gudang yang terpisah.

## Teknologi terverifikasi
| Area | Implementasi |
|---|---|
| Framework | Next.js 15.5.19, App Router |
| UI runtime | React 19, TypeScript 5.7 strict |
| Styling | Tailwind CSS 4 melalui PostCSS |
| Database | MySQL |
| ORM | Prisma 6.19.x terpasang; manifest meminta `^6.2.1` |
| Auth | JWT HS256 dalam cookie HTTP-only menggunakan `jose` |
| Validasi | Zod + helper `src/lib/validation.ts` |
| Client state | Zustand untuk keranjang POS dan non-gudang |
| Charts/UX | Recharts, Framer Motion, Sonner, Lucide |
| Export/print | ExcelJS dan subsistem print iframe; HTML-to-image/html2canvas tersedia |

## Batas domain
`Item`, `StockLedger`, `Transaction`, `Return`, dan `Invoice` membentuk domain gudang/retail. `NgProduk`, `NgInvoice`, `NgInvoiceItem`, `NgPayment`, dan `NgKonsumen` membentuk domain non-gudang. Kedua domain tidak berbagi stok atau transaksi.

## Entry point
- Layout publik/root: `src/app/layout.tsx`
- Shell terautentikasi: `src/app/(app)/layout.tsx`
- Dashboard gudang/retail: `src/app/(app)/page.tsx`
- Dashboard non-gudang: `src/app/(app)/non-gudang/page.tsx`
- Skema data: `prisma/schema.prisma`

## Relasi
- [[Frontend-Architecture]]
- [[Backend-Architecture]]
- [[Authentication]]
- [[Authorization]]
- [[Module-Graph]]
