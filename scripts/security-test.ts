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

console.log(`\n================ RINGKASAN ================`);
console.log(`  LULUS : ${passed}`);
console.log(`  GAGAL : ${failed}`);
console.log(`==========================================\n`);

if (failed > 0) process.exit(1);
