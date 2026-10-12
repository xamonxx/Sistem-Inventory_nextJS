---
type: endpoint
status: verified
last_verified: 2026-10-12
source_files: [src/app/api/search/route.ts, src/components/CommandPaletteActions.ts]
related: ["[[Search-and-Notifications]]", "[[Authorization]]"]
tags: [api, search]
---
# Search Endpoint

`GET /api/search?q={query}`

## Guards
1. `isSameOriginRequest` memeriksa Origin/Referer bila tersedia.
2. `getSession` wajib menghasilkan user aktif.
3. Query Zod: trim, 1–80 karakter.

## Response
`{ results: SearchResult[] }`, setiap result memiliki `id`, `type`, `title`, `subtitle`, `link`.

## Scope role
- `ADMIN_NONGUDANG`: `NgProduk`, `NgInvoice`, `NgKonsumen`.
- `ADMIN_GUDANG`: Item, Invoice, Client, Project.
- `ADMIN_KASIR`: Invoice, Client, Project; Item dikecualikan untuk menghindari link terlarang.

Error: 403 cross-origin, 401 tanpa session. Query invalid menghasilkan array kosong dari action.
