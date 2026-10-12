---
type: business-flow
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/non-gudang/invoice/actions.ts, prisma/schema.prisma]
related: ["[[Non-Warehouse-Orders-and-Invoices]]", "[[Non-Warehouse-Order-Flow]]"]
tags: [flow, non-gudang, invoice]
---
# Non-Warehouse Invoice Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: TEMPO / unpaid
    [*] --> LUNAS: paid at creation
    PENDING --> PARTIAL: first partial payment
    PENDING --> LUNAS: payment covers balance
    PARTIAL --> PARTIAL: partial payment
    PARTIAL --> LUNAS: balance paid
    LUNAS --> [*]
```

Pembayaran menggunakan transaksi Serializable dan anti-overpay. Edit mempertahankan payment history, menghitung ulang snapshots dan margin, serta menolak total penjualan di bawah total dibayar. Jatuh tempo null saat lunas; jika belum lunas, nilai lama dipertahankan atau dibuat +7 hari.
