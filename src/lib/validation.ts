import { z } from "zod";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

/**
 * Helper validasi & sanitasi terpusat (allowlist-first, server-side).
 * Tujuan: semua input dari client component / API divalidasi ulang di server,
 * dengan tipe data tegas, batas panjang, dan normalisasi yang konsisten.
 */

// Karakter kontrol ASCII yang berbahaya/merusak output (NUL s/d unit separator
// dan DEL), kecuali tab (\x09) & newline (\x0A) yang masih wajar untuk alamat.
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Buang karakter kontrol yang bisa merusak struk/log, lalu trim.
 * Bukan pengganti output-encoding (React tetap meng-escape saat render),
 * tapi mencegah data "kotor" tersimpan ke database.
 */
export function sanitizeText(input: unknown): string {
  if (input == null) return "";
  return String(input).replace(CONTROL_CHARS, "").trim();
}

/** String wajib: disanitasi, tidak boleh kosong, dibatasi panjangnya. */
export function requiredText(max: number, label = "Field") {
  return z
    .any()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(1, `${label} wajib diisi.`)
        .max(max, `${label} maksimal ${max} karakter.`)
    );
}

/** String opsional: disanitasi, default "", dibatasi panjangnya. */
export function optionalText(max: number, label = "Field") {
  return z
    .any()
    .transform(sanitizeText)
    .pipe(z.string().max(max, `${label} maksimal ${max} karakter.`));
}

/** ID database: integer positif (coerce dari string form/JSON). */
export const dbId = z.coerce
  .number({ invalid_type_error: "ID tidak valid." })
  .int("ID harus bilangan bulat.")
  .positive("ID tidak valid.");

/** Boolean tegas (terima true/false dan "true"/"false"/"on" dari form). */
export const strictBool = z
  .union([z.boolean(), z.enum(["true", "false", "on", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "on" || v === "1");

/** Nilai uang: angka berhingga, >= 0, dengan batas atas wajar. */
export const money = z.coerce
  .number({ invalid_type_error: "Nilai harus angka." })
  .finite("Nilai tidak valid.")
  .min(0, "Nilai tidak boleh negatif.")
  .max(FIELD_LIMITS.maxMoney, "Nilai terlalu besar.");

/** Kuantitas: integer positif dengan batas atas. */
export const qtyPositive = z.coerce
  .number({ invalid_type_error: "Qty harus angka." })
  .int("Qty harus bilangan bulat.")
  .positive("Qty harus lebih dari 0.")
  .max(FIELD_LIMITS.maxQty, "Qty terlalu besar.");

/** Integer bertanda dengan batas (untuk koreksi/penyesuaian stok). */
export const boundedInt = z.coerce
  .number({ invalid_type_error: "Nilai harus angka." })
  .int("Nilai harus bilangan bulat.")
  .min(-FIELD_LIMITS.maxQty, "Nilai terlalu kecil.")
  .max(FIELD_LIMITS.maxQty, "Nilai terlalu besar.");

/**
 * Pesan error aman + logging detail hanya di server.
 * Cegah kebocoran stack trace / pesan internal ke client.
 */
export function safeError(
  e: unknown,
  fallback = "Terjadi kesalahan. Silakan coba lagi."
): { error: string } {
  console.error("[server action error]", e);
  return { error: fallback };
}

/** Ambil pesan validasi pertama dari hasil zod safeParse yang gagal. */
export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Data tidak valid.";
}

/**
 * Bentuk hasil standar untuk server action sederhana (sukses/gagal).
 * Memberi tipe konsisten sehingga client cukup cek `res.ok` / `res.error`.
 */
export type ActionResult = { ok?: boolean; error?: string };
