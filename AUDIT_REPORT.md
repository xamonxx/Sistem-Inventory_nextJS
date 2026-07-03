# AUDIT REPORT WEB APP

## 1. Ringkasan Audit

Tanggal Audit: 2026-07-03
Nama Project: SISTEM_INVENTORY / Sistem Inventory & Kasir PUTRA CORPORATION
Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Prisma, MySQL, Server Actions
Mode Audit: Pre-Production / Before Push GitHub

## 2. Executive Summary

- Total bug/risiko ditemukan: 15
- Bug critical: 0
- Bug high: 3
- Bug medium: 8
- Bug low: 4
- Bug fixed: 9
- Bug need review: 4
- Bug not fixed: 2

Kondisi umum: aplikasi sudah jauh lebih siap untuk staging. Route utama bisa dibuka, lint/type-check/test/build lulus, role guard bekerja, responsive sweep production tidak menemukan horizontal document overflow, dan security header dasar aktif. Sisa yang masih perlu perhatian sebelum production adalah dependency moderate `exceljs -> uuid`, tracked artifact lama (`tmp/pdf-render-check/*`, `tsconfig.tsbuildinfo`), CSP yang masih longgar untuk inline/eval, serta finalisasi env/password production.

## 3. Checklist Audit

### Frontend
- [x] Semua halaman dicek
- [x] Responsive mobile dicek
- [x] Responsive tablet dicek
- [x] Responsive desktop dicek
- [x] Dark mode dicek
- [x] Light mode dicek
- [x] UI component dicek
- [x] Form validation dicek

### Backend
- [x] API dicek
- [x] Auth dicek
- [x] Role access dicek
- [x] Validation dicek
- [x] Database query dicek
- [x] Error handling dicek

### Report & Rekap
- [x] Semua report dicek
- [x] Filter dicek
- [x] Perhitungan dicek
- [x] Export dicek
- [x] PDF dicek
- [x] Print dicek

### Security
- [x] Env aman
- [x] Secret tidak bocor
- [x] API protected
- [x] Input sanitization
- [x] Gitignore aman untuk file baru

### Production Readiness
- [x] Lint pass
- [x] Type-check pass
- [x] Build pass
- [x] Test pass
- [x] README tersedia
- [x] ENV example tersedia

## 4. Detail Temuan Bug

