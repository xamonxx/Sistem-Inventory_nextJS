---
type: knowledge-graph
status: verified
last_verified: 2026-10-12
source_files: [package.json, src/lib]
related: ["[[Backend-Architecture]]", "[[Frontend-Architecture]]", "[[Technical-Debt]]"]
tags: [graph, dependencies]
---
# Dependency Graph

```mermaid
flowchart LR
    NEXT[Next.js App Router] --> REACT[React 19]
    NEXT --> PRISMA[Prisma Client]
    PRISMA --> MYSQL[(MySQL)]
    AUTH[jose + bcryptjs] --> NEXT
    ZOD[Zod] --> ACTIONS[Server Actions]
    ZUSTAND[Zustand] --> CLIENT[POS and NG Clients]
    TAILWIND[Tailwind CSS 4] --> UI[Shared UI]
    RECHARTS[Recharts] --> REPORTS[Charts]
    EXCEL[ExcelJS] --> EXPORTS[Excel exports]
    MOTION[Framer Motion] --> UI
```

## Tidak ditemukan dipakai di `src`
`@tanstack/react-query`, `@tanstack/react-table`, dan `react-hook-form` tercantum di manifest tetapi pencarian symbol/import tidak menemukan usage. Jangan hapus tanpa build/audit package menyeluruh; catat di [[Technical-Debt]].
