---
type: module
status: verified
last_verified: 2026-10-12
source_files: [src/lib/auth.ts, src/app/login/actions.ts, src/app/(app)/layout.tsx]
related: ["[[Authentication]]", "[[Authorization]]", "[[Login-and-Session-Flow]]"]
tags: [module, auth]
---
# Authentication and Access

## Tujuan
Menyediakan login, session JWT, verifikasi user aktif, guard halaman, dan guard role untuk mutasi.

## Komponen
- `loginAction`: validasi, rate limit, bcrypt, `createSession`.
- `getSession`: verifikasi JWT dan re-check `User.aktif` serta role dari DB.
- `requireUser`: redirect jika tidak login.
- `requireRole`: redirect/throw jika role tidak diizinkan.
- `AppLayout`: melindungi route group `(app)`.

## Data
Menggunakan `User` dan cookie `si_session`. Aktivitas administrasi akun dicatat ke `ActivityLog`.

## Dampak perubahan
Perubahan payload JWT atau enum `Role` harus disinkronkan dengan `VALID_ROLES`, skema Prisma, Sidebar, FloatingActionButton, page guards, dan seluruh pemanggil `requireRole`.
