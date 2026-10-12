---
type: business-flow
status: verified
last_verified: 2026-10-12
source_files: [src/app/(app)/laporan/page.tsx, src/lib/reports.ts]
related: ["[[Warehouse-Dashboard-and-Reporting]]", "[[Performance-Notes]]"]
tags: [flow, reporting]
---
# Warehouse Reporting Flow

```mermaid
flowchart LR
    Q[Route query from/to/label] --> P[Parse inclusive date range]
    P --> M[laporanMargin]
    P --> B[barangTerlaris]
    P --> R[laporanPiutang]
    S[Current snapshot] --> ST[laporanStok]
    M --> UI[LaporanClient]
    B --> UI
    R --> UI
    ST --> UI
    UI --> E[Client-side Excel/PDF export]
```

Margin memakai harga jual dan harga beli snapshot dari `TransactionItem`. Piutang memakai `Invoice.total - totalDibayar`. Stok tidak historis dan tidak mengikuti date range.
