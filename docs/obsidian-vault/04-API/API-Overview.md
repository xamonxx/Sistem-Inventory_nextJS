---
type: api-index
status: verified
last_verified: 2026-10-12
source_files: [src/app/api/search/route.ts, src/app/api/notifications/route.ts, src/app/(app)/logout/route.ts]
related: ["[[Backend-Architecture]]", "[[Gudang-Server-Actions]]", "[[Non-Gudang-Server-Actions]]"]
tags: [api]
---
# API Overview

## HTTP Route Handlers
- [[Search-Endpoint]] — `GET /api/search`
- [[Notifications-Endpoint]] — `GET /api/notifications`
- [[Logout-Endpoint]] — `GET|POST /logout`

## Server Actions
- [[Authentication-Server-Actions]]
- [[Gudang-Server-Actions]]
- [[Non-Gudang-Server-Actions]]

Aplikasi tidak menyediakan REST CRUD lengkap. Mayoritas mutasi berjalan melalui Next.js Server Actions yang dipanggil Client Components. Semua payload client tetap dianggap tidak tepercaya dan divalidasi di server.
