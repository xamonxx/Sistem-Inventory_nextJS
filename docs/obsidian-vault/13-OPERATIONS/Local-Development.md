---
type: operations
status: verified
last_verified: 2026-10-12
source_files: [package.json, .env.example, prisma/schema.prisma]
related: ["[[Build-and-Test]]", "[[Deployment]]"]
tags: [operations, local]
---
# Local Development

## Prerequisites
- Node.js compatible with Next.js 15; deployment pins Node 22.
- npm.
- MySQL reachable through `DATABASE_URL`.

## Setup
```bash
npm ci
copy .env.example .env
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Development URL dari manifest: `http://localhost:3000`.

## Environment contract
Required operational values: `DATABASE_URL`, `AUTH_SECRET`, `INVOICE_VERIFY_SECRET`. Production secrets minimum 32 chars. Optional behavior/public branding: `COOKIE_SECURE`, `TRUST_PROXY_HEADERS`, `SEED_DEFAULT_PASSWORD`, `NEXT_PUBLIC_APP_URL`, company/address/signature variables.

Jangan menyalin nilai `.env` ke dokumentasi atau log. Seeder menolak password default kurang dari 12 karakter. `db push`, seed, clear, fix, dan regen adalah operasi database; pastikan target URL lokal/disposable sebelum menjalankan.

## Known mismatch
Port 3000 seragam di package.json, README, launcher, dan smoke script. Catatan: `.env` NEXT_PUBLIC_APP_URL masih 3001; sesuaikan manual.

## Responsive audit 2026-10-12
- Login diverifikasi di 375px dan 768px: tanpa scroll horizontal.
- Perubahan: tinggi dialog `100vh` menjadi `100dvh`; dock total POS memakai `env(safe-area-inset-bottom)`; tombol mata password 40x40; teks 8-10px dinaikkan ke 11px pada `@media screen and (max-width: 640px)` di `globals.css` (cetak tidak berubah).
- Putaran 2 (akun uji lokal kasir/gudang/nongudang): 375px semua halaman peran tanpa overflow horizontal; kasir juga lolos di 768px. Dock total POS, katalog, invoice, stok tampil rapi.
- Temuan: tabel lebar di HP hanya terlihat sebagian (Non-Gudang Barang 980px dalam wadah 349px, kolom Aksi di luar layar; Konsumen 820px; Stok 764px; Laporan ~700px). Tombol kecil: tab segmented 28px, Segarkan/Hapus Semua 16px tinggi.
- Belum: tampilan kartu untuk tabel lebar di <768px dan pembesaran target sentuh.

## Responsive putaran 3a (2026-10-12)
- `NgBarangClient` dan `NgKonsumenClient`: tabel disembunyikan di bawah 768px (`hidden md:block`), diganti daftar kartu (`md:hidden`) dengan checkbox, ringkasan, tombol status/Ubah (tinggi min 40px). Empty state mobile terverifikasi di 375px; kartu berisi data belum diuji karena DB uji kosong.
- `Sidebar`: item tidak aktif memakai `border-[var(--chrome-border)]` (border halus) menggantikan `border-transparent`.

## Responsive putaran 3b (2026-10-12)
- `StokClient` (mode tabel) dan `LogAktivitasClient`: tabel disembunyikan di bawah 768px, diganti kartu dengan tombol aksi selebar penuh (tinggi min 40px).
- Target sentuh mobile 40px: toggle tampilan Stok, tab Laporan, tombol Hapus Semua/Segarkan/Lihat Semua di `NotificationCenter` (ukuran desktop tidak berubah via `md:`).
- Tabel Laporan (~700px) tetap scroll horizontal; dianggap wajar untuk laporan analitik.
- Build: `npm run build` gagal EPERM saat dev server berjalan (DLL engine Prisma terkunci). Gunakan `npx next build` jika schema tidak berubah, atau hentikan dev server dulu.
- Insiden 2026-10-12: `next build` dijalankan saat `next start -p 3000` (mode produksi) masih hidup. Server lama memegang manifest build lama di memori, chunk baru tidak cocok (`/_next/static/chunks/app/login/page-*.js` 400) sehingga muncul "Application error: a client-side exception". Perbaikan: hentikan `next start`, lalu jalankan ulang. Aturan: cek proses di port 3000 (`next dev` vs `next start`) sebelum build; jangan build saat `next start` berjalan.

## Data dummy (2026-10-12)
- `npm run db:seed:dummy` (`prisma/seed-dummy.ts`) hanya MENAMBAH data: 100 barang gudang (kode `DMY-0001..0100`, 8 habis & 12 menipis), 100 transaksi POS + 60 invoice gudang, 100 barang & 100 konsumen Non-Gudang (nama berawalan `DMY `), 100 invoice Non-Gudang.
- Mengikuti aturan aplikasi: stok via ledger MASUK/KELUAR (tidak minus), snapshot harga, nomor dokumen via `nextDocNumber`, margin Non-Gudang via `computeNgCart`. Menolak jalan bila data dummy sudah ada.
- `npm run db:clear:dummy` (`prisma/clear-dummy.ts`) menghapus permanen data bertanda dummy beserta transaksi/invoice/pembayaran/retur/ledger turunannya; counter dokumen tidak di-reset. Perlu persetujuan sebelum dijalankan.
