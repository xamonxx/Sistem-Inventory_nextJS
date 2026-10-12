---
type: module
status: verified
last_verified: 2026-10-13
source_files:
  - src/app/(app)/invoice/page.tsx
  - src/app/(app)/invoice/actions.ts
  - "src/app/(app)/invoice/edit/[id]/page.tsx"
related: ["[[Warehouse-Invoice-Lifecycle]]", "[[POS-Transactions]]", "[[Returns-and-Exchanges]]"]
tags: [module, invoice]
---
# Warehouse Invoices and Receivables

## Sumber invoice
Invoice dapat tertaut ke `Transaction` POS atau `Return` dengan selisih positif. Total dibayar disimpan pada invoice dan detail pembayaran pada `Payment`.

## Lifecycle
PENDING → PARTIAL → LUNAS berdasarkan `totalDibayar` terhadap `total`. Enum DRAFT ada di schema tetapi tidak ditemukan dibuat oleh alur aktif.

## Operasi
- `bayarInvoice`: Kasir, anti-overpay dengan clamp ke sisa, create Payment.
- `updateInvoice`: metadata dasar.
- `updateInvoiceAndItems`: edit metadata dan line transaction, sinkronkan ledger/total/status, lindungi qty yang sudah diretur dan pembayaran yang sudah tercatat.
- Delete tunggal/massal: menghapus invoice dan dapat menghapus transaksi, return, ledger, serta payment terkait dalam transaksi DB.

## Pengingat WhatsApp
Daftar invoice (`InvoiceClient`) dan detail (`InvoiceActions`) memakai `WhatsAppDialog` untuk nomor pelanggan; teks pesan tagihan tidak berubah. Lihat [[Core-UI-Components]].

## Risiko dampak
Delete invoice adalah operasi domain luas, bukan hanya penghapusan dokumen. Lihat [[Risks]].
