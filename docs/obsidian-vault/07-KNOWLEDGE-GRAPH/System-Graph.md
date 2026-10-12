---
type: knowledge-graph
status: verified
last_verified: 2026-10-12
related: ["[[System-Architecture]]", "[[Module-Graph]]", "[[Database-Graph]]"]
tags: [graph, architecture]
---
# System Graph

```mermaid
flowchart LR
    AUTH[Authentication and Access]
    G[Gudang and Retail]
    NG[Non-Gudang Trading]
    P[Platform UI/API]
    DB[(MySQL via Prisma)]
    EXT[WhatsApp Web and Browser Print]
    AUTH --> G
    AUTH --> NG
    AUTH --> P
    G --> DB
    NG --> DB
    P --> DB
    G --> EXT
    NG --> EXT
```

## Native graph anchors
- Auth: [[Authentication-and-Access]], [[Authentication]], [[Authorization]]
- Gudang: [[Item-Master]], [[Stock-Ledger]], [[POS-Transactions]], [[Returns-and-Exchanges]], [[Warehouse-Invoices-and-Receivables]]
- Non-gudang: [[Non-Warehouse-Catalog]], [[Non-Warehouse-Consumers]], [[Non-Warehouse-Orders-and-Invoices]]
- Platform: [[Search-and-Notifications]], [[Printing-and-Invoice-Verification]]
