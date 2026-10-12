---
type: issue-register
status: verified
last_verified: 2026-10-12
source_files: [src/components/ui.tsx, package.json]
related: ["[[Current-State]]", "[[Change-Index]]"]
tags: [issues, resolved]
---
# Resolved Issues

## 2026-10-12 — Custom select overlay tertutup table/header
`CustomSelect` sekarang merender menu melalui React portal ke `document.body`, memakai fixed positioning dan `zIndex: 2147483005`. Ini memutus clipping/stacking context parent dan menempatkan dropdown di atas surface aplikasi.

**Bukti:** `src/components/ui.tsx`, block `createPortal` pada menu.

## 2026-10-12 — Development port utama
Script `npm run dev` menjalankan Next.js Turbopack pada port default 3000 (sempat 3001, dikembalikan).

**Bukti:** `package.json` script `dev`.

Konfigurasi launcher/smoke lama masih menyebut 3000 dan dicatat sebagai [[Technical-Debt]].

## Total margin laporan terpotong 500 baris (2026-10-12)
`laporanMargin` menjumlah hanya 500 `TransactionItem` terbaru dalam periode, sehingga total omzet, margin, dan persen margin di halaman Laporan dan ekspor Excel menjadi terlalu kecil bila penjualan melebihi 500 baris. Diperbaiki dengan agregasi SQL per barang tanpa batas baris di `src/lib/reports.ts`.
