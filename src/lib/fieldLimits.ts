/**
 * Batas panjang karakter untuk seluruh field teks aplikasi.
 * Dipakai bersama oleh form (maxLength) dan validasi server (zod .max())
 * supaya teks tidak meluap / merusak tata letak struk & invoice,
 * dan mencegah penyimpanan string berukuran sangat besar (abuse).
 */
export const FIELD_LIMITS = {
  // Data pelanggan / transaksi (kasir & retur)
  // Catatan: nama perusahaan/PT bisa panjang ("PT Jaya Perkasa Mandiri" = 23).
  // Batas dibuat cukup lega; struk & invoice sudah otomatis wrap teks panjang.
  namaClient: 60,
  namaWs: 40,
  projectNama: 60,
  projectGroupNama: 40,
  alamat: 200,
  alasan: 250,

  // Master barang
  kodeBarang: 30,
  namaBarang: 120,

  // Pengguna
  username: 30,
  nama: 80,
  passwordMin: 8,
  passwordMax: 100,

  // Info bank pembayaran (transfer/kredit)
  namaBank: 40,
  noRekening: 30,
  atasNama: 40,

  // Stok / catatan
  keterangan: 200,
  supplierName: 80,
  referenceNo: 50,
  notes: 250,

  // Pencarian
  search: 80,

  // Batas angka (rupiah & qty) — mencegah overflow / nilai absurd
  maxMoney: 100_000_000_000, // 100 miliar
  maxQty: 1_000_000,
} as const;