| No | Prioritas | Area | File | Masalah | Dampak | Solusi | Status |
|---|---|---|---|---|---|---|---|
| 1 | High | Dependency | `package.json` | `next-pwa` tidak dipakai tetapi membawa high vulnerability dari Workbox/serialize-javascript. | Supply-chain risk dan audit gagal high. | Dependency `next-pwa` dihapus. | FIXED |
| 2 | High | Security/Auth | `prisma/seed.ts`, `prisma/seed-200.ts` | Seed memakai password default `password` tanpa guard production. | Akun default bisa terbawa ke production. | Seed production wajib `SEED_DEFAULT_PASSWORD` min 12 karakter; dev tetap default lokal. | FIXED |
| 3 | High | Security Headers | `next.config.ts` | `X-Powered-By` aktif dan HSTS belum dikirim. | Fingerprinting stack dan hardening HTTPS belum lengkap. | `poweredByHeader: false` dan `Strict-Transport-Security` ditambahkan. | FIXED |
| 4 | Medium | Backend/Invoice | `src/app/(app)/invoice/actions.ts` | `deleteInvoice` menerima ID tanpa validasi schema. | Payload invalid bisa memicu query/error tidak perlu. | Validasi `dbId` sebelum query/delete. | FIXED |
| 5 | Medium | Backend/Invoice | `src/app/(app)/invoice/actions.ts` | `deleteInvoices` menerima array tanpa batas dan tanpa dedupe. | Payload besar bisa membebani DB dan server action. | Validasi array ID, max 200, dedupe. | FIXED |
| 6 | Medium | Backend/Invoice | `src/app/(app)/invoice/actions.ts` | Update item invoice perlu validasi server-side yang konsisten. | Qty/item invalid atau duplikat bisa merusak total. | Payload item divalidasi dengan `invoiceItemPayloadSchema`. | FIXED |
| 7 | Medium | Backend/Invoice | `src/app/(app)/invoice/actions.ts` | Invoice terbayar sebagian bisa kembali jadi `PENDING`. | Status piutang salah hitung di UI/report. | Status dihitung `LUNAS/PARTIAL/PENDING`. | FIXED |
| 8 | Medium | Public Verify | `src/lib/invoiceVerify.ts` | Token verifikasi invoice tidak punya expiry. | Link QR berlaku terlalu lama. | Token baru diberi expiry 180 hari. | FIXED |
| 9 | Medium | Report/DB | `src/lib/reports.ts` | `laporanMargin` melakukan N+1 query per item. | Laporan lambat pada data besar. | Query diubah ke satu `findMany` dan agregasi in-memory. | FIXED |
| 10 | Medium | GitHub Readiness | `.env.example` | Tidak ada contoh env aman. | Setup contributor/production rawan salah dan secret bisa disalin manual. | `.env.example` dibuat dengan placeholder. | FIXED |
| 11 | Medium | Dependency | `exceljs`, `uuid` | `npm audit` masih menemukan 2 moderate dari `exceljs -> uuid`. | Audit dependency belum 100% bersih. | Tidak dipaksa downgrade karena fix npm menyarankan major downgrade `exceljs@3.4.0`. | NOT FIXED |
| 12 | Medium | GitHub Readiness | `tmp/pdf-render-check/*`, `tsconfig.tsbuildinfo` | Artifact/cache lama masih tracked Git. | Repo bengkak dan cache ikut push. | `.gitignore` diperkuat; file tracked perlu keputusan `git rm --cached`/hapus. | NEED REVIEW |
| 13 | Low | Security/CSP | `next.config.ts` | CSP masih memakai `'unsafe-inline'` dan `'unsafe-eval'`. | CSP belum maksimal melawan XSS lanjutan. | Dicatatan untuk nonce/hash CSP; belum dipaksa karena bisa memecah Next runtime/inline style. | NEED REVIEW |
| 14 | Low | Docs | `README.md` | README masih menyebut beberapa workflow lama/import yang tidak ditemukan saat scan. | Onboarding bisa membingungkan. | Perlu sinkronisasi docs setelah final scope fitur. | NEED REVIEW |
| 15 | Low | Tooling | `package.json` | Sebelumnya tidak ada `type-check` dan `test` script standar. | Gate CI tidak seragam. | Ditambahkan `type-check` dan `test` yang menjalankan security test. | FIXED |

## 5. Audit Per Halaman

| No | Halaman | Route | Responsive | Validasi | Bug | Status |
|---|---|---|---|---|---|---|
| 1 | Login | `/login` | OK | Username/password max length, rate limit memory | Perlu ganti default password production | FIXED/NEED REVIEW |
| 2 | Dashboard | `/` | OK | Date param divalidasi | Tidak ada blocker | OK |
| 3 | Invoice & Piutang | `/invoice` | OK | Payment/update/delete divalidasi | Delete ID dan status partial diperbaiki | FIXED |
| 4 | Detail Invoice | `/invoice/[id]` | OK | ID route via server query | PDF/print source OK | OK |
| 5 | Edit Invoice | `/invoice/edit/[id]` | OK | Payload item divalidasi | Validasi item diperkuat | FIXED |
| 6 | Kasir/POS | `/kasir` | OK | Checkout schema + business totals | Responsive POS OK | OK |
| 7 | Barang | `/barang` | OK | Zod + role admin gudang | Role kasir ditolak | OK |
| 8 | Stok | `/stok` | OK | Search/table OK | Tidak ada blocker | OK |
| 9 | Stok Masuk | `/stok/masuk` | OK | Batch stock-in schema | Role kasir ditolak | OK |
| 10 | Retur/Tukar | `/retur` | OK | Validasi transaksi asli dan qty retur | Tidak ada blocker | OK |
| 11 | Laporan | `/laporan` | OK | Filter tanggal server-side | Query margin dioptimasi | FIXED |
| 12 | Log Aktivitas | `/log-aktivitas` | OK | Role protected | Clear log tetap aksi destruktif admin | NEED REVIEW |
| 13 | Pengguna | `/pengguna` | OK | Role/password schema | Role kasir ditolak | OK |
| 14 | Verify Invoice | `/verify/[token]` | OK | JWT signed token | Token baru diberi expiry | FIXED |

