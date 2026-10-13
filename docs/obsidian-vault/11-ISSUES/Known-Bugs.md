---
type: issue-register
status: verified
last_verified: 2026-10-13
related: ["[[Technical-Debt]]", "[[Resolved-Issues]]", "[[Pre-Production-Bug-Audit-and-Plan]]"]
tags: [issues, bugs]
---
# Known Bugs

## KB-001 — Turbopack development startup on Windows
- **Observed:** development run pernah gagal dengan `ENOENT` saat menulis `.next/static/development/_buildManifest.js.tmp.*`.
- **Scope:** local development pada workstation Windows saat observasi.
- **Root cause:** belum diverifikasi; jangan menganggap source aplikasi sebagai penyebab.
- **Workaround aman:** hentikan proses dev lain, hapus `.next` hanya setelah memastikan itu generated output, lalu jalankan ulang. Gunakan non-Turbopack hanya untuk diagnosis, bukan perubahan permanen tanpa bukti.
- **Status:** open/unreproduced in this documentation pass.

## KB-002 — Type-check hasil checkout POS
- **Observed:** `npm run type-check` pernah gagal pada `src/app/(app)/kasir/KasirClient.tsx:385`.
- **Resolution:** consumer sekarang memakai `res.grandTotal ?? 0`; producer selalu mengembalikan angka pada hasil sukses.
- **Verification:** type-check, lint, production build, dan checkout nyata pada database disposable lulus pada 2026-10-12.
- **Status:** resolved.

## KB-003 — Struk split payment hanya menghitung cash
- **Observed:** transaksi `PC00003` menyimpan `CASH 30.000 + TRANSFER 50.000 + CREDIT 20.000` dan invoice LUNAS, tetapi struk menampilkan `Pembayaran Masuk Rp30.000` dan `Sisa Tagihan Rp70.000`.
- **Impact:** struk salah menyatakan pembayaran dan piutang walaupun persistence benar.
- **Status:** open; release blocker untuk struk multi-metode.

## KB-004 — Struk transfer lunas masih menampilkan sisa penuh
- **Observed:** transaksi proyek `PC00004` menyimpan transfer Rp100.000 dan invoice LUNAS, tetapi struk menampilkan `Sisa Tagihan Rp100.000`.
- **Impact:** pelanggan menerima informasi piutang yang salah pada transaksi transfer.
- **Status:** open; kemungkinan akar yang sama dengan KB-003.
- **Evidence:** [[Comprehensive-Role-Verification-Checkpoint]].

## KB-005 — Losing concurrent checkout reports a generic internal error
- **Observed:** two simultaneous checkouts targeted the final unit of `E2E-ITEM-B`. One persisted and reduced effective stock to zero; the losing request displayed `Terjadi kesalahan internal saat memproses checkout.`
- **Impact:** stock integrity is preserved, but the cashier receives no actionable stock-conflict message.
- **Status:** open; not an integrity blocker, but should return the existing insufficient-stock/conflict language.
- **Evidence:** [[Comprehensive-Role-Verification-Checkpoint]].

## KB-006 — Cetak ulang invoice thermal mengabaikan pembayaran tersimpan
- **Observed in source:** jalur `InvoiceClient` dan `/invoice/[id]` mengirim total ke `Nota` tanpa `bayar`/`sisaTagihan`; `Nota` lalu menganggap pembayaran masuk nol.
- **Impact:** invoice PARTIAL/LUNAS dapat dicetak sebagai belum lunas pada format thermal.
- **Status:** open; satu keluarga akar masalah dengan KB-003/KB-004 dan release blocker.
- **Evidence:** [[Pre-Production-Bug-Audit-and-Plan]].

## KB-007 — Mutasi committed dapat dilaporkan gagal
- **Observed in source:** checkout/payment commit lebih dulu, lalu audit log, cache invalidation, atau URL verifikasi dijalankan dalam outer `try`; kegagalan helper dikembalikan sebagai error aksi.
- **Impact:** operator dapat retry transaksi yang sebenarnya sudah tersimpan dan membuat duplikasi.
- **Status:** open; release blocker sampai outcome atomik/idempotent.
- **Evidence:** [[Pre-Production-Bug-Audit-and-Plan]].

Drift konfigurasi dan coverage gap bukan bug runtime; lihat [[Technical-Debt]].
