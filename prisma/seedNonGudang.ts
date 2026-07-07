/**
 * Seed HANYA modul Non-Gudang.
 * Menghapus data Ng* (NgProduk/NgInvoice/NgInvoiceItem/NgPayment/NgKonsumen),
 * counter `ng_invoice`, dan ActivityLog entitas non-gudang — LALU mengisi dummy.
 * TIDAK menyentuh data gudang (Item/Transaction/Invoice/StockLedger/dll).
 *
 * Jalankan: npm run db:seed:ng
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ============ CONFIG ============
const NUM_PRODUK = 120;
// Distribusi invoice lintas periode agar filter (Minggu/Bulan/Tahun/Custom) bisa diuji.
const COUNT_2024 = 30; // tahun lalu-2
const COUNT_2025 = 45; // tahun lalu
const COUNT_THIS_YEAR = 55; // tahun berjalan: 1 Jan s/d hari ini
const COUNT_THIS_WEEK = 15; // khusus MINGGU INI (Senin s/d hari ini)

// ============ HELPERS ============
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randMoney(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) / 500) * 500;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

const DB_PERCENT_MAX = 9999.99;
function percentDb(v: number) {
  return new Prisma.Decimal(Math.min(DB_PERCENT_MAX, Math.max(0, v)));
}

// ============ DATA POOLS ============
const TOKO_SUMBER = [
  "Toko Besi Jaya Makmur",
  "UD Sumber Logam Sentosa",
  "Toko Bangunan Sinar Abadi",
  "CV Mitra Baja Nusantara",
  "Toko Cat Warna Indah",
  "Distributor Pipa Tirta Jaya",
  "Toko Listrik Terang Benderang",
  "UD Kayu Rimba Lestari",
  "Toko Keramik Megah Granit",
  "Grosir Material Berkah Abadi",
];

const PREFIX = [
  "Besi Beton", "Pipa PVC", "Cat Tembok", "Kayu Meranti", "Triplek", "Paku",
  "Kawat Bendrat", "Semen Instan", "Keramik Lantai", "Kabel NYA", "Saklar",
  "Stop Kontak", "Engsel Pintu", "Kunci Pintu", "Baut", "Mur", "Sekrup Gypsum",
  "Lem Kayu", "Sealant", "Cat Kayu", "Kuas Roll", "Amplas", "Gergaji Besi",
  "Palu", "Tang", "Obeng Set", "Bor Listrik", "Gerinda", "Selang Air", "Kran Air",
];
const BRAND = [
  "SNI", "Tiga Roda", "Wavin", "Dulux", "Avian", "Nippon", "Eterna", "Bosch",
  "Maktec", "Krisbow", "Tekiro", "Onda", "Broco", "Panasonic", "Supreme",
  "Master", "Roman", "Platinum", "Fuji", "Nagoya",
];
const SIZE = [
  "8mm", "10mm", "12mm", '1/2"', '3/4"', '1"', "2mm", "3mm", "4mm", "9mm", "12mm",
  "2.5kg", "5kg", "1kg", "25kg", "40x40", "60x60", "30x30", "5x7", "4x6",
];
const KATEGORI = ["Struktur", "Sanitasi", "Listrik", "Finishing", "Perkakas", "Kayu & Panel", "Keramik", "Pengikat"];
const SATUAN = ["batang", "lembar", "pcs", "kaleng", "roll", "sak", "meter", "box", "set", "dus"];

const KONSUMEN_NAMA = [
  "Bpk. Andi Pratama", "Ibu Sari Wulandari", "CV Karya Bersama", "Toko Bangunan Jaya",
  "Bpk. Rudi Hartono", "PT Cipta Griya", "Ibu Nina Kartika", "Bpk. Slamet Widodo",
  "UD Makmur Sentosa", "Bpk. Doni Saputra", "Ibu Rina Melati", "CV Bangun Persada",
  "Bpk. Fajar Nugroho", "Toko Material Sejahtera", "Ibu Dewi Anggraini",
];
const GRUP = ["Proyek Ruko", "Renovasi Rumah", "Kontraktor", "Retail", "", "", ""];
const ALAMAT = [
  "Jl. Merdeka No. 12, Bandung", "Jl. Sudirman No. 45, Jakarta", "Perum Griya Asri B/7, Bekasi",
  "Jl. Ahmad Yani No. 88, Cimahi", "Jl. Raya Cibaduyut No. 21, Bandung", "Komp. Permata Blok C2, Depok",
  "Jl. Soekarno Hatta KM 5, Bandung", "Jl. Pahlawan No. 9, Cimahi",
];
const WORKSHOP = ["Bengkel Las Mandiri", "Workshop Kayu Sejati", "", "", "Bengkel Teknik Maju", ""];
const BANKS = [
  { bank: "BCA", an: "PUTRA CORPORATION" },
  { bank: "Mandiri", an: "PUTRA CORPORATION" },
  { bank: "BRI", an: "CV Putra Corp" },
  { bank: "BNI", an: "PUTRA CORPORATION" },
];

// ============ MARGIN COMPUTE (mirror src/lib/ngMargin) ============
type Line = { produkId: number; nama: string; hargaBeli: number; hargaJual: number; qty: number };
function computeCart(lines: Line[]) {
  const computed = lines.map((l) => {
    const qty = Math.max(1, Math.trunc(l.qty || 0));
    const subtotalModal = Math.round(l.hargaBeli * qty);
    const subtotalPenjualan = Math.round(l.hargaJual * qty);
    return { ...l, qty, subtotalModal, subtotalPenjualan, subtotalProfit: subtotalPenjualan - subtotalModal };
  });
  const totalModal = computed.reduce((s, l) => s + l.subtotalModal, 0);
  const totalPenjualan = computed.reduce((s, l) => s + l.subtotalPenjualan, 0);
  const totalProfit = totalPenjualan - totalModal;
  return {
    computed,
    totalModal,
    totalPenjualan,
    totalProfit,
    margin: totalPenjualan > 0 ? round2((totalProfit / totalPenjualan) * 100) : 0,
    markup: totalModal > 0 ? round2((totalProfit / totalModal) * 100) : 0,
  };
}

// ============ MAIN ============
async function main() {
  console.log("🧹 Membersihkan data Non-Gudang (data gudang TIDAK disentuh)...");
  await prisma.ngPayment.deleteMany();
  await prisma.ngInvoiceItem.deleteMany();
  await prisma.ngInvoice.deleteMany();
  await prisma.ngKonsumen.deleteMany();
  await prisma.ngProduk.deleteMany();
  await prisma.counter.deleteMany({ where: { id: "ng_invoice" } });
  await prisma.activityLog.deleteMany({ where: { entitas: { in: ["NgInvoice", "NgProduk", "NgKonsumen"] } } });
  console.log("✅ Data Non-Gudang lama dihapus.\n");

  const ngUser = await prisma.user.findUnique({ where: { username: "nongudang" }, select: { id: true } });
  const userId = ngUser?.id ?? null;
  if (!userId) console.log("⚠️  User 'nongudang' belum ada — invoice dibuat tanpa userId. Jalankan `npm run db:seed` bila perlu.");

  // ---------- PRODUK ----------
  console.log(`📦 Membuat ${NUM_PRODUK} barang non-gudang...`);
  const usedNames = new Set<string>();
  const produkData: Prisma.NgProdukCreateManyInput[] = [];
  for (let i = 0; i < NUM_PRODUK; i++) {
    const toko = pick(TOKO_SUMBER);
    let nama = `${pick(PREFIX)} ${pick(BRAND)} ${pick(SIZE)}`;
    let attempt = 0;
    while (usedNames.has(`${toko}::${nama}`)) {
      attempt++;
      nama = `${pick(PREFIX)} ${pick(BRAND)} ${pick(SIZE)} v${attempt}`;
    }
    usedNames.add(`${toko}::${nama}`);
    const hargaBeli = randMoney(8000, 850000);
    const margin = rand(8, 40);
    const hargaJual = Math.round((hargaBeli * (1 + margin / 100)) / 500) * 500;
    produkData.push({
      nama,
      namaToko: toko,
      kategori: pick(KATEGORI),
      satuan: pick(SATUAN),
      hargaBeli: new Prisma.Decimal(hargaBeli),
      hargaJual: new Prisma.Decimal(hargaJual),
      aktif: Math.random() > 0.08, // ~92% aktif
    });
  }
  await prisma.ngProduk.createMany({ data: produkData });
  const allProduk = await prisma.ngProduk.findMany({
    where: { aktif: true },
    select: { id: true, nama: true, namaToko: true, hargaBeli: true, hargaJual: true },
  });
  // Index produk aktif per toko
  const produkByToko = new Map<string, typeof allProduk>();
  for (const p of allProduk) {
    const arr = produkByToko.get(p.namaToko) ?? [];
    arr.push(p);
    produkByToko.set(p.namaToko, arr);
  }
  const tokoWithStock = [...produkByToko.keys()];
  console.log(`  ✅ ${produkData.length} barang (${allProduk.length} aktif) di ${tokoWithStock.length} toko sumber.\n`);

  // ---------- KONSUMEN ----------
  console.log("👥 Membuat master konsumen non-gudang...");
  const konsumenData: Prisma.NgKonsumenCreateManyInput[] = KONSUMEN_NAMA.map((nama) => ({
    nama,
    namaGrup: pick(GRUP) || null,
    alamat: pick(ALAMAT),
    namaWorkshop: pick(WORKSHOP) || null,
  }));
  await prisma.ngKonsumen.createMany({ data: konsumenData });
  const allKonsumen = await prisma.ngKonsumen.findMany();
  console.log(`  ✅ ${allKonsumen.length} konsumen.\n`);

  // ---------- INVOICE ----------
  console.log("🧾 Membuat invoice non-gudang lintas periode (2024/2025/tahun ini + minggu ini)...");
  let counter = 0;
  const stat = { LUNAS: 0, PENDING: 0, PARTIAL: 0, terlambat: 0 };

  async function makeInvoice(tanggal: Date) {
    const toko = pick(tokoWithStock);
    const pool = produkByToko.get(toko)!;
    if (!pool || pool.length === 0) return;

    // 1-6 produk unik dari toko ini
    const numItems = Math.min(rand(1, 6), pool.length);
    const chosen = new Set<number>();
    const lines: Line[] = [];
    let guard = 0;
    while (lines.length < numItems && guard < 40) {
      guard++;
      const p = pick(pool);
      if (chosen.has(p.id)) continue;
      chosen.add(p.id);
      lines.push({
        produkId: p.id,
        nama: p.nama,
        hargaBeli: Number(p.hargaBeli),
        hargaJual: Number(p.hargaJual),
        qty: rand(1, 20),
      });
    }
    if (lines.length === 0) return;

    const c = computeCart(lines);

    // Konsumen: 65% dari master, sisanya free-text
    const useMaster = Math.random() < 0.65;
    const master = useMaster ? pick(allKonsumen) : null;
    const namaKonsumen = master ? master.nama : pick(KONSUMEN_NAMA);
    const namaGrup = master ? master.namaGrup : pick(GRUP) || null;
    const alamat = master ? master.alamat : pick(ALAMAT);
    const namaWorkshop = master ? master.namaWorkshop : pick(WORKSHOP) || null;

    // Metode & kondisi bayar
    const isTransfer = Math.random() < 0.5;
    const bank = isTransfer ? pick(BANKS) : null;
    const roll = Math.random();
    let status: "LUNAS" | "PENDING" | "PARTIAL";
    let totalDibayar: number;
    if (roll < 0.45) {
      status = "LUNAS";
      totalDibayar = c.totalPenjualan;
    } else if (roll < 0.72) {
      status = "PENDING";
      totalDibayar = 0;
    } else {
      status = "PARTIAL";
      totalDibayar = Math.round((c.totalPenjualan * (rand(30, 80) / 100)) / 1000) * 1000;
      if (totalDibayar >= c.totalPenjualan) totalDibayar = Math.round(c.totalPenjualan / 2);
      if (totalDibayar <= 0) totalDibayar = Math.min(c.totalPenjualan, 50000);
    }
    const jatuhTempo = status === "LUNAS" ? null : addDays(tanggal, 7);
    if (jatuhTempo && Date.now() > jatuhTempo.getTime()) stat.terlambat++;
    stat[status]++;

    counter++;
    const noInvoice = `NG-${pad(counter, 5)}`;

    await prisma.ngInvoice.create({
      data: {
        noInvoice,
        tanggal,
        status,
        namaToko: toko,
        jatuhTempo,
        konsumenId: master?.id ?? null,
        namaKonsumen,
        namaGrup,
        alamat,
        namaWorkshop,
        namaBank: bank?.bank ?? null,
        noRekening: bank ? `${rand(100, 999)}${rand(1000000, 9999999)}` : null,
        atasNama: bank?.an ?? null,
        totalModal: new Prisma.Decimal(c.totalModal),
        totalPenjualan: new Prisma.Decimal(c.totalPenjualan),
        totalProfit: new Prisma.Decimal(c.totalProfit),
        margin: percentDb(c.margin),
        markup: percentDb(c.markup),
        totalDibayar: new Prisma.Decimal(totalDibayar),
        userId,
        items: {
          create: c.computed.map((l) => ({
            produkId: l.produkId,
            namaSnapshot: l.nama,
            namaTokoSnapshot: toko,
            hargaBeliSnapshot: new Prisma.Decimal(l.hargaBeli),
            hargaJualSnapshot: new Prisma.Decimal(l.hargaJual),
            qty: l.qty,
            subtotalModal: new Prisma.Decimal(l.subtotalModal),
            subtotalPenjualan: new Prisma.Decimal(l.subtotalPenjualan),
            subtotalProfit: new Prisma.Decimal(l.subtotalProfit),
          })),
        },
        payments:
          status === "LUNAS"
            ? {
                create: [
                  {
                    tanggal,
                    tipe: isTransfer ? "TRANSFER" : "CASH",
                    jumlah: new Prisma.Decimal(c.totalPenjualan),
                    keterangan: `Pelunasan awal untuk ${noInvoice}`,
                    userId,
                  },
                ],
              }
            : status === "PARTIAL"
              ? {
                  create: buildPartialPayments(totalDibayar, tanggal, isTransfer, noInvoice, userId),
                }
              : undefined,
      },
    });
  }

  // ---------- DRIVER PER PERIODE ----------
  async function batch(count: number, from: Date, to: Date) {
    for (let i = 0; i < count; i++) await makeInvoice(randomDate(from, to));
  }

  const now = new Date();
  const y = now.getFullYear();

  // Lintas tahun (untuk uji filter Tahun & Custom)
  await batch(COUNT_2024, new Date(2024, 0, 1, 8), new Date(2024, 11, 31, 18));
  await batch(COUNT_2025, new Date(2025, 0, 1, 8), new Date(2025, 11, 31, 18));
  // Tahun berjalan: 1 Jan s/d hari ini (untuk filter Tahun Ini & Bulan Ini)
  await batch(COUNT_THIS_YEAR, new Date(y, 0, 1, 8), now);

  // MINGGU INI: Senin s/d hari ini (mirror logika PeriodFilter "week")
  const diffToMonday = (now.getDay() + 6) % 7;
  const monday = new Date(y, now.getMonth(), now.getDate() - diffToMonday, 8);
  await batch(COUNT_THIS_WEEK, monday, now);
  console.log(`  🗓️  Minggu ini: ${monday.toLocaleDateString("id-ID")} s/d ${now.toLocaleDateString("id-ID")} (${COUNT_THIS_WEEK} invoice).`);

  // ---------- COUNTER ----------
  await prisma.counter.upsert({
    where: { id: "ng_invoice" },
    create: { id: "ng_invoice", prefix: "NG-", value: counter },
    update: { prefix: "NG-", value: counter },
  });

  console.log(`  ✅ ${counter} invoice dibuat.\n`);

  // ---------- SUMMARY ----------
  const totalProduk = await prisma.ngProduk.count();
  const totalInv = await prisma.ngInvoice.count();
  const totalPay = await prisma.ngPayment.count();
  console.log("=========================================");
  console.log("🎉 SEED NON-GUDANG SELESAI");
  console.log("=========================================");
  console.log(`📦 Barang:        ${totalProduk}`);
  console.log(`👥 Konsumen:      ${allKonsumen.length}`);
  console.log(`🧾 Invoice:       ${totalInv}`);
  console.log(`   • Lunas:       ${stat.LUNAS}`);
  console.log(`   • Tempo:       ${stat.PENDING}`);
  console.log(`   • Partial:     ${stat.PARTIAL}`);
  console.log(`   • Terlambat:   ${stat.terlambat} (belum lunas & lewat jatuh tempo)`);
  console.log(`💳 Pembayaran:    ${totalPay}`);
  console.log("=========================================");
  console.log("Login: username 'nongudang' (password sesuai seed utama / SEED_DEFAULT_PASSWORD).");
  console.log("=========================================");
}

function buildPartialPayments(
  totalDibayar: number,
  tanggal: Date,
  isTransfer: boolean,
  noInvoice: string,
  userId: number | null
): Prisma.NgPaymentCreateWithoutInvoiceInput[] {
  // 1-2 cicilan yang totalnya = totalDibayar
  const twoInstallments = Math.random() < 0.5 && totalDibayar > 2000;
  if (!twoInstallments) {
    return [
      {
        tanggal,
        tipe: isTransfer ? "TRANSFER" : "CASH",
        jumlah: new Prisma.Decimal(totalDibayar),
        keterangan: `Pembayaran cicilan untuk ${noInvoice}`,
        userId,
      },
    ];
  }
  const first = Math.round(totalDibayar / 2 / 1000) * 1000 || Math.round(totalDibayar / 2);
  const second = totalDibayar - first;
  return [
    {
      tanggal,
      tipe: isTransfer ? "TRANSFER" : "CASH",
      jumlah: new Prisma.Decimal(first),
      keterangan: `Cicilan ke-1 untuk ${noInvoice}`,
      userId,
    },
    {
      tanggal: addDays(tanggal, rand(1, 5)),
      tipe: "CASH",
      jumlah: new Prisma.Decimal(second),
      keterangan: `Cicilan ke-2 untuk ${noInvoice}`,
      userId,
    },
  ];
}

main()
  .catch((e) => {
    console.error("❌ Error saat seed non-gudang:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
