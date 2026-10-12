---
type: endpoint
status: verified
last_verified: 2026-10-12
source_files: [src/app/api/notifications/route.ts, src/components/NotificationActions.ts, src/components/NotificationCenter.tsx]
related: ["[[Search-and-Notifications]]", "[[Stock-Ledger]]"]
tags: [api, notifications]
---
# Notifications Endpoint

`GET /api/notifications`

## Guards
Same-origin lalu active session. Internal `fetchSystemNotifications` juga memanggil `requireUser`.

## Data
- Gudang: item aktif + stok cached untuk notifikasi minus/low stock.
- Kasir dan Non-gudang: array kosong, tanpa query database. Client tidak memanggil endpoint ini untuk role tersebut (tanpa polling).
- Activity log dihapus dari notifikasi (2026-10-12) agar polling 60 detik tidak membaca `ActivityLog`; riwayat tetap di `/log-aktivitas`.

## Response
`{ notifications: SystemNotification[] }`. Kegagalan query internal dicatat ke server console dan menghasilkan array kosong.

Client polling setiap 60 detik. Dismiss disimpan per-browser di `localStorage` (`si_dismissed_notifications`); tidak ada state read/dismiss di server.

## UI (`NotificationCenter`, redesain 2026-10-12)
- Satu bagian **Perlu Tindakan** (severity `danger`/`warning`).
- Deskripsi stok (`- Nama -> sisa N (min: M)` / `- Nama -> N unit`) di-parse di client menjadi baris terstruktur dengan rasio stok/min. Format teks dari `fetchSystemNotifications` adalah kontrak tampilan: jika diubah, `parseStockText` jatuh ke teks biasa.
- Daftar penuh (expand) dibatasi `max-h-80` dengan scroll; tombol aksi dan tutup minimal 36px.
