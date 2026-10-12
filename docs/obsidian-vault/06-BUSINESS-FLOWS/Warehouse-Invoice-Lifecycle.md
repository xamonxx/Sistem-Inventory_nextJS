---
type: business-flow
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/invoice/actions.ts, prisma/schema.prisma]
related: ["[[Warehouse-Invoices-and-Receivables]]", "[[POS-Checkout-Flow]]", "[[Return-and-Exchange-Flow]]"]
tags: [flow, invoice]
---
# Warehouse Invoice Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: totalDibayar = 0
    [*] --> PARTIAL: 0 < totalDibayar < total
    [*] --> LUNAS: totalDibayar >= total
    PENDING --> PARTIAL: payment < balance
    PENDING --> LUNAS: payment covers balance
    PARTIAL --> PARTIAL: additional partial payment
    PARTIAL --> LUNAS: balance paid
    LUNAS --> [*]
```

`DRAFT` ada dalam enum tetapi tidak ditemukan pada action penciptaan aktif. Payment di-clamp ke sisa. Edit line dapat mengubah total dan status, tetapi total baru tidak boleh di bawah totalDibayar. Delete dapat menghapus seluruh graph transaction/return/ledger/payment yang menjadi sumber invoice.
