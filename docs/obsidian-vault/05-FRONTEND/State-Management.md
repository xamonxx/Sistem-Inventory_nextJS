---
type: frontend-state
status: verified
last_verified: 2026-10-12
source_files: [src/lib/kasirStore.ts, src/lib/ngCartStore.ts]
related: ["[[POS-Transactions]]", "[[Non-Warehouse-Orders-and-Invoices]]", "[[Frontend-Architecture]]"]
tags: [frontend, state]
---
# State Management

## Global client stores
### `useKasirStore`
In-memory Zustand store untuk cart POS, tipe transaksi, identitas client/workshop/project, metode/data pembayaran, dan flag create invoice. Tidak ditemukan persistence middleware.

### `useNgCartStore`
In-memory Zustand store untuk tanggal, satu toko sumber, cart produk, konsumen, status/metode/data pembayaran. Store menormalisasi qty dan mencegah campuran toko melalui operasi cart.

## Local state
Filter tabel, modal/drawer, pagination, search, preview, dan form memakai hooks React lokal. Mutasi async memakai `useTransition` atau `useActionState`.

## Server state
Tidak ditemukan React Query usage meskipun dependency tersedia. Refresh data mengandalkan Server Action, Next revalidation, dan `router.refresh()`.

## Reset behavior
Cart store di-reset setelah transaksi berhasil; reload browser juga menghilangkan state karena tidak dipersist.
