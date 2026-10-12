---
type: database-table
status: verified
last_verified: 2026-10-12
source_files: [prisma/schema.prisma, src/lib/counters.ts]
related: ["[[POS-Transactions]]", "[[Returns-and-Exchanges]]", "[[Non-Warehouse-Orders-and-Invoices]]"]
tags: [database, counter]
---
# Counter Table

`counters` memakai string `id`, prefix, dan integer value. `nextDocNumber` melakukan upsert/increment dalam Prisma transaction.

| ID | Format |
|---|---|
| `transaksi` | `PC` + 5 digit |
| `return` | `RET-` + 5 digit |
| `invoice` | `INV-` + 5 digit |
| `ng_invoice` | `NG-` + 5 digit |

Invariant: fungsi harus dipanggil di dalam `prisma.$transaction` agar increment dan dokumen tetap satu atomic unit.
