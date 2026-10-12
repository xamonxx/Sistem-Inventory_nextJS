---
type: endpoint
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/logout/route.ts, src/lib/auth.ts]
related: ["[[Authentication]]", "[[Security-Notes]]"]
tags: [api, auth]
---
# Logout Endpoint

- `POST /logout`: jika Origin dan Host tersedia, menolak ketika Origin tidak mengandung Host; kemudian menghapus cookie session.
- `GET /logout`: menghapus cookie tanpa same-origin check.
- Response: status 303 dengan `Location: /login`.

`logoutAction` di `src/app/login/actions.ts` menyediakan jalur Server Action alternatif.

Catatan: side effect pada GET dan penggunaan `origin.includes(host)` adalah risiko hardening; lihat [[Security-Notes]].