## 6. Audit API

| No | Endpoint | Method | Auth | Validation | Response | Bug | Status |
|---|---|---|---|---|---|---|---|
| 1 | Server Action `loginAction` | POST | Public | username/password length, rate limit | Generic error | Tidak ada lockout persistent multi-instance | NEED REVIEW |
| 2 | Server Action `createTransaction` | POST | `ADMIN_KASIR` | Zod + checkout total | Safe error | OK | OK |
| 3 | Server Action `saveItem` | POST | `ADMIN_GUDANG` | Zod + unique kode | Safe error | OK | OK |
| 4 | Server Action `submitStockIn` | POST | `ADMIN_GUDANG` | Zod batch max 500 | Safe error | OK | OK |
| 5 | Server Action `createReturn` | POST | Kasir/Gudang | Zod + original transaction check | Safe error | OK | OK |
| 6 | Server Action `bayarInvoice` | POST | `ADMIN_KASIR` | Zod money/status | Safe error | Race condition possible under concurrent same invoice payment | NEED REVIEW |
| 7 | Server Action `deleteInvoice(s)` | POST | `ADMIN_KASIR` | ID validation added | Safe error | Previously missing validation | FIXED |
| 8 | Route `/logout` | POST | Session | N/A | Redirect login | GET returns 405 | OK |
| 9 | Route `/verify/[token]` | GET | Public signed token | JWT verify | notFound invalid | New tokens expire | FIXED |

## 7. Audit Database

| No | Table | Masalah | Dampak | Solusi | Status |
|---|---|---|---|---|---|
| 1 | `users` | Default seed password risk | Account takeover jika seed production salah | Production seed wajib env password | FIXED |
| 2 | `transaction_items` | Report margin N+1 | Laporan lambat | Query agregasi dioptimasi | FIXED |
| 3 | `invoices/payments` | Concurrent payment belum memakai conditional update/lock eksplisit | Double-submit edge case | Tambahkan optimistic lock atau transaction isolation strategy | NEED REVIEW |
| 4 | `activity_logs` | Clear all logs tersedia untuk admin | Audit trail bisa hilang | Pertimbangkan soft-delete/archive/export sebelum clear | NEED REVIEW |
| 5 | Prisma config | `package.json#prisma` deprecated | Warning Prisma 7 | Migrasi ke `prisma.config.ts` | NEED REVIEW |

## 8. Audit Responsive

| No | Halaman | Mobile | Tablet | Desktop | Masalah | Status |
|---|---|---|---|---|---|---|
| 1 | Dashboard | PASS | PASS | PASS | Tidak ada horizontal overflow | OK |
| 2 | Invoice | PASS | PASS | PASS | Mobile card view/table internal scroll | OK |
| 3 | Kasir | PASS | PASS | PASS | POS grid aman 320px sampai desktop | OK |
| 4 | Barang | PASS | PASS | PASS | Table internal scroll | OK |
| 5 | Stok | PASS | PASS | PASS | Table internal scroll | OK |
| 6 | Retur | PASS | PASS | PASS | Stepper tidak overflow | OK |
| 7 | Laporan | PASS | PASS | PASS | Chart/table responsive | OK |
| 8 | Pengguna/Log | PASS | PASS | PASS | Filter/modal aman | OK |

Browser production sweep:
`320, 360, 375, 390, 414, 430, 480, 768, 820, 834, 1024, 1112, 1180, 1194, 1280, 1440, 1536`.

Hasil: 153 kombinasi route/breakpoint dashboard role gudang PASS; `/kasir` role kasir PASS semua breakpoint; tidak ada horizontal document overflow dan tidak ada sample browser error.

