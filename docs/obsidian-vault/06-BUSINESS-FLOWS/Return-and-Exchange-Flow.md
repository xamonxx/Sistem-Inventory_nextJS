---
type: business-flow
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/retur/actions.ts, src/lib/returnRules.ts]
related: ["[[Returns-and-Exchanges]]", "[[Warehouse-Invoice-Lifecycle]]"]
tags: [flow, return]
---
# Return and Exchange Flow

```mermaid
flowchart TD
    Q[Search invoice or transaction] --> T[Load original TransactionItems]
    T --> V[Validate item, snapshot price, remaining return qty]
    V --> R{Type}
    R -->|RETUR| IN[Ledger RETUR plus qty]
    R -->|TUKAR| S[Validate replacement stock]
    S --> IN
    S --> OUT[Ledger KELUAR replacement]
    IN --> CR[Create Return and ReturnItems]
    OUT --> CR
    CR --> D[selisih = replacement - return]
    D -->|positive| I[Create PENDING Invoice]
    D -->|zero or negative| N[No invoice]
```

Semua write berada dalam transaksi Serializable. Cumulative return qty dihitung dari `ReturnItem` terdahulu. Pairing tukar bersifat berdasarkan index dan jumlah baris harus sama.
