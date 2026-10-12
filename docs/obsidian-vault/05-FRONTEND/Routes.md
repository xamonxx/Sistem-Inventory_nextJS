---
type: frontend-routes
status: verified
last_verified: 2026-10-12
source_files: [src/app, src/components/Sidebar.tsx]
related: ["[[Authorization]]", "[[Frontend-Architecture]]", "[[API-Overview]]"]
tags: [frontend, routes]
---
# Routes

| Route | Implementasi | Intended/access guard terverifikasi |
|---|---|---|
| `/login` | `src/app/login/page.tsx` | Publik |
| `/` | `(app)/page.tsx` | Auth; Non-Gudang redirect |
| `/barang` | `barang/page.tsx` | Gudang |
| `/kasir` | `kasir/page.tsx` | Kasir |
| `/stok` | `stok/page.tsx` | Gudang |
| `/stok/masuk` | `stok/masuk/page.tsx` | Gudang |
| `/stok/[id]` | `stok/[id]/page.tsx` | Gudang |
| `/retur` | `retur/page.tsx` | Kasir/Gudang (page + action) |
| `/invoice` | `invoice/page.tsx` | Kasir/Gudang; pay flag hanya Kasir |
| `/invoice/[id]` | `invoice/[id]/page.tsx` | Kasir/Gudang |
| `/invoice/edit/[id]` | `invoice/edit/[id]/page.tsx` | Kasir |
| `/laporan` | `laporan/page.tsx` | Gudang |
| `/pengguna` | `pengguna/page.tsx` | Gudang |
| `/log-aktivitas` | `log-aktivitas/page.tsx` | Gudang |
| `/non-gudang` | non-gudang dashboard | Non-Gudang |
| `/non-gudang/barang` | katalog | Non-Gudang |
| `/non-gudang/buat-invoice` | CO/cart | Non-Gudang |
| `/non-gudang/invoice` | invoice | Non-Gudang |
| `/non-gudang/pembelian` | laporan pembelian | Non-Gudang |
| `/non-gudang/konsumen` | konsumen | Non-Gudang |
| `/non-gudang/laporan` | laporan | Non-Gudang |
| `/verify/[token]` | verifikasi invoice | Publik dengan JWT khusus |

Route Handlers ada di [[API-Overview]]. Seluruh read page kini role-guarded (inline "Akses Ditolak"); lihat [[Risks]].
