---
type: business-flow
status: verified
last_verified: 2026-10-12
source_files:
  - src/lib/invoiceVerify.ts
  - "src/app/verify/[noInvoice]/page.tsx"
related: ["[[Printing-and-Invoice-Verification]]", "[[Security-Notes]]"]
tags: [flow, verification]
---
# Public Invoice Verification Flow

```mermaid
sequenceDiagram
    participant I as Invoice/QR
    participant P as Public verify page
    participant J as JWT verifier
    participant DB as Prisma
    I->>P: GET /verify/{token}
    P->>J: verify HS256, purpose, expiry
    alt invalid
      P-->>I: 404
    else valid
      J-->>P: noInvoice
      P->>DB: find Invoice
      P->>DB: count previous verification
      opt first verification
        P->>DB: create ActivityLog
      end
      P-->>I: status, total, paid, balance
    end
```

Token berlaku 180 hari. Halaman tidak memerlukan session karena token adalah capability. IP/user-agent hanya masuk detail activity pada verifikasi pertama; jangan dokumentasikan nilainya.
