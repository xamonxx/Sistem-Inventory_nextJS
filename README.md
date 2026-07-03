# Sistem Inventory & Kasir — PUTRA CORPORATION SOFTWARE

Aplikasi inventory + kasir + retur/tukar + invoice/piutang + laporan, dibangun dari data
`KASIR MEI 2026.xlsm`. Stack: **Next.js 15 + TypeScript + Prisma + MySQL + Tailwind**.

## Menjalankan

1. **Nyalakan MySQL** (Laragon → Start, atau MySQL service). Database: `sistem_inventory`.
2. Install & siapkan:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push        # buat/seragamkan tabel
   npm run db:seed           # buat user awal
   ```
3. Jalankan:
   ```bash
   npm run dev               # http://localhost:3000  (development)
   # atau
   npm run build && npm start
   ```

## Login awal

| Username | Password   | Role          | Akses utama |
|----------|------------|---------------|-------------|
| `kasir`  | `password` | ADMIN_KASIR   | Kasir, retur/tukar, invoice & pembayaran |
| `gudang` | `password` | ADMIN_GUDANG  | Master barang, **harga & stok awal**, stok masuk, koreksi |

> Ganti password lewat menu **Pengguna** setelah login.

## Impor data dari Excel

DB barang harus kosong dulu. Lalu:
```bash
npm run import:xlsx -- "C:/Users/Administrator/Downloads/KASIR MEI 2026 (1).xlsm"
```
Hasil & baris bermasalah dicatat di `import-errors.csv`. Importer sudah tervalidasi:
omset total **Rp115.302.200** cocok dengan total Excel, dan rekonsiliasi stok cocok.

## Aturan bisnis penting

- **Stok = turunan kartu stok (StockLedger)**, boleh **minus** (diberi ⚠️), tidak diblokir.
- **Harga (beli/jual) & stok awal hanya bisa diubah Admin Gudang.**
- **Kode barang unik** (DB + validasi).
- **Harga di-snapshot** di tiap baris transaksi → margin historis tetap akurat.
- **Tukar barang**: barang A masuk stok, barang B keluar; selisih (B−A) jadi invoice bila positif, refund bila negatif.
- Nomor dokumen berurutan & transaksional: transaksi `PCxxxxx`, invoice `INV-xxxxx`, retur `RET-xxxxx`.

## Produksi (HTTPS)

Set `COOKIE_SECURE=true` dan `AUTH_SECRET` yang kuat di `.env` saat di belakang HTTPS.
Di Laragon (HTTP) biarkan `COOKIE_SECURE` kosong.

## Struktur

- `prisma/schema.prisma` — model data (Item, StockLedger, Transaction, Return, Invoice, dll)
- `src/lib/` — `auth`, `prisma`, `stock`, `counters`, `reports`, `activity`, `utils`
- `src/app/(app)/` — halaman: dashboard, kasir, retur, invoice, barang, stok, laporan, pengguna
- `src/app/api/export` — export Excel (Omset/Margin/Piutang/Stok)
- `scripts/import-xlsx.ts` — importer dari file Excel
