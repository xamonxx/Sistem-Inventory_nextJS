---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/app/api/search/route.ts, src/app/api/notifications/route.ts, src/components/CommandPaletteActions.ts, src/components/NotificationActions.ts]
related: ["[[Search-Endpoint]]", "[[Notifications-Endpoint]]", "[[Authorization]]"]
tags: [module, api]
---
# Search and Notifications

## Search
Command palette memanggil `GET /api/search?q=...`. Hasil di-scope berdasarkan role: non-gudang mencari model Ng; gudang/kasir mencari invoice/client/project, dan item hanya untuk Gudang.

## Notifications
Browser polling `GET /api/notifications` setiap 60 detik. Sejak 2026-10-12 notifikasi hanya berisi peringatan stok minus/menipis untuk Gudang; Kasir dan Non-Gudang tidak melakukan fetch/polling sama sekali (client `NotificationCenter` memeriksa `role === "ADMIN_GUDANG"`); endpoint tetap mengembalikan array kosong bila dipanggil. Activity log tidak lagi dipolling lewat notifikasi; lihat halaman Log Aktivitas.

## Security
Kedua route memeriksa same-origin dan session. Action internal melakukan session check lagi. Tidak ada persistence untuk status read/dismissed; daftar dihitung saat request.