## 9. Audit Report / Rekap

| No | Nama Report | Filter | Perhitungan | Export | PDF | Status |
|---|---|---|---|---|---|---|
| 1 | Ringkasan Laporan | Periode tanggal | Total omset/margin/piutang/aset | Excel tersedia | Print A4 tersedia | OK |
| 2 | Omset | Periode tanggal | Dari `TransactionItem.subtotal` | Excel tersedia | Print A4 tersedia | OK |
| 3 | Margin | Periode tanggal | Snapshot harga jual - harga beli | Excel tersedia | Print A4 tersedia | FIXED |
| 4 | Piutang Aging | Periode tanggal | Total - dibayar + bucket umur | Excel tersedia | Print A4 tersedia | OK |
| 5 | Stok/Aset | Snapshot kini | Stok akhir dari ledger + stok awal | Excel tersedia | Print A4 tersedia | OK |

## 10. Audit Invoice / PDF

Invoice A4 dan thermal memakai `.print-area` terisolasi di iframe melalui `src/lib/print.ts`, sehingga dark mode dan UI aplikasi tidak ikut tercetak. Preview A4 memakai ukuran fixed `210mm` dengan scroll wrapper. QR verification memakai signed JWT dan sekarang token baru memiliki expiry 180 hari. Area yang masih perlu manual QA fisik: hasil print dari printer thermal aktual dan margin PDF pada browser mobile spesifik perangkat.

## 11. Audit Security

STRIDE ringkas:
- Spoofing: session JWT ditandatangani HS256, secret production fail-closed minimal 32 karakter.
- Tampering: mutasi bisnis utama memakai Prisma transaction dan Zod validation.
- Repudiation: activity log tersedia, tetapi clear all logs masih perlu kebijakan archive.
- Information Disclosure: role kasir ditolak pada halaman gudang/admin; env tidak tracked.
- Denial of Service: login punya rate limit memory, tetapi belum distributed-store.
- Elevation of Privilege: role guard server-side aktif pada server actions dan page sensitif.

OWASP ringkas:
- A01 Broken Access Control: PASS spot-check role kasir ke `/pengguna`, `/laporan`, `/barang`, `/stok/masuk`.
- A03 Injection: Prisma ORM + Zod validation; tidak ditemukan raw query runtime. Script migrasi dev memakai raw unsafe dan harus tidak dipakai production.
- A05 Misconfiguration: headers diperkuat, `X-Powered-By` dimatikan.
- A06 Vulnerable Components: high fixed, moderate masih ada di `exceljs/uuid`.
- A07 Auth: rate limit ada, cookie HttpOnly/SameSite Lax; Secure tergantung `COOKIE_SECURE=true`.

## 12. Audit Performance

- Build shared JS: 102 kB first load shared.
- Rute terbesar: `/laporan` 21.9 kB route JS, first load 265 kB.
- Query report margin sudah dioptimasi dari N+1 menjadi satu query + agregasi in-memory.
- Stock balance memakai `unstable_cache` dengan tag `stock`.
- Rekomendasi berikutnya: tambah bundle analyzer dan target p75 LCP 2000ms, INP < 200ms, CLS < 0.1 pada mobile 4G; budget route auth-walled internal app 200 KB gzip per route.

## 13. File yang Diubah

| No | File | Jenis Perubahan | Alasan |
|---|---|---|---|
| 1 | `.gitignore` | Tambah ignore artifact/cache | GitHub readiness |
| 2 | `.env.example` | File baru | Dokumentasi env tanpa secret |
| 3 | `package.json` | Hapus dependency high risk tidak dipakai, tambah scripts | Dependency/security gate |
| 4 | `next.config.ts` | Matikan powered-by, tambah HSTS/security headers | Security hardening |
| 5 | `src/app/(app)/invoice/actions.ts` | Validasi ID/batch delete, validasi item, status partial | Backend validation/business logic |
| 6 | `src/lib/reports.ts` | Optimasi query margin | Performance report |
| 7 | `src/lib/invoiceVerify.ts` | Expiry token QR invoice | Security hardening |
| 8 | `prisma/seed.ts` | Production seed password guard | Auth/security |
| 9 | `prisma/seed-200.ts` | Production seed password guard | Auth/security |

