---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/pengguna/actions.ts, src/app/(app)/log-aktivitas/actions.ts, src/lib/activity.ts]
related: ["[[Authentication-and-Access]]", "[[Identity-and-Audit-Tables]]", "[[Authorization]]"]
tags: [module, administration]
---
# User and Activity Administration

## User administration
`ADMIN_GUDANG` dapat membuat/mengedit akun, toggle aktif, dan reset password. Username allowlist; password di-hash bcrypt cost 10. Guard mencegah admin menurunkan role atau menonaktifkan dirinya sendiri.

## Constraint
Form action hanya mengizinkan role `ADMIN_KASIR` dan `ADMIN_GUDANG`, meskipun schema dan auth mengenal `ADMIN_NONGUDANG`. Provisioning role non-gudang harus berasal dari seed/DB atau perubahan code.

## Activity log
`logActivity` menyimpan aksi, entitas, ID, detail JSON, user, dan waktu. Halaman log menampilkan 200 terbaru. `clearActivityLogs` menghapus semua log lalu menulis event `CLEAR_LOGS` baru.

## Dampak
Audit log bukan append-only karena admin gudang dapat membersihkannya.
