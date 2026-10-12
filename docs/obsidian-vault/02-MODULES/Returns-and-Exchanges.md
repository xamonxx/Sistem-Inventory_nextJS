---
type: module
status: verified
last_verified: 2026-10-13
source_files: [src/app/(app)/retur/actions.ts, src/lib/returnRules.ts, src/lib/inventoryRules.ts]
related: ["[[Return-and-Exchange-Flow]]", "[[POS-Transactions]]", "[[Stock-Ledger]]"]
tags: [module, return]
---
# Returns and Exchanges

## Fungsi
Retur dan tukar harus terikat ke `Transaction` asli. Pencarian menerima nomor transaksi atau invoice dan menelusuri ke transaksi sumber.

## Kirim nota via WhatsApp
Tombol WhatsApp pada nota retur membuka `WhatsAppDialog` (bukan `window.prompt`); nomor dinormalisasi ke `62…` sebelum membuka `wa.me`. Lihat [[Core-UI-Components]].

## Aturan
- Harga snapshot dan item harus cocok dengan transaksi asli.
- Total qty retur kumulatif tidak boleh melebihi qty pembelian.
- Tukar memerlukan jumlah baris retur dan pengganti sama.
- Barang retur masuk ke stok; barang pengganti keluar.
- Stok pengganti divalidasi, termasuk incoming qty bila item yang sama dikembalikan dalam transaksi tersebut.
- `selisih = totalGanti - totalRetur`; hanya selisih positif membuat invoice PENDING. Selisih negatif disimpan sebagai nilai refund tetapi tidak ditemukan pencatatan payment/refund terpisah.

Hak akses mutasi: Kasir atau Gudang.
