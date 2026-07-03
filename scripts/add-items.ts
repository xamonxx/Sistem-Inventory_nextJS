/**
 * Tambah master barang dari daftar harga PUTRA CORPORATION SOFTWARE.
 * Jalankan: npm run db:add-items
 *
 * - kode di-generate PC-00001.. (urut, dilewati bila sudah ada)
 * - Stok akhir = stokAwal + Σ ledger; karena ini stok awal murni, cukup isi field stokAwal (tanpa ledger).
 * - stokAwal WAJIB integer; nilai pecahan (mis. 5,5 / 0,5) dibulatkan ke bilangan terdekat.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// [nama, hargaBeli, hargaJual, stokAwal]
const DATA: [string, number, number, number][] = [
  ["BB Min 18mm New", 245000, 267000, 0],
  ["BB Double Min 18 New", 313000, 318000, 15],
  ["Multi Min 18mm New", 289000, 316000, 0],
  ["Multimin Double 18mm", 360000, 385000, 0],
  ["Multi Polos 9mm", 135500, 150000, 0],
  ["Multi Min 9mm New", 197000, 210000, 0],
  ["Multi Min 5mm New", 145000, 170000, 71],
  ["Bb 18mm Polos New", 192000, 194000, 0],
  ["Multi 18mm Polos", 233000, 260000, 8],
  ["Engsel L Huben", 14200, 21000, 0],
  ["Engsel L ss Huben", 30000, 40000, 0],
  ["Engsel 1/2 Huben", 14200, 21000, 35],
  ["Engsel 1/2 ss Huben", 30000, 40000, 0],
  ["Engsel Full Bengkok", 14200, 21000, 42],
  ["Rell 25", 21500, 25000, 0],
  ["Rell 30", 23500, 31500, 76],
  ["Rell 35", 26500, 34000, 17],
  ["Rell 40", 29500, 40000, 88],
  ["Rell 45", 32500, 45000, 37],
  ["Rell 50", 34500, 50000, 51],
  ["Rell 60", 42500, 60000, 5],
  ["Sekrup 5/8 Philips", 51, 200, 5100],
  ["Sekrup 2cm Philips", 59, 250, 4100],
  ["Sekrup 2,5cm Gipsum", 78, 250, 6600],
  ["Sekrup 2,5 Philips", 78, 250, 400],
  ["Sekrup 3cm Philips", 94, 350, 1300],
  ["Sekrup 4cm Philips", 105, 350, 2000],
  ["Sekrup 5cm Philips", 190, 350, 2600],
  ["Sekrup 7cm Philips", 320, 2000, 986],
  ["Sekrup 3cm Gipsum", 105, 350, 2650],
  ["Sekrup 4cm Gipsum", 115, 350, 6500],
  ["Sekrup 5cm Gipsum", 175, 350, 4600],
  ["Fisher S8", 140, 300, 2255],
  ["Fisher S6", 50, 300, 1644],
  ["Tahanan Ambalan", 500, 700, 1503],
  ["Batang Led", 55000, 78000, 0],
  ["Lem Putih", 23000, 28000, 0],
  ["Gantungan Hook/5pcs", 5350, 10000, 0],
  ["Hidrolik", 13000, 14500, 38],
  ["Ventilasi Anodize 5x20", 8459, 10000, 0],
  ["Ventilasi Anodize 5x15", 6680, 9000, 300],
  ["Ventilasi Black 5x15", 7700, 10000, 0],
  ["Lem Optima 14kg", 735000, 755000, 0],
  ["Lem Optima 2,5Kg", 168000, 175000, 2],
  ["Sealant Putih", 25431, 45000, 0],
  ["Sealant Bening", 25431, 45000, 0],
  ["Sealant Hitam", 25431, 45000, 34],
  ["Sealant Hitam old", 18500, 45000, 0],
  ["Amplas 80", 4200, 10000, 6], // sumber 5,5 -> dibulatkan
  ["Amplas 100", 4200, 10000, 0],
  ["Amplas 120", 4200, 10000, 1],
  ["Amplas 180", 4200, 10000, 1], // sumber 0,5 -> dibulatkan
  ["Amplas 240", 4200, 10000, 3],
  ["Lakban Kertas", 2702, 8000, 83],
  ["Lem Tetes", 2563, 8000, 0],
  ["Vinyl Putih 2,5", 725, 1500, 815],
  ["Isi Kater Kenko", 4041, 9000, 106],
  ["Led stp WW", 29000, 60000, 0],
  ["Led Stp WH", 46750, 61000, 0],
  ["Down Led WW", 12400, 20000, 0],
  ["Down Led Wh", 12400, 20000, 23],
  ["Solsi Hitam", 3903, 8000, 0],
  ["Kabel Putih", 4000, 10000, 0],
  ["Kabel Merah Hitam", 2000, 5000, 0],
  ["Trafo 3a", 34000, 38000, 0],
  ["Trafo 10a New", 60000, 80000, 0],
  ["Saklar Jempol New", 4600, 9500, 132],
  ["Stop Kontak Tanam Galeo", 12910, 20000, 100],
  ["Terminal Satu New", 5410, 10000, 135],
  ["Steker New", 3612, 6000, 109],
  ["Dop Kabel Putih", 10000, 15000, 0],
  ["Dop Kabel Hitam", 10000, 15000, 0],
  ["Dop Kabel Coklat", 10000, 15000, 0],
  ["Rak Piring 60 Atas", 97000, 102000, 0],
  ["Rak Sendok Kecil", 58000, 63000, 7],
  ["Rak Piring Bawah", 110000, 150000, 8],
  ["Rak Sendok Besar New", 77000, 100000, 9],
  ["Multi Polos 12mm", 166000, 175000, 6],
  ["Multi Polos 3mm", 50000, 55000, 0],
  ["Engsel L Harfit", 16000, 21000, 86],
  ["Engsel 1/2 Harfit", 16000, 21000, 166],
  ["Engsel Full Bengkok Harfit", 16000, 21000, 154],
  ["Trafo 5a New", 48000, 60000, 29],
  ["Trafo 16a New", 82500, 90000, 10],
  ["Rell 45 New Harfit", 32000, 45000, 0],
  ["Bb Polos 18 LF", 175000, 185000, 0],
  ["Bb Polos Uty Better 15mm", 245000, 266000, 0],
  ["Sensor Touchscreen", 37900, 50000, 0],
  ["Multi Min 12mm New", 230000, 249000, 0],
  ["Taco Lem Starmax 10kg", 500000, 520000, 0],
  ["Taco Lem Starmax 2,5kg", 140000, 147000, 0],
  ["Engsel L Ecoware", 15000, 20000, 0],
  ["Engsel 1/2 Ecoware", 15000, 20000, 50],
  ["Taco Lem Active", 467500, 520000, 4],
  ["Trafo 10a Spitze", 60000, 75000, 0],
  ["Lem Putih New", 28000, 30000, 8],
  ["Sealant Black Dowsil New", 33689, 45000, 23],
  ["Sealant Putih New", 29917, 45000, 0],
  ["Sealant Bening New", 29917, 45000, 41],
  ["Led stp WW Spitze", 27000, 60000, 0],
  ["Led Stp WH Spitze", 27000, 61000, 0],
  ["Taco Lem Active Galon", 155300, 160000, 0],
  ["Multi Polos 6mm", 85000, 90000, 0],
  ["Lem Kuning", 167816, 175000, 1],
  ["Kabel Putih New", 4500, 10000, 45],
  ["Kabel Merah Hitam New", 4200, 5500, 845],
  ["Rak Piring Bawah 3susun", 0, 0, 1], // harga kosong di sumber
  ["Kabel Tunggal", 11000, 15000, 0],
  ["Solsi Hitam New", 4416, 9000, 112],
  ["Bb 18mm Polos Lokal", 185000, 194000, 10],
  ["Trafo 10a Yomiko", 66000, 70000, 20],
  ["Sealant Putih Dowsil New", 32720, 45000, 111],
  ["Lem Tetes New", 2300, 8000, 273],
  ["BB Min 18mm SF AAA", 242000, 267000, 9],
  ["BB Min 18mm SF New", 253000, 275000, 71],
  ["Multi Min 18mm SF New", 289000, 294000, 62],
  ["Multimin 18mm DF New", 370000, 385000, 59],
  ["Multi Polos 9mm New", 136000, 154000, 16],
  ["Led stp WW Spitze New", 35000, 86000, 35],
  ["Led Stp WH Spitze New", 35000, 86000, 5],
  ["Batang Led New", 60000, 83000, 64],
  ["Rak Piring 60 Atas New", 152000, 157000, 11],
  ["Blockboard Melamin SF 18mm(Msc)", 278000, 278000, 50],
  ["Blockboard Melamin DF 18mm(Msc)", 346000, 346000, 29],
  ["Multi Melamin SF 18mm(Msc)", 315000, 315000, 42],
];

async function main() {
  // Tentukan nomor kode berikutnya berdasarkan PC-xxxxx yang sudah ada.
  const existing = await prisma.item.findMany({ select: { kode: true, nama: true } });
  const existingNama = new Set(existing.map((e) => e.nama.trim().toLowerCase()));
  let maxSeq = 0;
  for (const e of existing) {
    const m = /^PC-0*(\d+)$/.exec(e.kode);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }

  const toCreate: Prisma.ItemCreateManyInput[] = [];
  let skipped = 0;
  let seq = maxSeq;

  for (const [nama, hb, hj, stok] of DATA) {
    if (existingNama.has(nama.trim().toLowerCase())) {
      skipped++;
      continue;
    }
    seq++;
    toCreate.push({
      kode: `PC-${String(seq).padStart(5, "0")}`,
      nama: nama.trim(),
      hargaBeli: new Prisma.Decimal(hb),
      hargaJual: new Prisma.Decimal(hj),
      stokAwal: stok,
      minStok: 10,
    });
  }

  if (toCreate.length > 0) {
    await prisma.item.createMany({ data: toCreate });
  }

  const total = await prisma.item.count();
  console.log(`✅ Ditambahkan: ${toCreate.length} barang`);
  if (skipped > 0) console.log(`⏭️  Dilewati (nama sudah ada): ${skipped}`);
  console.log(`📦 Total barang di database sekarang: ${total}`);
}

main()
  .catch((e) => {
    console.error("❌ Gagal menambah barang:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
