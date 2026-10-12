---
type: engineering
status: verified
last_verified: 2026-10-12
source_files: [README.md, package.json, .claude/launch.json, scripts/webapp-smoke-test.py]
related: ["[[Known-Bugs]]", "[[Risks]]", "[[Improvements]]"]
tags: [engineering, debt]
---
# Technical Debt

## Dokumentasi/config drift
- README menyebut port 3000, importer XLSX, `import:xlsx`, dan `src/app/api/export`; artefak tersebut tidak ditemukan pada tree/manifest aktif.
- (Teratasi 2026-10-12) Port dev diseragamkan ke 3000; `.env` NEXT_PUBLIC_APP_URL masih 3001.
- `eslint-config-next` 15.1.4 sementara `next` 15.5.19.

## Dependency
Import usage tidak ditemukan untuk React Query, TanStack Table, dan React Hook Form. Verifikasi build/package audit sebelum menghapus.

## Arsitektur/data
- Tidak ada migration history Prisma pada repository; `db push` menjadi jalur setup yang terdokumentasi.
- Role `ADMIN_NONGUDANG` tidak dapat dibuat lewat `saveUser` karena allowlist hanya Kasir/Gudang.
- `ActivityLog` dapat dibersihkan dan tidak immutable.
- `StockLedger.refType/refId` dan userId pada model Ng tidak memiliki FK.
- `InvoiceStatus.DRAFT` tidak ditemukan dalam lifecycle aktif.
- `laporanOmset` diekspor tetapi tidak ditemukan caller.

## Test debt
Flow transaksi utama belum memiliki test DB/integration permanen. Lihat [[Testing-Strategy]].
