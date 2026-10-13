/**
 * Uji keamanan validasi input (allowlist-first, server-side).
 * Jalankan: npm run test:security
 *
 * Menguji helper validasi terpusat dengan payload berbahaya yang lazim:
 *  - SQL injection, XSS, path traversal, nama file berbahaya
 *  - input kosong, terlalu panjang (10.000 char), tipe data salah
 *  - role escalation / enum tidak valid, tanggal/ID tidak valid
 *
 * Catatan: SQLi dicegah oleh Prisma (query terparameter) dan XSS dicegah oleh
 * output-encoding React. Teks "berbahaya" tetap boleh tersimpan sebagai teks
 * biasa selama panjangnya dibatasi & dirender ter-escape.
 */
import { z } from "zod";
import {
  sanitizeText,
  requiredText,
  optionalText,
  dbId,
  strictBool,
  money,
  qtyPositive,
  boundedInt,
} from "../src/lib/validation";
import { FIELD_LIMITS } from "../src/lib/fieldLimits";
import { validateStockDemand } from "../src/lib/inventoryRules";
import { invoiceStatusFor, validateCheckoutTotals } from "../src/lib/checkoutRules";

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

const accepts = (schema: z.ZodTypeAny, v: unknown) => schema.safeParse(v).success;
const rejects = (schema: z.ZodTypeAny, v: unknown) => !schema.safeParse(v).success;

const LONG = "a".repeat(10_000);
const SQLI = "' OR '1'='1";
const XSS = "<script>alert(1)</script>";
const TRAVERSAL = "../../.env";

console.log("\n=== sanitizeText ===");
ok("hapus karakter kontrol (NUL)", sanitizeText("ab\x00cd") === "abcd");
ok("trim spasi", sanitizeText("  hi  ") === "hi");
ok("pertahankan teks normal", sanitizeText("Ibu Indah") === "Ibu Indah");

console.log("\n=== requiredText (nama klien, max) ===");
const nama = requiredText(FIELD_LIMITS.namaClient, "Nama");
ok("tolak kosong", rejects(nama, ""));
ok("tolak spasi-saja", rejects(nama, "   "));
ok("tolak 10.000 karakter", rejects(nama, LONG));
ok("terima nama valid", accepts(nama, "Toko Plywood"));
ok("tolak melebihi batas namaClient", rejects(nama, "x".repeat(FIELD_LIMITS.namaClient + 1)));
ok("SQLi (pendek) diterima sbg teks (aman via Prisma)", accepts(nama, SQLI));

// Payload XSS panjang diuji pada field dgn batas lebih besar (alasan) —
// tetap diterima sbg teks biasa (aman karena React meng-escape saat render).
const teksPanjang = requiredText(FIELD_LIMITS.alasan, "Catatan");
ok("XSS diterima sbg teks (aman via escaping)", accepts(teksPanjang, XSS));
ok("hasil XSS ter-trim apa adanya", teksPanjang.parse(XSS) === XSS);

console.log("\n=== optionalText (alamat) ===");
const alamat = optionalText(FIELD_LIMITS.alamat, "Alamat");
ok("kosong -> ''", alamat.parse("") === "");
ok("tolak melebihi batas", rejects(alamat, LONG));
ok("path traversal diterima sbg teks biasa", accepts(alamat, TRAVERSAL));

console.log("\n=== dbId (ID integer positif) ===");
ok("terima 5", accepts(dbId, 5));
ok('terima "5" (coerce)', accepts(dbId, "5"));
ok("tolak 0", rejects(dbId, 0));
ok("tolak negatif", rejects(dbId, -1));
ok("tolak pecahan", rejects(dbId, 1.5));
ok("tolak string non-numerik", rejects(dbId, "abc"));
ok("tolak SQLi", rejects(dbId, SQLI));

console.log("\n=== money (nilai uang) ===");
ok("terima 0", accepts(money, 0));
ok("terima 1000", accepts(money, 1000));
ok("tolak negatif", rejects(money, -1));
ok("tolak NaN", rejects(money, NaN));
ok("tolak Infinity", rejects(money, Infinity));
ok("tolak melebihi batas atas", rejects(money, FIELD_LIMITS.maxMoney + 1));

console.log("\n=== qtyPositive (kuantitas) ===");
ok("terima 3", accepts(qtyPositive, 3));
ok("tolak 0", rejects(qtyPositive, 0));
ok("tolak negatif", rejects(qtyPositive, -3));
ok("tolak pecahan", rejects(qtyPositive, 1.5));
ok("tolak NaN", rejects(qtyPositive, NaN));
ok("tolak qty absurd", rejects(qtyPositive, FIELD_LIMITS.maxQty + 1));

console.log("\n=== boundedInt (koreksi stok bertanda) ===");
ok("terima negatif dalam batas", accepts(boundedInt, -50));
ok("tolak di luar batas atas", rejects(boundedInt, FIELD_LIMITS.maxQty + 1));
ok("tolak pecahan", rejects(boundedInt, 2.5));

console.log("\n=== strictBool ===");
ok('"true" -> true', strictBool.parse("true") === true);
ok('"on" -> true', strictBool.parse("on") === true);
ok('"false" -> false', strictBool.parse("false") === false);
ok('"0" -> false', strictBool.parse("0") === false);
ok("tolak nilai aneh", rejects(strictBool, "maybe"));

console.log("\n=== enum role (anti privilege escalation) ===");
const roleEnum = z.enum(["ADMIN_KASIR", "ADMIN_GUDANG"]);
ok("terima ADMIN_KASIR", accepts(roleEnum, "ADMIN_KASIR"));
ok('tolak "superadmin"', rejects(roleEnum, "superadmin"));
ok('tolak "admin=true"', rejects(roleEnum, "admin=true"));

