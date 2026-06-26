import type { Prisma } from "@prisma/client";

/**
 * Auto-generate kode barang yang mudah dihafal & dicari.
 * Format: PC-{PREFIX}-{NNN}
 *  - PREFIX = 2 huruf kata pertama + 1 huruf kata kedua (granular), mis. "BB Min" -> BBM.
 *    Bila hanya 1 kata bermakna -> 3 huruf kata itu (mis. "Hidrolik" -> HID).
 *  - Token ukuran/angka (18mm, 5x20, 2,5kg, 5/8, 3susun) diabaikan saat membentuk prefix.
 *  - NNN = nomor urut 3 digit per-prefix (001, 002, ...). Barang yang prefix-nya sama
 *    dibedakan oleh nomor ini, jadi kode selalu unik.
 *
 * Contoh: "BB Min 18mm New" -> PC-BBM-001, "Multi Polos 9mm" -> PC-MUP-001.
 */

type DbClient = Prisma.TransactionClient;

function cleanLetters(tok: string): string {
  return tok.replace(/[^A-Za-z]/g, "");
}

/** Token bermakna = diawali huruf (bukan angka/ukuran) dan mengandung minimal 1 huruf. */
function meaningfulWords(nama: string): string[] {
  return nama
    .trim()
    .split(/\s+/)
    .filter((t) => /^[A-Za-z]/.test(t) && cleanLetters(t).length > 0)
    .map((t) => cleanLetters(t).toUpperCase());
}

/** Bentuk prefix huruf 2-3 karakter dari nama barang. */
export function itemCodePrefix(nama: string): string {
  const words = meaningfulWords(nama);
  if (words.length === 0) return "XXX";

  let prefix =
    words.length >= 2
      ? words[0].slice(0, 2) + words[1].slice(0, 1)
      : words[0].slice(0, 3);

  if (prefix.length < 2) prefix = (prefix + "XX").slice(0, 2);
  return prefix.toUpperCase();
}

/**
 * Hitung kode berikutnya untuk sebuah nama, berdasarkan nomor tertinggi yang sudah
 * dipakai pada prefix yang sama. Lewatkan satu set kode yang ingin "dianggap sudah ada"
 * (berguna saat batch generate beberapa barang sekaligus dalam satu proses).
 */
export async function nextItemCode(
  db: DbClient,
  nama: string,
  taken?: Set<string>
): Promise<string> {
  const prefix = itemCodePrefix(nama);
  const rows = await db.item.findMany({
    where: { kode: { startsWith: `PC-${prefix}-` } },
    select: { kode: true },
  });

  const re = new RegExp(`^PC-${prefix}-(\\d+)$`);
  let max = 0;
  const consider = (kode: string) => {
    const m = re.exec(kode);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  };
  for (const r of rows) consider(r.kode);
  if (taken) for (const k of taken) consider(k);

  return `PC-${prefix}-${String(max + 1).padStart(3, "0")}`;
}
