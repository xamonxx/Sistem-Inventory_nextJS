---
type: knowledge-graph
status: verified
last_verified: 2026-10-12
related: ["[[System-Graph]]", "[[Dependency-Graph]]"]
tags: [graph, modules]
---
# Module Graph

## Gudang
```mermaid
flowchart LR
    IM[Item Master] --> ST[Stock Ledger]
    ST --> POS[POS]
    POS --> INV[Invoices]
    POS --> RET[Returns]
    RET --> ST
    RET --> INV
    POS --> REP[Dashboard and Reports]
    INV --> REP
    ST --> REP
    ADM[Users and Activity] --> POS
    ADM --> ST
```

## Non-gudang
```mermaid
flowchart LR
    CAT[Catalog] --> CO[Orders and Invoices]
    CON[Consumers] --> CO
    CO --> PAY[Payments]
    CO --> REP[Reports and Purchases]
    PAY --> REP
```

Wikilinks: [[Item-Master]], [[Stock-Ledger]], [[POS-Transactions]], [[Returns-and-Exchanges]], [[Warehouse-Invoices-and-Receivables]], [[Non-Warehouse-Catalog]], [[Non-Warehouse-Consumers]], [[Non-Warehouse-Orders-and-Invoices]].