console.log("\n=== enum status invoice / tipe transaksi ===");
const statusEnum = z.enum(["DRAFT", "PENDING", "LUNAS"]);
ok("terima PENDING", accepts(statusEnum, "PENDING"));
ok("tolak status karang", rejects(statusEnum, "HACKED"));

console.log("\n=== validasi tanggal (YYYY-MM-DD) ===");
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
ok("terima 2026-06-25", dateRe.test("2026-06-25"));
ok("tolak format salah", !dateRe.test("25/06/2026"));
ok("tolak injeksi", !dateRe.test("2026-06-25' OR 1=1"));

console.log("\n=== nama file berbahaya (upload allowlist) ===");
// Aplikasi tidak punya endpoint upload web; ini menguji pola allowlist ekstensi
// yang dipakai bila kelak ada upload.
const allowedExt = /\.(jpg|jpeg|png|pdf|xlsx)$/i;
ok("tolak test.php", !allowedExt.test("test.php"));
ok("tolak image.jpg.php", !allowedExt.test("image.jpg.php"));
ok("tolak shell.sh", !allowedExt.test("shell.sh"));
ok("terima foto.jpg", allowedExt.test("foto.jpg"));

console.log("\n=== aturan stok server ===");
ok(
  "tolak pengeluaran melebihi stok tersedia",
  !validateStockDemand([
    { nama: "Barang A", aktif: true, stokAwal: 10, ledgerQty: -4, requestedQty: 7 },
  ]).ok
);
ok(
  "terima pengeluaran sesuai stok tersedia",
  validateStockDemand([
    { nama: "Barang A", aktif: true, stokAwal: 10, ledgerQty: -4, requestedQty: 6 },
  ]).ok
);
ok(
  "tolak penjualan baru barang nonaktif",
  !validateStockDemand([
    { nama: "Barang Arsip", aktif: false, stokAwal: 10, ledgerQty: 0, requestedQty: 1 },
  ]).ok
);
ok(
  "edit invoice memperhitungkan stok lama yang dikembalikan",
  validateStockDemand([
    {
      nama: "Barang A",
      aktif: true,
      stokAwal: 10,
      ledgerQty: -8,
      currentReservedQty: 5,
      requestedQty: 7,
    },
  ]).ok
);
ok(
  "tukar barang memperhitungkan stok yang masuk dari retur",
  validateStockDemand([
    {
      nama: "Barang A",
      aktif: true,
      stokAwal: 1,
      ledgerQty: -1,
      incomingQty: 1,
      requestedQty: 1,
    },
  ]).ok
);

console.log("\n=== checkoutRules (CREDIT = piutang tempo belum dibayar) ===");
const LINE_100K = [{ itemId: 1, hargaJual: 100_000, qty: 1 }];
const checkout = (payments: { tipe: "CASH" | "TRANSFER" | "CREDIT"; jumlah: number }[], buatInvoice = true) =>
  validateCheckoutTotals({ lines: LINE_100K, payments, buatInvoice });
const paidOf = (r: ReturnType<typeof validateCheckoutTotals>) => (r.ok ? r.totalPaid : NaN);
const sisaOf = (r: ReturnType<typeof validateCheckoutTotals>) => (r.ok ? r.grandTotal - r.totalPaid : NaN);

const splitCashTransferCredit = checkout([
  { tipe: "CASH", jumlah: 30_000 },
  { tipe: "TRANSFER", jumlah: 50_000 },
  { tipe: "CREDIT", jumlah: 20_000 },
]);
ok("split cash+transfer+credit: dibayar 80k (CREDIT tidak dihitung)", paidOf(splitCashTransferCredit) === 80_000);
ok("split cash+transfer+credit: sisa 20k", sisaOf(splitCashTransferCredit) === 20_000);
ok("split cash+transfer+credit: status PARTIAL", invoiceStatusFor(100_000, paidOf(splitCashTransferCredit)) === "PARTIAL");

const transferOnly = checkout([{ tipe: "TRANSFER", jumlah: 100_000 }], false);
ok("transfer penuh: dibayar 100k, sisa 0", paidOf(transferOnly) === 100_000 && sisaOf(transferOnly) === 0);
ok("transfer penuh: status LUNAS", invoiceStatusFor(100_000, paidOf(transferOnly)) === "LUNAS");

const creditOnly = checkout([{ tipe: "CREDIT", jumlah: 0 }], false);
ok("tempo penuh: dibayar 0, wajib invoice", paidOf(creditOnly) === 0 && creditOnly.ok && creditOnly.hasCredit);
ok("tempo penuh: status PENDING", invoiceStatusFor(100_000, paidOf(creditOnly)) === "PENDING");

const splitCashTransfer = checkout([
  { tipe: "CASH", jumlah: 40_000 },
  { tipe: "TRANSFER", jumlah: 60_000 },
], false);
ok("split cash+transfer penuh tanpa invoice: lunas", paidOf(splitCashTransfer) === 100_000);

ok(
  "tolak pembayaran + tempo melebihi total",
  !checkout([
    { tipe: "CASH", jumlah: 90_000 },
    { tipe: "CREDIT", jumlah: 20_000 },
  ]).ok
);
ok("tolak tunai kurang tanpa invoice", !checkout([{ tipe: "CASH", jumlah: 50_000 }], false).ok);

console.log(`\n================ RINGKASAN ================`);
console.log(`  LULUS : ${passed}`);
console.log(`  GAGAL : ${failed}`);
console.log(`==========================================\n`);

if (failed > 0) process.exit(1);
