---
type: engineering
status: verified
last_verified: 2026-10-12
source_files: [src/lib/auth.ts, src/lib/requestGuards.ts, next.config.ts, scripts/security-test.ts]
related: ["[[Authentication]]", "[[Authorization]]", "[[Risks]]"]
tags: [engineering, security]
---
# Security Notes

## Kontrol aktif
- bcrypt password hashing; JWT HS256; HTTP-only SameSite Lax cookie.
- Secret production minimum 32 karakter untuk auth dan invoice verification.
- Session memvalidasi user aktif dan role dari DB.
- Zod/allowlist server-side; Prisma parameterization.
- Same-origin check pada search/notifications.
- CSP, frame deny, nosniff, referrer, permissions policy, dan HSTS header dari `next.config.ts`.
- Role guard pada mutasi kritis.

## Temuan hardening
1. Beberapa read page hanya auth-only, sehingga boundary domain role tidak konsisten. Bukti: `invoice/[id]/page.tsx`, `stok/[id]/page.tsx`, `retur/page.tsx`.
2. `GET /logout` melakukan side effect tanpa same-origin check.
3. `POST /logout` memakai substring `origin.includes(host)`, lebih lemah dari helper URL-aware `isSameOriginRequest`.
4. Login rate limit in-memory tidak efektif lintas instance/restart.
5. CSP mengizinkan `'unsafe-inline'` dan `'unsafe-eval'` untuk script.
6. Public verification token adalah capability 180 hari; kebocoran link memberi akses status invoice sampai expiry.
7. `TRUST_PROXY_HEADERS=true` hanya aman di belakang proxy yang membersihkan header client.

Tidak ada endpoint upload web yang ditemukan.
