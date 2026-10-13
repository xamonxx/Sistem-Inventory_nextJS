/**
 * Sinkronisasi master barang PUTRA CORPORATION untuk katalog utama, Depok, dan LK.
 *
 * Preview : npm run db:add-items
 * Terapkan: npm run db:add-items -- --apply
 *
 * Script idempotent berdasarkan nama barang yang dinormalisasi. Suffix lokasi
 * membedakan harga Depok/LK. Saat barang sudah ada, harga/kategori/status
 * disinkronkan tetapi stokAwal dan minStok dipertahankan agar eksekusi ulang tidak
 * mengubah stok berjalan.
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

const MAIN_DATA: SourceItem[] = [
  // BAHAN UTAMA (10)
  { kategori: "BAHAN UTAMA", nama: "Multi Polos 9mm", hargaBeli: 147000, hargaJual: 169000, stokAwal: 54 },
  { kategori: "BAHAN UTAMA", nama: "Multi Polos 12mm", hargaBeli: 185000, hargaJual: 207000, stokAwal: 0 },
  { kategori: "BAHAN UTAMA", nama: "Multi Polos 18mm", hargaBeli: 248000, hargaJual: 270000, stokAwal: 37 },
  { kategori: "BAHAN UTAMA", nama: "Multi Melamin 6mm", hargaBeli: 160000, hargaJual: 182000, stokAwal: 187 },
  { kategori: "BAHAN UTAMA", nama: "Multi Melamin 18mm A", hargaBeli: 320000, hargaJual: 342000, stokAwal: 129 },
  { kategori: "BAHAN UTAMA", nama: "Multi Melamin Double 18mm", hargaBeli: 385000, hargaJual: 418000, stokAwal: 27 },
  { kategori: "BAHAN UTAMA", nama: "Block Board 18mm", hargaBeli: 220000, hargaJual: 267000, stokAwal: 72 },
  { kategori: "BAHAN UTAMA", nama: "Block Board Melamin 18mm SF", hargaBeli: 272000, hargaJual: 294000, stokAwal: 159 },
  { kategori: "BAHAN UTAMA", nama: "Block Board Melamin Double 18mm DF", hargaBeli: 355000, hargaJual: 377000, stokAwal: 49 },
  { kategori: "BAHAN UTAMA", nama: "PVC 6mm", hargaBeli: 220000, hargaJual: 235000, stokAwal: 0 },

  // MATERIAL (40)
  { kategori: "MATERIAL", nama: "Engsel 1/2 Bengkok Hubben", hargaBeli: 30000, hargaJual: 40000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel Lurus Hubben", hargaBeli: 14200, hargaJual: 21000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel Lurus Hubben SS", hargaBeli: 30000, hargaJual: 40000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel Lurus 1/2 Hubben", hargaBeli: 14200, hargaJual: 21000, stokAwal: 29 },
  { kategori: "MATERIAL", nama: "Engsel Lurus 1/2 Hubben SS", hargaBeli: 30000, hargaJual: 40000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Engsel Full Bengkok Huben", hargaBeli: 18000, hargaJual: 23000, stokAwal: 41 },
  { kategori: "MATERIAL", nama: "Engsel Lurus Harfit", hargaBeli: 18000, hargaJual: 23000, stokAwal: 45 },
  { kategori: "MATERIAL", nama: "Engsel 1/2 Harfit", hargaBeli: 18000, hargaJual: 23000, stokAwal: 34 },
  { kategori: "MATERIAL", nama: "Engsel Full Bengkok Harfit", hargaBeli: 16000, hargaJual: 21000, stokAwal: 132 },
  { kategori: "MATERIAL", nama: "Engsel 1/2 Bengkok Harfit", hargaBeli: 30000, hargaJual: 40000, stokAwal: 31 },
  { kategori: "MATERIAL", nama: "Rel 25", hargaBeli: 21500, hargaJual: 26500, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Rel 30", hargaBeli: 23500, hargaJual: 33500, stokAwal: 26 },
  { kategori: "MATERIAL", nama: "Rel 35", hargaBeli: 30000, hargaJual: 40000, stokAwal: 20 },
  { kategori: "MATERIAL", nama: "Rel 40", hargaBeli: 31000, hargaJual: 43500, stokAwal: 26 },
  { kategori: "MATERIAL", nama: "Rel 45", hargaBeli: 32500, hargaJual: 45000, stokAwal: 27 },
  { kategori: "MATERIAL", nama: "Rel 50", hargaBeli: 34500, hargaJual: 50000, stokAwal: 93 },
  { kategori: "MATERIAL", nama: "Rel 50 Huben", hargaBeli: 45000, hargaJual: 60500, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Sekrup 5/8 Philips", hargaBeli: 51, hargaJual: 200, stokAwal: 3400 },
  { kategori: "MATERIAL", nama: "Sekrup 2cm Philips", hargaBeli: 130, hargaJual: 300, stokAwal: 1750 },
  { kategori: "MATERIAL", nama: "Sekrup 2,5 Philips", hargaBeli: 167, hargaJual: 350, stokAwal: 2200 },
  { kategori: "MATERIAL", nama: "Sekrup 3cm Philips", hargaBeli: 103, hargaJual: 400, stokAwal: 700 },
  { kategori: "MATERIAL", nama: "Sekrup 4cm Philips", hargaBeli: 122, hargaJual: 400, stokAwal: 3600 },
  { kategori: "MATERIAL", nama: "Sekrup 5cm Philips", hargaBeli: 202, hargaJual: 500, stokAwal: 2500 },
  { kategori: "MATERIAL", nama: "Sekrup 7cm Philips", hargaBeli: 168, hargaJual: 2000, stokAwal: 1266 },
  { kategori: "MATERIAL", nama: "Sekrup 2,5cm Gipsum", hargaBeli: 167, hargaJual: 350, stokAwal: 6600 },
  { kategori: "MATERIAL", nama: "Sekrup 3cm Gipsum", hargaBeli: 103, hargaJual: 400, stokAwal: 5500 },
  { kategori: "MATERIAL", nama: "Sekrup 4cm Gipsum", hargaBeli: 160, hargaJual: 400, stokAwal: 3600 },
  { kategori: "MATERIAL", nama: "Sekrup 5cm Gipsum", hargaBeli: 149, hargaJual: 500, stokAwal: 5100 },
  { kategori: "MATERIAL", nama: "Fisher S6", hargaBeli: 140, hargaJual: 300, stokAwal: 9582 },
  { kategori: "MATERIAL", nama: "Fisher S8", hargaBeli: 50, hargaJual: 300, stokAwal: 1588 },
  { kategori: "MATERIAL", nama: "Vinyl Putih 2,5cm", hargaBeli: 810, hargaJual: 1500, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Sealant Clear", hargaBeli: 29917, hargaJual: 45000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Sealant White", hargaBeli: 36025, hargaJual: 49000, stokAwal: 363 },
  { kategori: "MATERIAL", nama: "Sealant Black", hargaBeli: 33689, hargaJual: 45000, stokAwal: 0 },
  { kategori: "MATERIAL", nama: "Hidrolik / Gas Spring", hargaBeli: 13600, hargaJual: 15600, stokAwal: 26 },
  { kategori: "MATERIAL", nama: "Tahanan Ambalan", hargaBeli: 160, hargaJual: 700, stokAwal: 897 },
  { kategori: "MATERIAL", nama: "Lem Tetes", hargaBeli: 2300, hargaJual: 8000, stokAwal: 186 },
  { kategori: "MATERIAL", nama: "Lem Putih Kayu", hargaBeli: 28000, hargaJual: 33000, stokAwal: 21 },
  { kategori: "MATERIAL", nama: "Isi Cutter Kenko", hargaBeli: 4041, hargaJual: 9100, stokAwal: 91 },
  { kategori: "MATERIAL", nama: "Lakban Kertas", hargaBeli: 4881, hargaJual: 10000, stokAwal: 153 },

  // AKSESORIS (7)
  { kategori: "AKSESORIS", nama: "Rak Piring Atas 60 + Tatakan", hargaBeli: 152000, hargaJual: 162000, stokAwal: 8 },
  { kategori: "AKSESORIS", nama: "Rak Piring Bawah 30 + Tatakan", hargaBeli: 140000, hargaJual: 163000, stokAwal: 11 },
  { kategori: "AKSESORIS", nama: "Rak Sendok Besar", hargaBeli: 79000, hargaJual: 102000, stokAwal: 18 },
  { kategori: "AKSESORIS", nama: "Rak Sendok Kecil", hargaBeli: 58000, hargaJual: 81000, stokAwal: 10 },
  { kategori: "AKSESORIS", nama: "Ventilasi Silver 5x15", hargaBeli: 8753, hargaJual: 10000, stokAwal: 65 },
  { kategori: "AKSESORIS", nama: "Rak Piring 2 Susun + Tatakan", hargaBeli: 140000, hargaJual: 163000, stokAwal: 0 },
  { kategori: "AKSESORIS", nama: "Rak Piring Bawah 30 SS", hargaBeli: 641000, hargaJual: 680000, stokAwal: 1 },

  // KELISTRIKAN (16)
  { kategori: "KELISTRIKAN", nama: "LED STP WW", hargaBeli: 35000, hargaJual: 86000, stokAwal: 88 },
  { kategori: "KELISTRIKAN", nama: "LED STP WH", hargaBeli: 35000, hargaJual: 86000, stokAwal: 0 },
  { kategori: "KELISTRIKAN", nama: "Down LED WW", hargaBeli: 12400, hargaJual: 32400, stokAwal: 10 },
  { kategori: "KELISTRIKAN", nama: "Down LED WH", hargaBeli: 12400, hargaJual: 32400, stokAwal: 21 },
  { kategori: "KELISTRIKAN", nama: "Rumah Lampu/Batang LED", hargaBeli: 60000, hargaJual: 83000, stokAwal: 292 },
  { kategori: "KELISTRIKAN", nama: "Trafo 5A", hargaBeli: 51000, hargaJual: 66000, stokAwal: 50 },
  { kategori: "KELISTRIKAN", nama: "Trafo 10A", hargaBeli: 64500, hargaJual: 81000, stokAwal: 111 },
  { kategori: "KELISTRIKAN", nama: "Trafo 15A", hargaBeli: 87000, hargaJual: 104000, stokAwal: 98 },
  { kategori: "KELISTRIKAN", nama: "Saklar Jempol", hargaBeli: 4600, hargaJual: 9500, stokAwal: 202 },
  { kategori: "KELISTRIKAN", nama: "Stop Kontak Tanam", hargaBeli: 15054, hargaJual: 23000, stokAwal: 28 },
  { kategori: "KELISTRIKAN", nama: "Kabel Putih", hargaBeli: 4950, hargaJual: 10000, stokAwal: 910 },
  { kategori: "KELISTRIKAN", nama: "Kabel Merah Hitam", hargaBeli: 4200, hargaJual: 6000, stokAwal: 1270 },
  { kategori: "KELISTRIKAN", nama: "Isolasi Hitam", hargaBeli: 6417, hargaJual: 12000, stokAwal: 104 },
  { kategori: "KELISTRIKAN", nama: "Terminal Tunggal", hargaBeli: 5410, hargaJual: 10000, stokAwal: 49 },
  { kategori: "KELISTRIKAN", nama: "Steker", hargaBeli: 3612, hargaJual: 6000, stokAwal: 72 },
  { kategori: "KELISTRIKAN", nama: "Dop Kabel Hitam", hargaBeli: 10000, hargaJual: 15000, stokAwal: 0 },
];

type ReviewRow = { nama: string; alasan: string };

function parseLocationRows(raw: string, location: "DEPOK" | "LK"): SourceItem[] {
  return raw
    .trim()
    .split("\n")
    .map((line, index) => {
      const [kategori, sourceName, buy, sell, stock = "0"] = line.split("|").map((value) => value.trim());
      if (!kategori || !sourceName || !buy || !sell) {
        throw new Error(`Format dataset ${location} baris ${index + 1} tidak lengkap.`);
      }
      return {
        kategori: kategori as ItemCategory,
        nama: `${sourceName} (${location})`,
        hargaBeli: Number(buy),
        hargaJual: Number(sell),
        stokAwal: Number(stock),
      };
    });
}

const DEPOK_DATA = parseLocationRows(`
BAHAN UTAMA|Multi Polos 6mm|99000|105000|0
BAHAN UTAMA|Multi Polos 9mm|145000|167000|0
BAHAN UTAMA|Multi Polos 12mm|182000|202000|0
BAHAN UTAMA|Multi Polos 18mm|259000|274000|0
BAHAN UTAMA|Multi Melamin 6mm|160000|180000|0
BAHAN UTAMA|Multi Melamin 9mm|184000|207500|0
BAHAN UTAMA|Multi Melamin 12mm|242000|265000|0
BAHAN UTAMA|Multi Melamin 15mm|272000|297000|0
BAHAN UTAMA|Multi Melamin 18mm|309000|334000|0
BAHAN UTAMA|Multi Melamin Double 18mm|375000|400000|0
BAHAN UTAMA|Block Board Polos 15mm|211000|236000|5
BAHAN UTAMA|Block Board Polos 18mm|229000|254000|0
BAHAN UTAMA|Block Board Melamin 18mm SF|273000|297000|0
BAHAN UTAMA|Block Board Melamin Double 18mm DF|340000|365000|0
BAHAN UTAMA|PVC 18mm|662000|697000|0
BAHAN UTAMA|PVC 12mm|506000|540000|0
BAHAN UTAMA|PVC 9mm|383000|403000|0
BAHAN UTAMA|PVC 6mm|284000|299000|0
`, "DEPOK");

const LK_DATA = parseLocationRows(`
BAHAN UTAMA|Multi Polos 3mm|77000|98000
BAHAN UTAMA|Multi Polos 6mm|110000|122000
BAHAN UTAMA|Multi Polos 9mm|157000|179000
BAHAN UTAMA|Multi Polos 12mm|270000|285000
BAHAN UTAMA|Multi Polos 15mm|227000|250000
BAHAN UTAMA|Multi Polos 18mm|258000|283000
BAHAN UTAMA|Multi Melamin 6mm|175000|185000
BAHAN UTAMA|Multi Melamin 9mm|220000|232000
BAHAN UTAMA|Multi Melamin 12mm|270000|285000
BAHAN UTAMA|Multi Melamin 15mm|290000|320000
BAHAN UTAMA|Multi Melamin 18mm|330000|355000
BAHAN UTAMA|Multi Melamin 18mm Double|405000|430000
BAHAN UTAMA|Block Board Melamin 15mm|210000|230000
BAHAN UTAMA|Block Board 18mm|220000|232000
BAHAN UTAMA|Block Board Melamin 18mm SF|285000|301000
BAHAN UTAMA|Block Board Melamin Double 18mm DF|355000|377000
BAHAN UTAMA|PVC 18mm|699000|735000
BAHAN UTAMA|PVC 15mm|590000|625000
BAHAN UTAMA|PVC 12mm|468000|493000
BAHAN UTAMA|PVC 9mm|352000|372000
BAHAN UTAMA|PVC 6mm|220000|235000
BAHAN UTAMA|PVC 3mm|143000|173000
BAHAN UTAMA|WPC LAIV LW 102|120000|130000
BAHAN UTAMA|WPC F19|191000|216000
BAHAN UTAMA|WPC F09|206000|231000
BAHAN UTAMA|WPC F07|175000|200000
BAHAN UTAMA|WPC W06|154000|175000
BAHAN UTAMA|WPC F02|175000|200000
BAHAN UTAMA|WPC 7105|80000|98000
BAHAN UTAMA|WPC KA-1|85000|115000
BAHAN UTAMA|Wallboard WW 23|195000|230000
BAHAN UTAMA|Wallboard WL 02|211000|246000
BAHAN UTAMA|Wallboard CW 4611|120000|140000
BAHAN UTAMA|Ongkir|45000|45000
BAHAN UTAMA|MDF Hijau 3mm|68000|98000
BAHAN UTAMA|Wallboard Roshan|1100000|1200000
BAHAN UTAMA|WPC PL 04|182000|207000
BAHAN UTAMA|WPC L Corner|76000|101000
MATERIAL|Lem Optima Q-bond 2,5 kg|200000|215000
MATERIAL|Lem Optima Q-bond 14 kg|915000|970000
MATERIAL|Engsel Lurus Hubben SS Slowmo|45000|50000
MATERIAL|Engsel Lurus 1/2 Hubben SS Slowmo Bengkok|45000|50000
MATERIAL|Engsel Lurus Harfit|17000|23000
MATERIAL|Engsel Lurus SS Harfit|45000|52000
MATERIAL|Engsel 1/2 SS Harfit|45000|52000
MATERIAL|Engsel Full Bengkok SS Harfit|45000|52000
MATERIAL|Engsel Kaca Lurus|32000|35000
MATERIAL|Engsel Robot L Hubben Slowmo|62000|70000
MATERIAL|Engsel Bifold 135 Derajat Slowmo Lurus|53000|60000
MATERIAL|Engsel Bifold 135 Derajat|25000|50000
MATERIAL|Engsel Menjangan 5cm|22000|30000
MATERIAL|Engsel Sisir Ukuran L|102000|120000
MATERIAL|Engsel Bifold|25000|40000
MATERIAL|Engsel Kodok 90 Derajat|25000|40000
MATERIAL|Engsel 1/2 Bengkok SS Harfit|45000|52000
MATERIAL|Engsel Lipat Folding|33000|40000
MATERIAL|Engsel Pintu Koboy|133000|150000
MATERIAL|Engsel Lipat Meja|56000|66000
MATERIAL|Engsel Kaca 1/2 Bengkok|38000|50000
MATERIAL|Engsel Kupu-Kupu Kecil|5000|7000
MATERIAL|Engsel Pivot|53000|65000
MATERIAL|Push On Kayu|7000|12000
MATERIAL|Push On Single Hubben|5500|7500
MATERIAL|Push On Double Hubben|8000|12000
MATERIAL|Push On Pensil|31500|45000
MATERIAL|Push Single/Magnet|4000|8000
MATERIAL|Rel Laci 30cm Push On|56000|65000
MATERIAL|Rel 25|21000|30000
MATERIAL|Rel 30|25000|30000
MATERIAL|Rel 35 Slowmo Hubben|65000|75000
MATERIAL|Rel 35 Tandem Harfit|108000|120000
MATERIAL|Rel DT Push On 40|62000|75000
MATERIAL|Rel 40 Slowmo Hubben|71000|85000
MATERIAL|Rel 40|33000|40000
MATERIAL|Rel 45 Tandem Harfit|116000|130000
MATERIAL|Rel 45 Slowmo Harfit|67000|75000
MATERIAL|Rel 45 Slowmo Hubben|77000|85000
MATERIAL|Rel 45|35000|45000
MATERIAL|Rel 50|40000|55000
MATERIAL|Rel 50 Slowmo Hubben|83000|90000
MATERIAL|Rel 50 Slowmo Harfit|72000|83000
MATERIAL|Rel 50 Tandem Blumotion Double|405000|450000
MATERIAL|Rel 50cm Tandem Harfit|123000|135000
MATERIAL|Rel 60|50000|55000
MATERIAL|Rel 60 SS|85000|99000
MATERIAL|Rel 70|225000|240000
MATERIAL|Rel DT 80|260000|285000
MATERIAL|Rel Pocket Door 55cm|136500|192000
MATERIAL|Rel Sliding|40000|55000
MATERIAL|Rel Pocket Door|173000|190000
MATERIAL|Rel + Roda Pintu Sliding|205000|225000
MATERIAL|Rel Laci 60cm|48000|60000
MATERIAL|Batang Rel Sliding|37000|52000
MATERIAL|Rel Aluminium Anodize/Rel Pintu Salde|40000|45000
MATERIAL|Roda Mati 6cm|12000|20000
MATERIAL|Roda Hidup 6cm|13000|25000
MATERIAL|Roda Pintu Sliding Orange|22000|35000
MATERIAL|Roda 5cm + Rem|15000|25000
MATERIAL|Roda Nylon 2 Inch|15000|25000
MATERIAL|Roda Caster 2 Inch|26000|32000
MATERIAL|Roda Caster + Rem|31000|38000
MATERIAL|Cincin Hanger/Braket Pipa 25mm|15000|20000
MATERIAL|Batang Hanger/Pipa Bulat|80000|85000
MATERIAL|Paku Isolasi 2,5cm|7500|10000
MATERIAL|Kait Putar/Gantungan Burung|3000|5000
MATERIAL|Sealant Black|31500|47500
MATERIAL|Sealant Abu|27500|45000
MATERIAL|Sealant Clear|27500|35000
MATERIAL|Sealant White|31500|47500
MATERIAL|Sealant Clear No Asam|31500|38000
MATERIAL|Paku Tembak F30 1 Box|40000|55000
MATERIAL|Paku Tembak F15 1 Box|21000|30000
MATERIAL|Paku Tembak F25 1/2 Box|28000|45000
MATERIAL|Fideco FWP 7011 PE 1pcs|90000|125000
MATERIAL|Frame Aluminium FA 128 N|306000|330000
MATERIAL|Frame Gold Mirror Aluminium|230000|250000
MATERIAL|Frame Gold Mirror Aluminium Tarikan|285000|305000
MATERIAL|Handle Aluminium LP 376|145000|170000
MATERIAL|Rumah Lampu|71000|96000
MATERIAL|Tarikan C Gold|22000|30000
MATERIAL|Tarikan Tanam TA|33000|50000
MATERIAL|Tarikan Bulat Gold|17000|23000
MATERIAL|Tarikan Gold|13000|23000
MATERIAL|Tarikan Aluminium|150000|170000
MATERIAL|Tarikan Knop Gold Mirror|9000|15000
MATERIAL|Sekrup Frame Aluminium|3000|5000
MATERIAL|Sekrup 5/8|80|350
MATERIAL|Sekrup 2cm|90|350
MATERIAL|Sekrup 3cm Gypsum|140|400
MATERIAL|Sekrup 5cm Gypsum|220|350
MATERIAL|Sekrup 4cm|160|350
MATERIAL|Sekrup 7cm|520|2000
MATERIAL|Paku Cacing 9mm|27000|35000
MATERIAL|Paku Beton|20000|35000
MATERIAL|Pipa Stainless|31000|50000
MATERIAL|Cincin Hanger Gantung|38000|50000
MATERIAL|Vinyl Putih|2000|3000
MATERIAL|Tahanan Ambalan|500|2000
MATERIAL|Taco Sheet Melamin|45000|55000
MATERIAL|ATL Grendel SS 3 Inch/Slot|10000|15000
MATERIAL|Sambungan Hanger 3 Lubang|27000|35000
MATERIAL|Handle TK-82 Hitam Hubben|11000|20000
MATERIAL|Pipa Stainless 3/4|65000|75000
MATERIAL|Cincin Hanger/Braket Pipa 3/4|12000|20000
MATERIAL|Dus Packing Ukuran 120|360000|380000
MATERIAL|Pipa Oval SS Harfit|31000|40000
MATERIAL|Lis Gold Mirror 4cm|62000|77000
MATERIAL|Lis Gold Mirror|54000|74000
MATERIAL|Lis Gold 4cm|70000|85000
MATERIAL|Ambalan Kaca|3500|10000
MATERIAL|Lakban Kertas|9000|12000
MATERIAL|Handle Aluminium FHD 128|361000|382000
MATERIAL|Lis U Aluminium Hitam|86000|98000
MATERIAL|Ambalan Kaca/Spil Ambalan|500|1000
MATERIAL|Besi L Kunci|1500|2500
MATERIAL|Foam Tape|11000|20000
MATERIAL|Plat Gold 5cm|75000|85000
MATERIAL|Plat Gold 10cm|140000|160000
MATERIAL|Plat Gold 4cm|62000|75000
MATERIAL|Plat Gold 2,5cm|41000|55000
MATERIAL|Plat U Hitam|75000|90000
MATERIAL|Switch Sliding Square/Suit Piramida|33000|50000
MATERIAL|Siku Frame|6000|10000
MATERIAL|Siku Ambalan SS|10000|15000
MATERIAL|Lem Tetes Korea|8000|12000
MATERIAL|Kunci Laci|15000|23000
MATERIAL|Isi Cutter|8500|10000
MATERIAL|Lidah Kunci Tajam|1500|3000
MATERIAL|Double Tape|9000|14000
MATERIAL|Bracket Gantung|38000|49000
MATERIAL|Pipa Hanger|31000|40000
MATERIAL|Taco Sheet P-209|45000|60000
MATERIAL|Grendel SS Harfit|22000|32000
MATERIAL|Fisher S6|400|700
MATERIAL|Siku Lipat 30cm|60000|75000
MATERIAL|Handle TA-17 Gold 9cm|19000|25000
MATERIAL|Rel Laci 20cm|21000|32000
MATERIAL|Tip On TO-3|11000|19000
MATERIAL|Ducting TC2|10000|15000
MATERIAL|Handle C 20cm|22000|32000
MATERIAL|Kunci Laci Panjang|40000|50000
MATERIAL|Handle Tanam TA-41|27000|35000
MATERIAL|Rel Sliding Atas|95000|125000
MATERIAL|Rel Sliding Bawah|37000|52000
MATERIAL|Frame Aluminium FHD 127 Black|403000|425000
MATERIAL|Sekrup 2,5|110|350
MATERIAL|Sliding Back|12000|20000
MATERIAL|Selot|12000|20000
AKSESORIS|Rak Piring Atas 60 SS|187500|215000
AKSESORIS|Rak Piring Atas 90 + Tatakan|175000|185000
AKSESORIS|Rak Piring Atas 90 SS|303000|325000
AKSESORIS|Rak Sendok Besar|90000|98000
AKSESORIS|Ventilasi Aluminium Silver 5x15|10000|12000
AKSESORIS|Rak Piring Bawah 30 SS|641000|680000
AKSESORIS|Rak Piring Atas 80|135000|155000
AKSESORIS|Rak Piring Sudut Putar SS|650000|690000
AKSESORIS|Rak Piring Atas 70 SS|240000|265000
AKSESORIS|Ventilasi Aluminium Silver 5x15 Hitam|11000|13000
AKSESORIS|Rak Piring Atas 80 SS|250000|270000
AKSESORIS|Rak Piring Elevator 90|2800000|3000000
AKSESORIS|Rak Piring Elevator 80|3036000|3236000
AKSESORIS|Rak Piring Atas 90 + Rak Piring Gelas + Tatakan|213000|231000
AKSESORIS|Batang LED|83000|95000
AKSESORIS|Vinyl Edging 2,5cm Black Taco|6500|10000
AKSESORIS|Wardrobe Slow Black 80cm|615000|670000
AKSESORIS|Edging Aluminium EA-17 Hitam|40000|60000
KELISTRIKAN|Down LED WW|17500|32400
KELISTRIKAN|Kabel Tunggal/Kabel Big NYM|16000|21000
KELISTRIKAN|Trafo 20A|133000|199000
KELISTRIKAN|LED Strip COB WW|90000|102000
KELISTRIKAN|Stop Kontak Pop Up Hitam|260000|280000
KELISTRIKAN|LED Strip WW|50000|85000
KELISTRIKAN|Down LED Kecil WW|32000|38000
KELISTRIKAN|Trafo 5A|57500|70000
KELISTRIKAN|Isolasi Hitam|12000|18000
KELISTRIKAN|Stop Kontak Tanam|20000|28500
KELISTRIKAN|Terminal Taman|20000|30000
KELISTRIKAN|Kabel Putih|16000|17000
KELISTRIKAN|Saklar Jempol|7000|10000
KELISTRIKAN|Trafo 10A|80000|85000
KELISTRIKAN|LED STP Blue|65000|85000
KELISTRIKAN|LED STP Red|85000|102000
KELISTRIKAN|Kabel Tunggal 3 Cabang|12000|18000
KELISTRIKAN|Ducting Kabel|18000|27000
KELISTRIKAN|Trafo 16A|96000|110000
HPL|TACO TH 003 AA|160000|168500
HPL|TACO TH 366 H|190500|201000
HPL|TACO TH 053 D|210000|223000
HPL|TACO TH 5027 NT|234000|295500
HPL|TACO TH 053 AA|160000|168500
HPL|TACO TI Q8005 MR Gold Mirror|1838000|1929000
HPL|TACO TH 064 SA|170000|181000
HPL|TACO TH 225 AC|198000|208500
HPL|TACO TH 193 DP|287000|301500
HPL|TACO TH 051 AA|155500|164000
HPL|TACO TH 131 AA|198000|208500
HPL|TACO TH 037 AA|160000|168500
HPL|TACO TH 069 SA|170000|181000
HPL|TACO TH 006 AA|160000|168500
HPL|TACO TH 5021 NT|234000|246500
HPL|TACO TH 852 J|234000|295500
HPL|TACO TH 890 FC|222500|235000
HPL|TACO TH 305 H|190500|201000
HPL|TACO TH 034 AA|160000|168500
HPL|CARTA CT 0114 T|158000|167000
HPL|TACO TH 048 D|205000|216000
HPL|TACO TH 231 AC|198000|208500
HPL|TACO TH 057 AB|170000|201000
HPL|TACO TH 263 AC|198000|208500
HPL|TACO TH 017 AA|160000|168500
HPL|TACO TH 109 AA|190500|201000
HPL|HAK 14144 ZM83|1550000|1650000
HPL|XKAF 14144 ZGN Long|1550000|1650000
HPL|TACO TH 056 AA|155500|164000
HPL|TACO TH 5032 NT|234000|295500
HPL|AICA MB 69027 S|210000|225000
HPL|TACO TH 849 NT|225500|238000
HPL|TACO TH 057 DB|210000|224000
HPL|TACO TH 014 AA|160000|168500
HPL|TACO TH 5026 NT|234000|246500
HPL|TACO TH 052 AA|160000|168500
HPL|WPC LW-102 Kilim Beige|120000|140000
HPL|XKAF 14165 ZMN|1510000|1650000
HPL|TI X0133 VA|390000|480000
HPL|XKAF 14161 ZMN|960000|1010000
HPL|TACO TH 1218 FC|234000|246500
HPL|XKKF 6200 ZMN|960000|1010000
HPL|CERARL HAK 14194 ZM83|1300000|1380000
HPL|TACO TH 103 AA|190500|201000
HPL|TACO TH 235 AC|198000|208500
HPL|TACO TH 054 AA|160000|168500
HPL|TACO TH 022 AA|155500|164000
HPL|TACO TH 040 AA|155500|164000
HPL|TACO TH 073 SB|202000|215000
HPL|TACO TH 1239 FA|333000|358000
HPL|XKAF 6200 ZMN|960000|1010000
HPL|TACO TH 063 SA|170000|181000
HPL|TACO TH 321 NT|225500|238000
HPL|TACO TH 055 D|202000|216000
HPL|TACO TH 876 RE|314000|332000
HPL|TACO TH 029 AA|165000|173500
HPL|XKAF 14202 ZMN|1510000|1650000
HPL|TACO TH 356 H|190500|201000
HPL|TACO TH 192 DP|287000|345000
HPL|XKAF 14194 ZMN|960000|1010000
HPL|TACO TH 062 SA|164000|175000
HPL|TACO TH 276 B|190500|201000
HPL|TACO TH 009 D|215000|228000
HPL|TACO TH 824 NT|225500|238000
HPL|TACO TH 878 J|234000|295500
HPL|TACO TH 375 H|190500|201000
HPL|CT 1614 G|263000|280000
HPL|XKAF 14038 ZMN|960000|1010000
HPL|TACO TH 236 AC|198000|285000
HPL|HAK 14038 ZM83 Long|1550000|1650000
HPL|XKAF 14166 ZMN Long|1510000|1650000
HPL|XKAF 14165 ZMN Long|1510000|1650000
HPL|XKAF 14194 ZMN Long|1510000|1650000
HPL|MB 69025 GMF|235000|255000
HPL|TACO TH 074 SB|202000|215000
HPL|TI X0131 UD|390000|410000
HPL|TACO TH 023 AC|190500|201000
HPL|TACO TH 802 NT|225500|238000
HPL|TACO TH 212 NA|190500|201000
HPL|TACO TH 041 AA|155500|164000
HPL|TACO TH 215 AA|190500|201000
HPL|TACO TH 7001 J|225500|238000
HPL|TACO TH 001 AA|130500|164000
HPL|TACO TH 022 G|205000|216000
HPL|TACO TH 224 AC|190500|201000
HPL|TACO TH 903 NT|234000|295500
HPL|TACO TH 119 AA|190500|201000
HPL|AICA MB 3048 DJ67|225000|238000
HPL|TACO TH 009 AA|160000|168500
HPL|TACO TH 229 AC|198000|208500
HPL|XKAF 14172 ZMN|1510000|1650000
HPL|TACO TH 014 D|210000|223000
HPL|XKAF 6000 ZMN|960000|1010000
HPL|XKAF 14145 ZMN|960000|1010000
HPL|TACO TH 1235 FA|333000|358000
HPL|TACO TH 002 G|210000|226000
HPL|TACO TH 003 G|202000|218000
HPL|XKAF 1996 ZMN|960000|1010000
HPL|TACO TH 846 J|225500|238000
HPL|TACO TH 180 AA|190500|201000
HPL|TACO TH 233 AC|190500|201000
HPL|XKAF 14198 ZMN|1466000|1650000
HPL|TACO TH 022 D|210000|223000
HPL|TACO TH 1202 NT|234000|271500
HPL|TACO TH 007 AA|155500|164000
HPL|TACO TH 009 G|202000|215000
HPL|TACO TH 016 AA|130500|164000
HPL|TACO TH 030 AA|160000|168500
HPL|TACO TH 226 AC|198000|208500
HPL|TACO TH 040 G|202000|215000
HPL|TACO TH 130 AA|190500|201000
HPL|TACO TH 1038 B|190500|201000
HPL|TACO TH 076 SB|210000|223000
HPL|TACO TH 048 AA|155500|164000
HPL|TACO TH 003 D|210000|223000
HPL|TACO TH 923 JG|270500|295000
HPL|TACO TH 017 D|210000|223000
HPL|TOUGHTOP HAK 14194 ZMB3|1210000|1380000
HPL|TACO TH 1225 NT|234000|295500
HPL|XKAF 14201 ZMN|1510000|1650000
HPL|CERARL XKAF 14197 ZMN|1466000|1650000
HPL|TACO TH 1206 FC|234000|247000
HPL|TACO TH 5037 NT|234000|246500
HPL|XKAF 14146 ZMN|1510000|1650000
HPL|XKAF 14196 ZMN|1510000|1650000
HPL|XKAF 14041 ZMN|960000|1010000
HPL|XKAF 1873 ZMN|960000|1010000
HPL|TACO TH 014 G|210000|223000
HPL|AICA AS 14130 CS 16|410000|450000
HPL|AICA AS 13031 CN74|385000|410000
HPL|XKAF 1966 ZMN|960000|1010000
HPL|TACO TH 5033 NT|234000|295500
HPL|TACO TH 217 AA|198000|208500
HPL|TACO TH 5023 NT|234000|295500
HPL|TACO TH 5034 NT|234000|295500
HPL|XKJF 14015 ZSN98|960000|1010000
HPL|TACO TH 872 RE|314000|334000
HPL|HAK 14158 ZM83|1210000|1315000
HPL|TACO TH 845 J|234000|295500
HPL|TACO TH 1224 FC|234000|295500
HPL|TACO TH 223 AC|198000|208500
HPL|TACO TH 029 G|210000|223000
HPL|TACO TH 065 SA|170000|181000
HPL|TACO TH 030 G|210000|223000
HPL|TACO TH 067 SA|170000|181000
HPL|TACO TH 1216 NT|234000|295500
HPL|CT 1416 G|263000|285000
HPL|TACO TH 066 SA|170000|181000
HPL|TACO TH 228 AC|198000|208500
HPL|TACO TH 261 B|198000|208500
HPL|TACO TH 072 SA|170000|181000
HPL|TACO TH 7012 JG|287000|302000
HPL|TACO TH 005 AA|160000|168500
HPL|TACO TH 036 AA|160000|168500
HPL|TACO TH 5029 NT|234000|295500
HPL|TACO TH 5012 NT|234000|295500
HPL|XKAF 14161 ZMN Long|1510000|1650000
HPL|CT 0114 T|158000|166000
HPL|TACO TH 068 SA|170000|181000
`, "LK");

const REVIEW_ROWS: ReviewRow[] = [
  { nama: "Block Board Polos 15mm (LK)", alasan: "Harga beli dan harga jual tidak tersedia." },
  { nama: "TACO TH 050 AA (LK)", alasan: "Harga beli Rp16.000 tampak salah dan ditahan untuk konfirmasi." },
  { nama: "TACO TH 887 JG (LK)", alasan: "Dua sumber harga berbeda: Rp287.000/Rp299.500 dan Rp278.000/Rp298.000." },
];

function sameSourceItem(left: SourceItem, right: SourceItem): boolean {
  return left.kategori === right.kategori &&
    left.hargaBeli === right.hargaBeli &&
    left.hargaJual === right.hargaJual &&
    left.stokAwal === right.stokAwal;
}

function prepareData(rows: SourceItem[]): { data: SourceItem[]; review: ReviewRow[]; deduplicated: number } {
  const accepted = new Map<string, SourceItem>();
  const conflicts = new Set<string>();
  const review: ReviewRow[] = [];
  let deduplicated = 0;

  for (const row of rows) {
    const key = normalizedName(row.nama);
    if (conflicts.has(key)) continue;
    const previous = accepted.get(key);
    if (!previous) {
      accepted.set(key, row);
      continue;
    }
    if (sameSourceItem(previous, row)) {
      deduplicated += 1;
      continue;
    }
    accepted.delete(key);
    conflicts.add(key);
    review.push({ nama: row.nama, alasan: "Duplikat dataset memiliki kategori, harga, atau stok berbeda." });
  }

  return { data: [...accepted.values()], review, deduplicated };
}

const prepared = prepareData([...MAIN_DATA, ...DEPOK_DATA, ...LK_DATA]);
const DATA = prepared.data;
const ALL_REVIEW_ROWS = [...REVIEW_ROWS, ...prepared.review];

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
    if (item.hargaJual < item.hargaBeli) {
      throw new Error(`Harga jual lebih kecil dari harga beli: ${item.nama}`);
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
    return {
      kind: changed ? "UPDATE" as const : "UNCHANGED" as const,
      source,
      current,
      stockPreserved: current.stokAwal !== source.stokAwal,
    };
  });

  const counts = Object.fromEntries(["CREATE", "UPDATE", "UNCHANGED"].map((kind) => [kind, plan.filter((p) => p.kind === kind).length]));
  const preservedStock = plan.filter((entry) => entry.kind !== "CREATE" && entry.stockPreserved).length;
  console.log(`${APPLY ? "TERAPKAN" : "DRY-RUN"} master barang: ${DATA.length} baris`);
  console.log(`Buat: ${counts.CREATE} | Perbarui: ${counts.UPDATE} | Tetap: ${counts.UNCHANGED}`);
  console.log(`Utama: ${MAIN_DATA.length} | Depok: ${DEPOK_DATA.length} | LK diterima: ${DATA.length - MAIN_DATA.length - DEPOK_DATA.length}`);
  console.log(`Stok lama dipertahankan: ${preservedStock} | Duplikat identik digabung: ${prepared.deduplicated}`);
  for (const category of ITEM_CATEGORIES) {
    console.log(`- ${category}: ${DATA.filter((item) => item.kategori === category).length}`);
  }
  for (const entry of plan) {
    if (entry.kind === "CREATE") console.log(`+ ${entry.code} | ${entry.source.kategori} | ${entry.source.nama}`);
    if (entry.kind === "UPDATE") console.log(`~ ${entry.current.kode} | ${entry.source.kategori} | ${entry.source.nama}`);
    if (entry.kind !== "CREATE" && entry.stockPreserved) {
      console.log(`= stok dipertahankan ${entry.current.kode}: DB ${entry.current.stokAwal}, sumber ${entry.source.stokAwal}`);
    }
  }
  if (ALL_REVIEW_ROWS.length > 0) {
    console.log(`\nDitahan untuk pemeriksaan: ${ALL_REVIEW_ROWS.length}`);
    for (const row of ALL_REVIEW_ROWS) console.log(`! ${row.nama} | ${row.alasan}`);
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

    if (counts.CREATE > 0 || counts.UPDATE > 0) {
      await tx.activityLog.create({
        data: {
          aksi: "IMPORT_MASTER_BARANG",
          entitas: "Item",
          entitasId: "master-items-2026-10-13",
          detail: JSON.stringify({
            totalDiterima: DATA.length,
            dibuat: counts.CREATE,
            diperbarui: counts.UPDATE,
            tetap: counts.UNCHANGED,
            stokDipertahankan: preservedStock,
            ditahan: ALL_REVIEW_ROWS,
          }),
        },
      });
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
