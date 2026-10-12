/**
 * Sinkronisasi master barang PUTRA CORPORATION.
 *
 * Preview : npm run db:add-items
 * Terapkan: npm run db:add-items -- --apply
 *
 * Script idempotent berdasarkan nama barang yang dinormalisasi. Saat barang sudah
 * ada, harga/kategori/status disinkronkan tetapi stokAwal dan minStok dipertahankan
 * agar eksekusi ulang tidak mengubah stok berjalan.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { itemCodePrefix } from "../src/lib/itemCode";
import { ITEM_CATEGORIES, type ItemCategory } from "../src/lib/itemCategories";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type SourceItem = {
  kategori: ItemCategory;
  nama: string;
  hargaBeli: number;
  hargaJual: number;
  stokAwal: number;
};

const DATA: SourceItem[] = [
  // BAHAN UTAMA (10)
  { kategori: "BAHAN UTAMA", nama: "Multi Polos 9mm", hargaBeli: 147000, hargaJual: 169000, stokAwal: 30 },
  { kategori: "BAHAN UTAMA", nama: "Multi Polos 12mm", hargaBeli: 185000, hargaJual: 207000, stokAwal: 0 },
  { kategori: "BAHAN UTAMA", nama: "Multi Polos 18mm", hargaBeli: 248000, hargaJual: 270000, stokAwal: 30 },
  { kategori: "BAHAN UTAMA", nama: "Multi Melamin 6mm", hargaBeli: 160000, hargaJual: 182000, stokAwal: 162 },
  { kategori: "BAHAN UTAMA", nama: "Multi Melamin 18mm A", hargaBeli: 320000, hargaJual: 342000, stokAwal: 88 },
  { kategori: "BAHAN UTAMA", nama: "Multi Melamin Double 18mm", hargaBeli: 385000, hargaJual: 418000, stokAwal: 28 },
  { kategori: "BAHAN UTAMA", nama: "Block Board 18mm", hargaBeli: 220000, hargaJual: 267000, stokAwal: 61 },
  { kategori: "BAHAN UTAMA", nama: "Block Board Melamin 18mm SF", hargaBeli: 272000, hargaJual: 294000, stokAwal: 108 },
  { kategori: "BAHAN UTAMA", nama: "Block Board Melamin Double 18mm DF", hargaBeli: 355000, hargaJual: 377000, stokAwal: 32 },
  { kategori: "BAHAN UTAMA", nama: "PVC 6mm", hargaBeli: 220000, hargaJual: 235000, stokAwal: 0 },

  // MATERIAL (40)
  { kategori: "MATERIAL", nama: "Engsel 1/2 Bengkok Hubben", hargaBeli: 30000, hargaJual: 40000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel Lurus Hubben", hargaBeli: 14200, hargaJual: 21000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel Lurus Hubben SS", hargaBeli: 30000, hargaJual: 40000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel Lurus 1/2 Hubben", hargaBeli: 14200, hargaJual: 21000, stokAwal: 29 },
  { kategori: "MATERIAL", nama: "Engsel Lurus 1/2 Hubben SS", hargaBeli: 30000, hargaJual: 40000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel Full Bengkok Huben", hargaBeli: 18000, hargaJual: 23000, stokAwal: 41 },
  { kategori: "MATERIAL", nama: "Engsel Lurus Harfit", hargaBeli: 18000, hargaJual: 23000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel 1/2 Harfit", hargaBeli: 18000, hargaJual: 23000, stokAwal: 98 },
  { kategori: "MATERIAL", nama: "Engsel Full Bengkok Harfit", hargaBeli: 16000, hargaJual: 21000, stokAwal: 131 },
  { kategori: "MATERIAL", nama: "Engsel 1/2 Bengkok Harfit", hargaBeli: 30000, hargaJual: 40000, stokAwal: 27 },
  { kategori: "MATERIAL", nama: "Rel 25", hargaBeli: 21500, hargaJual: 26500, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Rel 30", hargaBeli: 23500, hargaJual: 33500, stokAwal: 18 },
  { kategori: "MATERIAL", nama: "Rel 35", hargaBeli: 30000, hargaJual: 40000, stokAwal: 16 },
  { kategori: "MATERIAL", nama: "Rel 40", hargaBeli: 31000, hargaJual: 43500, stokAwal: 22 },
  { kategori: "MATERIAL", nama: "Rel 45", hargaBeli: 32500, hargaJual: 45000, stokAwal: 15 },
  { kategori: "MATERIAL", nama: "Rel 50", hargaBeli: 34500, hargaJual: 50000, stokAwal: 41 },
  { kategori: "MATERIAL", nama: "Rel 50 Huben", hargaBeli: 45000, hargaJual: 60500, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Sekrup 5/8 Philips", hargaBeli: 51, hargaJual: 200, stokAwal: 3750 },
  { kategori: "MATERIAL", nama: "Sekrup 2cm Philips", hargaBeli: 130, hargaJual: 300, stokAwal: 1100 },
  { kategori: "MATERIAL", nama: "Sekrup 2,5 Philips", hargaBeli: 167, hargaJual: 350, stokAwal: 2000 },
  { kategori: "MATERIAL", nama: "Sekrup 3cm Philips", hargaBeli: 103, hargaJual: 400, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Sekrup 4cm Philips", hargaBeli: 122, hargaJual: 400, stokAwal: 2600 },
  { kategori: "MATERIAL", nama: "Sekrup 5cm Philips", hargaBeli: 202, hargaJual: 500, stokAwal: 1950 },
  { kategori: "MATERIAL", nama: "Sekrup 7cm Philips", hargaBeli: 168, hargaJual: 2000, stokAwal: 966 },
  { kategori: "MATERIAL", nama: "Sekrup 2,5cm Gipsum", hargaBeli: 167, hargaJual: 350, stokAwal: 6600 },
  { kategori: "MATERIAL", nama: "Sekrup 3cm Gipsum", hargaBeli: 103, hargaJual: 400, stokAwal: 3800 },
  { kategori: "MATERIAL", nama: "Sekrup 4cm Gipsum", hargaBeli: 160, hargaJual: 400, stokAwal: 2650 },
  { kategori: "MATERIAL", nama: "Sekrup 5cm Gipsum", hargaBeli: 149, hargaJual: 500, stokAwal: 2100 },
  { kategori: "MATERIAL", nama: "Fisher S6", hargaBeli: 140, hargaJual: 300, stokAwal: 9401 },
  { kategori: "MATERIAL", nama: "Fisher S8", hargaBeli: 50, hargaJual: 300, stokAwal: 1558 },
  { kategori: "MATERIAL", nama: "Vinyl Putih 2,5cm", hargaBeli: 810, hargaJual: 1500, stokAwal: 295 },
  { kategori: "MATERIAL", nama: "Sealant Clear", hargaBeli: 29917, hargaJual: 45000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Sealant White", hargaBeli: 36025, hargaJual: 49000, stokAwal: 338 },
  { kategori: "MATERIAL", nama: "Sealant Black", hargaBeli: 33689, hargaJual: 45000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Hidrolik / Gas Spring", hargaBeli: 13600, hargaJual: 15600, stokAwal: 20 },
  { kategori: "MATERIAL", nama: "Tahanan Ambalan", hargaBeli: 160, hargaJual: 700, stokAwal: 543 },
  { kategori: "MATERIAL", nama: "Lem Tetes", hargaBeli: 2300, hargaJual: 8000, stokAwal: 159 },
  { kategori: "MATERIAL", nama: "Lem Putih Kayu", hargaBeli: 28000, hargaJual: 33000, stokAwal: 17 },
  { kategori: "MATERIAL", nama: "Isi Cutter Kenko", hargaBeli: 4041, hargaJual: 9100, stokAwal: 78 },
  { kategori: "MATERIAL", nama: "Lakban Kertas", hargaBeli: 4881, hargaJual: 10000, stokAwal: 131 },

  // AKSESORIS (7)
  { kategori: "AKSESORIS", nama: "Rak Piring Atas 60 + Tatakan", hargaBeli: 152000, hargaJual: 162000, stokAwal: 6 },
  { kategori: "AKSESORIS", nama: "Rak Piring Bawah 30 + Tatakan", hargaBeli: 140000, hargaJual: 163000, stokAwal: 11 },
  { kategori: "AKSESORIS", nama: "Rak Sendok Besar", hargaBeli: 79000, hargaJual: 102000, stokAwal: 13 },
  { kategori: "AKSESORIS", nama: "Rak Sendok Kecil", hargaBeli: 58000, hargaJual: 81000, stokAwal: 9 },
  { kategori: "AKSESORIS", nama: "Ventilasi Silver 5x15", hargaBeli: 8753, hargaJual: 10000, stokAwal: 50 },
  { kategori: "AKSESORIS", nama: "Rak Piring 2 Susun + Tatakan", hargaBeli: 140000, hargaJual: 163000, stokAwal: 0 },
  { kategori: "AKSESORIS", nama: "Rak Piring Bawah 30 SS", hargaBeli: 641000, hargaJual: 680000, stokAwal: 1 },

  // KELISTRIKAN (16)
  { kategori: "KELISTRIKAN", nama: "LED STP WW", hargaBeli: 35000, hargaJual: 86000, stokAwal: 67 },
  { kategori: "KELISTRIKAN", nama: "LED STP WH", hargaBeli: 35000, hargaJual: 86000, stokAwal: 0 },
  { kategori: "KELISTRIKAN", nama: "Down LED WW", hargaBeli: 12400, hargaJual: 32400, stokAwal: 3 },
  { kategori: "KELISTRIKAN", nama: "Down LED WH", hargaBeli: 12400, hargaJual: 32400, stokAwal: 21 },
  { kategori: "KELISTRIKAN", nama: "Rumah Lampu/Batang LED", hargaBeli: 60000, hargaJual: 83000, stokAwal: 257 },
  { kategori: "KELISTRIKAN", nama: "Trafo 5A", hargaBeli: 51000, hargaJual: 66000, stokAwal: 46 },
  { kategori: "KELISTRIKAN", nama: "Trafo 10A", hargaBeli: 64500, hargaJual: 81000, stokAwal: 102 },
  { kategori: "KELISTRIKAN", nama: "Trafo 15A", hargaBeli: 87000, hargaJual: 104000, stokAwal: 98 },
  { kategori: "KELISTRIKAN", nama: "Saklar Jempol", hargaBeli: 4600, hargaJual: 9500, stokAwal: 191 },
  { kategori: "KELISTRIKAN", nama: "Stop Kontak Tanam", hargaBeli: 15054, hargaJual: 23000, stokAwal: 63 },
  { kategori: "KELISTRIKAN", nama: "Kabel Putih", hargaBeli: 4950, hargaJual: 10000, stokAwal: 760 },
  { kategori: "KELISTRIKAN", nama: "Kabel Merah Hitam", hargaBeli: 4200, hargaJual: 6000, stokAwal: 1090 },
  { kategori: "KELISTRIKAN", nama: "Isolasi Hitam", hargaBeli: 6417, hargaJual: 12000, stokAwal: 100 },
  { kategori: "KELISTRIKAN", nama: "Terminal Tunggal", hargaBeli: 5410, hargaJual: 10000, stokAwal: 41 },
  { kategori: "KELISTRIKAN", nama: "Steker", hargaBeli: 3612, hargaJual: 6000, stokAwal: 64 },
  { kategori: "KELISTRIKAN", nama: "Dop Kabel Hitam", hargaBeli: 10000, hargaJual: 15000, stokAwal: 0 },
];

function normalizedName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("id-ID");
}

function validateSource() {
  const keys = new Set<string>();
  for (const item of DATA) {
    if (!ITEM_CATEGORIES.includes(item.kategori)) throw new Error(`Kategori tidak valid: ${item.kategori}`);
    if (!item.nama.trim()) throw new Error("Nama barang kosong di dataset.");
    if (![item.hargaBeli, item.hargaJual, item.stokAwal].every(Number.isInteger)) {
      throw new Error(`Nilai barang harus integer: ${item.nama}`);
    }
    if (item.hargaBeli < 0 || item.hargaJual < 0 || item.stokAwal < 0) {
      throw new Error(`Nilai barang tidak boleh negatif: ${item.nama}`);
    }
    const key = normalizedName(item.nama);
    if (keys.has(key)) throw new Error(`Nama ganda di dataset: ${item.nama}`);
    keys.add(key);
  }
}

function nextAvailableCode(nama: string, taken: Set<string>): string {
  const prefix = itemCodePrefix(nama);
  const re = new RegExp(`^PC-${prefix}-(\\d+)$`);
  let max = 0;
  for (const code of taken) {
    const match = re.exec(code);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  const code = `PC-${prefix}-${String(max + 1).padStart(3, "0")}`;
  taken.add(code);
  return code;
}

async function main() {
  validateSource();

  const existing = await prisma.item.findMany({ orderBy: { id: "asc" } });
  const byName = new Map<string, typeof existing>();
  for (const item of existing) {
    const key = normalizedName(item.nama);
    byName.set(key, [...(byName.get(key) ?? []), item]);
  }

  const conflicts = DATA.filter((row) => (byName.get(normalizedName(row.nama))?.length ?? 0) > 1);
  if (conflicts.length > 0) {
    throw new Error(`Nama ambigu di database: ${conflicts.map((row) => row.nama).join(", ")}`);
  }

  const takenCodes = new Set(existing.map((item) => item.kode));
  const plan = DATA.map((source) => {
    const current = byName.get(normalizedName(source.nama))?.[0];
    if (!current) return { kind: "CREATE" as const, source, code: nextAvailableCode(source.nama, takenCodes) };

    const changed =
      current.nama !== source.nama ||
      current.kategori !== source.kategori ||
      Number(current.hargaBeli) !== source.hargaBeli ||
      Number(current.hargaJual) !== source.hargaJual ||
      !current.aktif;
    return { kind: changed ? "UPDATE" as const : "UNCHANGED" as const, source, current };
  });

  const counts = Object.fromEntries(["CREATE", "UPDATE", "UNCHANGED"].map((kind) => [kind, plan.filter((p) => p.kind === kind).length]));
  console.log(`${APPLY ? "TERAPKAN" : "DRY-RUN"} master barang: ${DATA.length} baris`);
  console.log(`Buat: ${counts.CREATE} | Perbarui: ${counts.UPDATE} | Tetap: ${counts.UNCHANGED}`);
  for (const category of ITEM_CATEGORIES) {
    console.log(`- ${category}: ${DATA.filter((item) => item.kategori === category).length}`);
  }
  for (const entry of plan) {
    if (entry.kind === "CREATE") console.log(`+ ${entry.code} | ${entry.source.kategori} | ${entry.source.nama}`);
    if (entry.kind === "UPDATE") console.log(`~ ${entry.current.kode} | ${entry.source.kategori} | ${entry.source.nama}`);
  }

  if (!APPLY) {
    console.log("\nTidak ada perubahan disimpan. Gunakan --apply untuk menerapkan.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of plan) {
      if (entry.kind === "UNCHANGED") continue;
      const data = {
        nama: entry.source.nama,
        kategori: entry.source.kategori,
        hargaBeli: new Prisma.Decimal(entry.source.hargaBeli),
        hargaJual: new Prisma.Decimal(entry.source.hargaJual),
        aktif: true,
      };

      if (entry.kind === "CREATE") {
        await tx.item.create({
          data: { ...data, kode: entry.code, stokAwal: entry.source.stokAwal, minStok: 10 },
        });
      } else {
        await tx.item.update({ where: { id: entry.current.id }, data });
      }
    }
  });

  console.log(`\nSelesai. Total barang di database: ${await prisma.item.count()}`);
}

main()
  .catch((error) => {
    console.error("Gagal menyinkronkan master barang:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
