# Architecture Context

```text
Browser
  -> Next.js App Router server/client components
  -> Server Actions (main writes) / Route Handlers (search, notifications, logout)
  -> domain helpers in src/lib
  -> Prisma Client
  -> MySQL
```

Root `(app)/layout.tsx` requires a valid session and provides Sidebar/Topbar. Role-aware navigation is not a complete authorization boundary. Client state uses local React state plus Zustand for POS and non-gudang carts.

Caching: stock 60s tag `stock`; dashboard 30s. Mutations revalidate paths/tags. Browser polls notifications every 60s. There is no middleware, service layer directory, queue, worker, or server scheduler.

Deep references:
- [`System Architecture`](../../docs/obsidian-vault/01-ARCHITECTURE/System-Architecture.md)
- [`Frontend Architecture`](../../docs/obsidian-vault/01-ARCHITECTURE/Frontend-Architecture.md)
- [`Backend Architecture`](../../docs/obsidian-vault/01-ARCHITECTURE/Backend-Architecture.md)
- [`System Graph`](../../docs/obsidian-vault/07-KNOWLEDGE-GRAPH/System-Graph.md)
