---
type: engineering
status: verified
last_verified: 2026-10-12
source_files: [package.json, scripts/security-test.ts, scripts/webapp-smoke-test.py]
related: ["[[Build-and-Test]]", "[[Technical-Debt]]"]
tags: [engineering, testing]
---
# Testing Strategy

## Suite tersedia
- `npm test` → `tsx scripts/security-test.ts`.
- Security test menguji sanitasi/validation primitives, enum, batas uang/qty, dan skenario `validateStockDemand`.
- `npm run test:webapp` → Playwright Python smoke test untuk login/navigation; Playwright Python harus tersedia di environment.
- `npm run type-check` dan `npm run lint`.
- `npm run build` mencakup Prisma generate + Next build.

## Coverage gap
Tidak ditemukan unit/integration test otomatis untuk transaksi Prisma, checkout, retur, payment, invoice deletion cascade, non-gudang lifecycle, auth cookie, atau Route Handlers. Security script lebih dominan menguji schema/helper, bukan authorization end-to-end.

## Minimum perubahan
- Domain rules: test helper deterministik.
- Mutasi database: smoke skenario nyata pada database disposable.
- UI: browser smoke pada surface berubah.
- Selalu laporkan command yang benar-benar dijalankan; jangan menyamakan type-check dengan behavior test.
