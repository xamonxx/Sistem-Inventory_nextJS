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
  .number({ invalid_type_error: "Nilai harus berupa angka." })
  .finite("Nilai tidak valid.")
  .min(0, "Nilai tidak boleh negatif.")
  .max(FIELD_LIMITS.maxMoney, "Nilai terlalu besar (maksimal Rp 100 miliar per isian). Perkecil angkanya.");

/** Kuantitas: integer positif dengan batas atas. */
export const qtyPositive = z.coerce
  .number({ invalid_type_error: "Qty harus berupa angka." })
  .int("Qty harus bilangan bulat.")
  .positive("Qty harus lebih dari 0.")
  .max(FIELD_LIMITS.maxQty, "Qty terlalu besar (maksimal 1.000.000). Perkecil jumlahnya.");

/** Integer bertanda dengan batas (untuk koreksi/penyesuaian stok). */
export const boundedInt = z.coerce
  .number({ invalid_type_error: "Nilai harus berupa angka." })
  .int("Nilai harus bilangan bulat.")
  .min(-FIELD_LIMITS.maxQty, "Nilai terlalu kecil (minimal -1.000.000).")
  .max(FIELD_LIMITS.maxQty, "Nilai terlalu besar (maksimal 1.000.000).");

/**
 * Pesan error aman + logging detail hanya di server.
 *
 * Selain mencegah kebocoran stack trace ke client, fungsi ini menerjemahkan
 * kegagalan database/Prisma yang UMUM menjadi pesan jelas + solutif, supaya
 * user tidak menerima pesan generik yang ambigu (mis. overflow angka, data
 * duplikat, relasi terkait, atau record hilang). Deteksi via duck-typing agar
 * modul ini tetap aman diimpor dari client (tanpa import runtime Prisma).
 */
type PrismaLikeError = {
  code?: unknown;
  meta?: { target?: unknown } | null;
  message?: unknown;
};

export function safeError(
  e: unknown,
  fallback = "Terjadi kesalahan. Silakan coba lagi."
): { error: string } {
  console.error("[server action error]", e);

  const err = (e ?? {}) as PrismaLikeError;
  const code = typeof err.code === "string" ? err.code : "";
  const msg = typeof err.message === "string" ? err.message : "";

  // Overflow angka: total/nilai melebihi kapasitas kolom Decimal DB.
  // Prisma: P2020 (value out of range) atau pesan MySQL "out of range".
  if (code === "P2020" || /out of range|numeric value out of range|data_out_of_range/i.test(msg)) {
    return {
      error:
        "Nilai terlalu besar dan melebihi batas maksimum sistem. Perkecil angka (harga atau qty) lalu coba lagi.",
    };
  }

  switch (code) {
    // Pelanggaran unik: data yang sama sudah ada.
    case "P2002":
      return {
        error:
          "Data ini sudah terdaftar sebelumnya (duplikat). Pastikan kode/nomor/nama yang unik belum dipakai, lalu coba lagi.",
      };
    // Foreign key: data masih dipakai/terkait data lain.
    case "P2003":
      return {
        error:
          "Data ini masih terkait dengan data lain, sehingga tidak bisa diproses. Lepaskan keterkaitannya lebih dulu.",
      };
    // Record target tidak ada (mis. sudah dihapus user lain).
    case "P2025":
      return {
        error:
          "Data yang dituju tidak ditemukan — kemungkinan sudah dihapus atau diubah. Muat ulang halaman lalu coba lagi.",
      };
    // Nilai terlalu panjang untuk kolom.
    case "P2000":
      return {
        error: "Ada isian yang terlalu panjang untuk disimpan. Persingkat teksnya lalu coba lagi.",
      };
    // Kolom wajib (NOT NULL) tidak terisi.
    case "P2011":
      return {
        error: "Ada isian wajib yang masih kosong. Lengkapi seluruh field yang diperlukan lalu coba lagi.",
      };
  }

  // Gagal terhubung ke database.
  if (code === "P1001" || code === "P1002" || /ECONNREFUSED/i.test(msg)) {
    return {
      error: "Tidak dapat terhubung ke database saat ini. Periksa koneksi lalu coba lagi beberapa saat.",
    };
  }

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
