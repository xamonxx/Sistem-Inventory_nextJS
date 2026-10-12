---
type: architecture
status: verified
last_verified: 2026-10-12
source_files:
  - src/lib/auth.ts
  - src/components/Sidebar.tsx
  - src/app/(app)/barang/actions.ts
related: ["[[Authentication]]", "[[Routes]]", "[[Risks]]"]
tags: [security, authorization]
---
# Authorization

## Role
| Role | Akses utama terverifikasi |
|---|---|
| `ADMIN_KASIR` | POS, pembayaran/edit/hapus invoice gudang, retur/tukar |
| `ADMIN_GUDANG` | master barang, stok, laporan gudang, pengguna, audit; juga retur/tukar dan read invoice |
| `ADMIN_NONGUDANG` | katalog, konsumen, CO/invoice, pembayaran, pembelian, laporan non-gudang |

## Enforcement
- Navigasi difilter di `src/components/Sidebar.tsx` dan `FloatingActionButton.tsx`.
- Mutasi penting memanggil `requireRole` di server; ini adalah kontrol otoritatif.
- Layout `(app)` hanya memastikan user terautentikasi.
- Banyak page menambah pemeriksaan role eksplisit.

## Gap terverifikasi
Sejumlah page hanya memanggil `requireUser`, misalnya detail invoice, kartu stok, dan halaman retur. Karena navigasi bukan batas keamanan, user terautentikasi dari domain lain dapat mencoba URL langsung dan membaca data bila page tidak menolak role. Mutasi tetap dijaga `requireRole`. Catat sebagai risiko di [[Risks]].
