---
type: architecture
status: verified
last_verified: 2026-10-12
source_files:
  - src/app/(app)/kasir/page.tsx
  - src/app/(app)/kasir/KasirClient.tsx
  - src/app/(app)/kasir/actions.ts
related: ["[[POS-Checkout-Flow]]", "[[System-Architecture]]"]
tags: [data-flow]
---
# Data Flow

## Read path
```mermaid
sequenceDiagram
    participant U as User
    participant P as Server Page
    participant A as Auth
    participant D as Prisma/MySQL
    participant C as Client Component
    U->>P: GET route
    P->>A: requireUser/getSession
    A->>D: validate active user
    P->>D: selective query/aggregation
    P-->>C: serializable props
    C-->>U: interactive UI
```

## Mutation path
```mermaid
sequenceDiagram
    participant C as Client Component
    participant S as Server Action
    participant A as Auth/Role Guard
    participant V as Zod/Domain Rules
    participant D as Prisma Transaction
    participant L as ActivityLog
    C->>S: typed payload or FormData
    S->>A: requireRole
    S->>V: parse and verify invariants
    S->>D: atomic reads and writes
    D-->>S: committed result
    S->>L: audit event
    S-->>C: result object
```

## Cache
Stok akhir menggunakan `unstable_cache` selama 60 detik dengan tag `stock`. Mutasi yang memengaruhi stok memanggil `revalidateTag("stock")` dan beberapa `revalidatePath`. Dashboard gudang menetapkan `revalidate = 30`.
