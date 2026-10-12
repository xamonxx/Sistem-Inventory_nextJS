---
type: architecture
status: verified
last_verified: 2026-10-12
source_files:
  - src/lib/auth.ts
  - src/app/login/actions.ts
  - src/app/(app)/layout.tsx
related: ["[[Authentication-and-Access]]", "[[Authorization]]", "[[Login-and-Session-Flow]]"]
tags: [security, authentication]
---
# Authentication

## Mekanisme
- Login mencari `User.username`, membandingkan bcrypt, dan menolak user nonaktif.
- Session adalah JWT HS256 dengan masa berlaku 7 hari dalam cookie `si_session`.
- Cookie: HTTP-only, SameSite Lax, path `/`; Secure hanya ketika production dan `COOKIE_SECURE=true`.
- `getSession` memverifikasi signature, bentuk payload, role allowlist, lalu membaca user aktif dari database pada setiap validasi.
- Produksi gagal tertutup jika `AUTH_SECRET` kosong atau kurang dari 32 karakter.

## Proteksi login
Zod membatasi input, pesan error tidak membedakan user tidak ada/password salah, bcrypt dummy mengurangi timing enumeration, dan rate limit in-memory menetapkan 8 percobaan per 5 menit per key.

## Keterbatasan
Rate limit tidak dibagi antar-instance dan hilang saat restart. Logout `GET` masih menghapus session; `POST` melakukan pemeriksaan Origin/Host sederhana. Lihat [[Security-Notes]].