## 14. File yang Direkomendasikan Dihapus

| No | File/Folder | Alasan | Aman Dihapus |
|---|---|---|---|
| 1 | `tmp/pdf-render-check/*.png` | Artifact QA PDF lama masih tracked | Ya, setelah dipastikan tidak jadi fixture resmi |
| 2 | `tsconfig.tsbuildinfo` | Cache TypeScript masih tracked | Ya |
| 3 | `index.js` | File kosong tidak terpakai | Ya, setelah konfirmasi bukan entry deployment |
| 4 | `build_output.log` | Log lokal | Ya, sudah ignored |

## 15. Command yang Dijalankan

```bash
npm run lint
npm run type-check
npm run test
npm run build
npm audit --audit-level=moderate --json
npx next build
```

Hasil command:
- `npm run lint`: PASS
- `npm run type-check`: PASS
- `npm run test`: PASS, 53 security validation checks lulus
- `npm run build`: PASS
- `npx next build`: PASS
- `npm audit --audit-level=moderate --json`: FAIL karena 2 moderate (`exceljs -> uuid`), 0 high, 0 critical

## 16. Rekomendasi Sebelum Production

1. Hapus/untrack artifact `tmp/pdf-render-check/*.png` dan `tsconfig.tsbuildinfo` sebelum push.
2. Set production env: `AUTH_SECRET`, `INVOICE_VERIFY_SECRET`, `DATABASE_URL`, `COOKIE_SECURE=true`, `NEXT_PUBLIC_APP_URL`, `SEED_DEFAULT_PASSWORD`.
3. Jalankan seed production hanya dengan password env kuat, lalu ganti/rotasi password admin awal.
4. Evaluasi pengganti/mitigasi `exceljs` atau tunggu rilis yang membawa `uuid >= 11.1.1`; jangan paksa downgrade tanpa regresi test export.
5. Tighten CSP dengan nonce/hash setelah semua inline runtime/style diketahui aman.
6. Tambah Playwright E2E permanen untuk login, CRUD barang, checkout kasir, pembayaran invoice, retur, report export, dan responsive smoke.
7. Migrasikan konfigurasi Prisma dari `package.json#prisma` ke `prisma.config.ts` sebelum Prisma 7.

## 17. Status Akhir

Project status:

- Aman untuk push ke GitHub: perlu cleanup tracked artifact lebih dulu.
- Aman untuk staging: ya.
- Aman untuk production: masih perlu final env/password rotation, dependency moderate decision, dan manual print QA.
- Masih perlu perbaikan: ya, level medium/low non-blocking.

Kesimpulan:
Tidak ada critical/high yang tersisa setelah perbaikan dependency, seed password, dan security header. Core application gate lulus (`lint`, `type-check`, `test`, `build`). Project layak masuk staging dan hampir siap production, dengan catatan cleanup repository dan keputusan dependency moderate dilakukan sebelum push/deploy final.

# CHANGE SUMMARY

## Fixed
- Removed unused vulnerable `next-pwa` dependency.
- Added standard `type-check` and `test` scripts.
- Added `.env.example`.
- Hardened Next security headers and disabled `X-Powered-By`.
- Validated invoice delete IDs and bounded batch delete.
- Optimized margin report query.
- Added expiry to new invoice verification tokens.
- Hardened production seed password handling.

## Improved
- Git ignore rules for build/cache/temp artifacts.
- Report performance for large transaction datasets.
- GitHub readiness documentation through env template.

## Need Review
- `exceljs -> uuid` moderate audit finding.
- Tracked temp/build artifacts currently in Git.
- CSP nonce/hash tightening.
- Persistent/distributed rate limiting and concurrent invoice payment locking.

## Not Fixed
- Moderate dependency advisory from `exceljs`.
- Historical tracked artifacts are not removed in this audit pass.
