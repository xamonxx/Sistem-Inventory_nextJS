---
type: roadmap
status: proposed
last_verified: 2026-10-12
related: ["[[Backlog]]", "[[Performance-Notes]]", "[[Security-Notes]]"]
tags: [roadmap, improvements]
---
# Improvements

Proposal belum disetujui:

1. Buat helper page authorization per domain agar navigation dan direct URL memiliki policy sama.
2. Ubah logout menjadi POST-only dan gunakan `isSameOriginRequest` yang sama dengan route handler lain.
3. Pindahkan rate limit ke shared store jika deploy menjadi multi-instance.
4. Hilangkan `'unsafe-eval'` production CSP bila runtime/dependency sudah kompatibel.
5. Tambahkan migration history; CI menjalankan `prisma migrate deploy` sebelum cutover terkontrol.
6. Tambahkan database disposable untuk integration test transaksi Serializable.
7. Batch/parallel query dashboard yang independen dan hilangkan query report berulang.
8. Pertimbangkan FK atau registry type-safe untuk reference polymorphic ledger.

Setiap item perlu keputusan dan smoke/regression proof sebelum implementasi.
