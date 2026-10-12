---
type: issue-register
status: verified
last_verified: 2026-10-12
related: ["[[Technical-Debt]]", "[[Resolved-Issues]]"]
tags: [issues, bugs]
---
# Known Bugs

## KB-001 — Turbopack development startup on Windows
- **Observed:** development run pernah gagal dengan `ENOENT` saat menulis `.next/static/development/_buildManifest.js.tmp.*`.
- **Scope:** local development pada workstation Windows saat observasi.
- **Root cause:** belum diverifikasi; jangan menganggap source aplikasi sebagai penyebab.
- **Workaround aman:** hentikan proses dev lain, hapus `.next` hanya setelah memastikan itu generated output, lalu jalankan ulang. Gunakan non-Turbopack hanya untuk diagnosis, bukan perubahan permanen tanpa bukti.
- **Status:** open/unreproduced in this documentation pass.

## KB-002 — Type-check gagal pada hasil checkout POS
- **Observed:** `npm run type-check` gagal pada `src/app/(app)/kasir/KasirClient.tsx:385`.
- **Error:** `res.grandTotal` bertipe `number | undefined`, sedangkan `NotaData.total` membutuhkan `number`.
- **Context:** terdeteksi setelah source drift eksternal menambahkan filter kategori/penyesuaian UI selama validasi knowledge system.
- **Impact:** build gate TypeScript tidak lulus; runtime path belum diuji pada sesi dokumentasi ini.
- **Status:** open; source aplikasi sengaja tidak diubah oleh fase dokumentasi.

Drift konfigurasi dan coverage gap bukan bug runtime; lihat [[Technical-Debt]].
