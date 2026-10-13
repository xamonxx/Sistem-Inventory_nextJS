---
type: issue-register
status: verified
last_verified: 2026-10-13
related: ["[[Technical-Debt]]", "[[Resolved-Issues]]", "[[Pre-Production-Bug-Audit-and-Plan]]", "[[ADR-004-Credit-Is-Unpaid-Receivable]]"]
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
- **Resolution (2026-10-13):** CREDIT kini piutang tempo belum dibayar ([[ADR-004-Credit-Is-Unpaid-Receivable]]); checkout hanya menyimpan CASH/TRANSFER sebagai Payment dan struk memakai `totalDibayar`/sisa dari server.
- **Verification:** checkout lokal `PC00102` (tunai 30.000 + transfer 50.000 + tempo 75.000) menyimpan dua Payment, invoice `INV-00063` PARTIAL dibayar 80.000; struk, `/invoice/[id]`, dan pratinjau thermal menampilkan dibayar 80.000 / sisa 75.000.
- **Status:** resolved in source; production data dengan baris Payment CREDIT lama belum diperiksa.

## KB-004 — Struk transfer lunas masih menampilkan sisa penuh
- **Observed:** transaksi proyek `PC00004` menyimpan transfer Rp100.000 dan invoice LUNAS, tetapi struk menampilkan `Sisa Tagihan Rp100.000`.
- **Impact:** pelanggan menerima informasi piutang yang salah pada transaksi transfer.
- **Resolution (2026-10-13):** struk Kasir memakai `totalDibayar` dari server, bukan uang tunai saja.
- **Verification:** checkout lokal transfer penuh `PC00103` menyimpan invoice `INV-00064` LUNAS; struk dan cetak ulang menampilkan pembayaran 26.500 tanpa sisa tagihan.
- **Status:** resolved.
- **Evidence:** [[Comprehensive-Role-Verification-Checkpoint]].

## KB-005 — Losing concurrent checkout reports a generic internal error
- **Observed:** two simultaneous checkouts targeted the final unit of `E2E-ITEM-B`. One persisted and reduced effective stock to zero; the losing request displayed `Terjadi kesalahan internal saat memproses checkout.`
- **Impact:** stock integrity is preserved, but the cashier receives no actionable stock-conflict message.
- **Status:** open; not an integrity blocker, but should return the existing insufficient-stock/conflict language.
- **Evidence:** [[Comprehensive-Role-Verification-Checkpoint]].

## KB-006 — Cetak ulang invoice thermal mengabaikan pembayaran tersimpan
- **Observed in source:** jalur `InvoiceClient` dan `/invoice/[id]` mengirim total ke `Nota` tanpa `bayar`/`sisaTagihan`; `Nota` lalu menganggap pembayaran masuk nol.
- **Impact:** invoice PARTIAL/LUNAS dapat dicetak sebagai belum lunas pada format thermal.
- **Resolution (2026-10-13):** kedua jalur kini mengirim `bayar = totalDibayar` dan `sisaTagihan`; status `Nota` dihitung dari angka, bukan teks catatan.
- **Status:** resolved; diverifikasi pada `/invoice/1800`, `/invoice/1801`, dan pratinjau thermal daftar invoice.
- **Evidence:** [[Pre-Production-Bug-Audit-and-Plan]].

## KB-007 — Mutasi committed dapat dilaporkan gagal
- **Observed in source:** checkout/payment commit lebih dulu, lalu audit log, cache invalidation, atau URL verifikasi dijalankan dalam outer `try`; kegagalan helper dikembalikan sebagai error aksi.
- **Impact:** operator dapat retry transaksi yang sebenarnya sudah tersimpan dan membuat duplikasi.
- **Resolution (2026-10-13):** audit log ditulis di dalam transaksi; invalidasi cache dan URL verifikasi bersifat best-effort setelah commit; checkout, bayar invoice, retur, invoice NG, dan bayar NG memakai idempotency key sehingga retry mengembalikan hasil tersimpan.
- **Verification:** `npm run test:idempotency` 6/6; checkout browser `PC00104` dengan respons pertama sengaja dibuang lalu di-retry tetap menghasilkan satu transaksi, satu pembayaran, satu log.
- **Status:** resolved in source; production wajib membuat tabel `idempotency_keys` sebelum deploy ([[Idempotency-Schema-Rollout]]).
- **Evidence:** [[Pre-Production-Bug-Audit-and-Plan]].

Drift konfigurasi dan coverage gap bukan bug runtime; lihat [[Technical-Debt]].
