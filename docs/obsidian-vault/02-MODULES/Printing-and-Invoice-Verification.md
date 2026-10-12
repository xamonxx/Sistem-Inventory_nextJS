---
type: module
status: verified
last_verified: 2026-10-12
source_files:
  - src/lib/print.ts
  - src/lib/invoiceVerify.ts
  - "src/app/verify/[noInvoice]/page.tsx"
  - src/components/InvoiceDocument.tsx
related: ["[[Public-Invoice-Verification-Flow]]", "[[Warehouse-Invoices-and-Receivables]]", "[[Security-Notes]]"]
tags: [module, print, verification]
---
# Printing and Invoice Verification

## Print
`printArea` menyalin `.print-area` ke iframe terisolasi lalu memanggil print untuk menghindari browser mobile mencetak seluruh UI. `setPdfTitle` membuat nama file PDF sementara.

## Verification
Invoice QR/link memakai JWT HS256 khusus dengan purpose `invoice_verify`, nomor invoice, dan expiry 180 hari. Secret verifikasi terpisah dari auth dan minimal 32 karakter di production. Halaman `/verify/[token]` force-dynamic, membaca invoice, menghitung sisa/lunas, dan mencatat verifikasi pertama ke `ActivityLog`.

## Integrasi eksternal
Client invoice/retur dapat membuka `https://wa.me/...` untuk berbagi; tidak ditemukan API WhatsApp server-side.
