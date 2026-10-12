/**
 * Seed data DUMMY yang bersifat ADITIF (tidak menghapus data apa pun).
 *
 * Mengisi 100 data per kelompok untuk uji tampilan, laporan, dan ekspor:
 *   - Gudang : 100 barang (kode `DMY-0001..0100`) + ledger stok MASUK
 *   - Kasir  : 100 transaksi POS (ledger KELUAR, snapshot harga) dengan campuran
 *              tanpa invoice / invoice LUNAS / PARTIAL (+cicilan) / PENDING
 *   - Non-Gudang : 100 barang (nama berawalan `DMY `), 100 konsumen
 *                  (nama berawalan `DMY `), dan 100 invoice beserta pembayaran
 *
 * Aturan bisnis yang diikuti (sama dengan aplikasi):
 *   - Stok = stokAwal + SUM(StockLedger.qty); tidak pernah dibuat minus.
 *   - Nomor dokumen memakai counter yang sama (`nextDocNumber`), sehingga nomor
 *     transaksi/invoice berikutnya dari aplikasi tidak bentrok.
 *   - Margin/markup Non-Gudang dihitung dengan `computeNgCart`.
 *
 * Penanda dummy untuk pembersihan: Item.kode `DMY-`, NgProduk.nama & NgKonsumen.nama
 * berawalan `DMY `. Transaksi/invoice dummy terhubung ke data bertanda tersebut.
 *
 * Jalankan: npm run db:seed:dummy        (menolak jalan bila dummy sudah ada)
 */
import { PrismaClient, Prisma, type PaymentType, type NgPaymentType } from "@prisma/client";
import { nextDocNumber } from "../src/lib/counters";
import { computeNgCart } from "../src/lib/ngMargin";
import { ITEM_CATEGORIES } from "../src/lib/itemCategories";

const prisma = new PrismaClient();

const COUNT = 100;
const DAY = 86_400_000;
export const DUMMY_ITEM_PREFIX = "DMY-";
export const DUMMY_NAME_PREFIX = "DMY ";

// ============ HELPERS ============
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function money(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) / 500) * 500;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function sample<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
/** Tanggal acak dalam rentang `fromDaysAgo`..`toDaysAgo` hari lalu, jam kerja 08–17. */
function pastDate(fromDaysAgo: number, toDaysAgo: number): Date {
  const d = new Date(Date.now() - rand(toDaysAgo, fromDaysAgo) * DAY);
  d.setHours(rand(8, 17), rand(0, 59), rand(0, 59), 0);
  return d;
}
function pad(n: number, len = 4) {
  return String(n).padStart(len, "0");
}

// ============ MASTER DATA ============
const GUDANG_NAMES: Record<(typeof ITEM_CATEGORIES)[number], { base: string[]; spec: string[]; price: [number, number] }> = {
  "BAHAN UTAMA": {
    base: ["Multiplek", "Block Board", "MDF", "Particle Board", "HMR Board", "Plywood Meranti"],
    spec: ["9mm", "12mm", "15mm", "18mm", "18mm Melamin Putih", "18mm Melamin Walnut"],
    price: [95_000, 420_000],
  },
  MATERIAL: {
    base: ["Engsel Sendok", "Rel Laci", "Lem Kuning", "Sekrup Gypsum", "Paku Tembak", "Edging PVC"],
    spec: ["Hubben", "Harfit", "35cm", "45cm", "1 kg", "Isi 1000"],
    price: [6_000, 85_000],
  },
  AKSESORIS: {
    base: ["Handle Tarik", "Rak Piring", "Kaki Kabinet", "Tutup Lubang", "Gantungan Baju", "Soft Close"],
    spec: ["Hitam Doff", "Gold", "Stainless", "Putih", "60cm", "80cm"],
    price: [4_000, 190_000],
  },
  KELISTRIKAN: {
    base: ["Lampu LED Strip", "Stop Kontak", "Kabel NYM", "Dop Kabel", "Saklar Sensor", "Adaptor LED"],
    spec: ["Warm White", "Cool White", "2x1.5", "Hitam", "Putih", "12V 5A"],
    price: [3_000, 160_000],
  },
};

const FIRST = ["Budi", "Andi", "Rudi", "Siti", "Dewi", "Agus", "Hendra", "Rina", "Joko", "Wati", "Eko", "Fajar", "Lina", "Yusuf", "Bayu", "Maya", "Taufik", "Nanda", "Irfan", "Sari"];
const LAST = ["Santoso", "Wijaya", "Pratama", "Lestari", "Saputra", "Hidayat", "Kurniawan", "Halim", "Setiawan", "Nugroho"];
const COMPANIES = ["CV Maju Bersama", "PT Karya Interior", "CV Sinar Kayu", "Studio Ruang Kita", "CV Griya Asri", "PT Bangun Prima"];
const WORKSHOPS = ["WS Jaya Mebel", "WS Kayu Indah", "WS Sentosa", "WS Mandiri Interior", "WS Barokah"];
const KOTA = ["Bekasi", "Depok", "Bogor", "Tangerang", "Jakarta Timur", "Jakarta Selatan"];
const BANKS = [
  { namaBank: "BCA", noRekening: "1234567890", atasNama: "PUTRA CORPORATION" },
  { namaBank: "Mandiri", noRekening: "1370012345678", atasNama: "PUTRA CORPORATION" },
];

const NG_TOKO = ["Toko Sinar Jaya", "Toko Kayu Makmur", "Depo Interior", "Toko Lampu Terang", "Toko Besi Abadi", "Grosir Aksesoris Prima"];
const NG_BASE = ["HPL Taco", "Granit Meja", "Kaca Cermin", "Lampu Gantung", "Wastafel", "Kran Dapur", "Kompor Tanam", "Cooker Hood", "Sink Stainless", "Laci Organizer"];
const NG_SPEC = ["Putih Glossy", "Walnut", "Hitam", "60cm", "80cm", "Tipe A", "Tipe B", "Premium", "Standar", "Minimalis"];
const NG_SATUAN = ["pcs", "lembar", "set", "unit", "meter"];

function personName(i: number) {
  return `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
}
function address() {
  return `Jl. ${pick(["Melati", "Kenanga", "Anggrek", "Mawar", "Cempaka", "Flamboyan"])} No. ${rand(1, 120)}, ${pick(KOTA)}`;
}

// ============ GUARD ============
async function ensureNotSeeded() {
  const [items, produk, konsumen] = await Promise.all([
    prisma.item.count({ where: { kode: { startsWith: DUMMY_ITEM_PREFIX } } }),
    prisma.ngProduk.count({ where: { nama: { startsWith: DUMMY_NAME_PREFIX } } }),
    prisma.ngKonsumen.count({ where: { nama: { startsWith: DUMMY_NAME_PREFIX } } }),
  ]);
  if (items + produk + konsumen > 0) {
    throw new Error(
      `Data dummy sudah ada (barang ${items}, NG produk ${produk}, NG konsumen ${konsumen}). ` +
        "Seed dibatalkan agar tidak dobel. Bersihkan dulu dengan `npm run db:clear:dummy`."
    );
  }
}

// ============ GUDANG: BARANG + STOK ============
type SeededItem = { id: number; nama: string; hargaBeli: number; hargaJual: number; stock: number; sellable: boolean };

async function seedItems(gudangUserId: number | null): Promise<SeededItem[]> {
  const seeded: SeededItem[] = [];
  const usedNames = new Set<string>();
  const cats = ITEM_CATEGORIES;

  for (let i = 1; i <= COUNT; i++) {
    const kategori = cats[(i - 1) % cats.length];
    const def = GUDANG_NAMES[kategori];
    let nama = "";
    do nama = `${pick(def.base)} ${pick(def.spec)}`;
    while (usedNames.has(nama) && usedNames.size < def.base.length * def.spec.length * cats.length);
    if (usedNames.has(nama)) nama = `${nama} ${i}`;
    usedNames.add(nama);

    const hargaBeli = money(def.price[0], def.price[1]);
    const hargaJual = Math.round((hargaBeli * (1.1 + Math.random() * 0.35)) / 500) * 500;
    const minStok = rand(5, 20);

    // 8 barang habis, 12 barang menipis (tidak dijual agar tetap di bawah minimum).
    let stockIn: number;
    let sellable = true;
    if (i <= 8) {
      stockIn = 0;
      sellable = false;
    } else if (i <= 20) {
      stockIn = Math.max(1, minStok - rand(1, 4));
      sellable = false;
    } else {
      stockIn = rand(60, 220);
    }

    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          kode: `${DUMMY_ITEM_PREFIX}${pad(i)}`,
          nama,
          kategori,
          hargaBeli,
          hargaJual,
          stokAwal: 0,
          minStok,
          createdAt: pastDate(200, 180),
        },
      });
      if (stockIn > 0) {
        await tx.stockLedger.create({
          data: {
            itemId: item.id,
            tipe: "MASUK",
            qty: stockIn,
            tanggal: pastDate(175, 150),
            keterangan: "Stok awal data dummy",
            refType: "MANUAL",
            userId: gudangUserId,
          },
        });
      }
      return item;
    });
    seeded.push({ id: created.id, nama, hargaBeli, hargaJual, stock: stockIn, sellable });
  }
  return seeded;
}

// ============ KASIR: TRANSAKSI + INVOICE ============
type Mode = "CASH" | "INV_LUNAS" | "INV_PARTIAL" | "INV_PENDING";

async function seedTransactions(items: SeededItem[], kasirUserId: number | null) {
  const modes: Mode[] = [
    ...Array<Mode>(40).fill("CASH"),
    ...Array<Mode>(25).fill("INV_LUNAS"),
    ...Array<Mode>(20).fill("INV_PARTIAL"),
    ...Array<Mode>(15).fill("INV_PENDING"),
  ];
  const stats = { trx: 0, invoices: 0 };

  for (const mode of sample(modes, modes.length)) {
    const sellable = items.filter((it) => it.sellable && it.stock >= 3);
    if (sellable.length === 0) break;

    const lines = sample(sellable, rand(1, 4)).map((it) => ({ it, qty: rand(1, Math.min(10, Math.floor(it.stock / 2))) }));
    const tanggal = pastDate(140, 0);
    const isProject = Math.random() < 0.3;
    const namaClient = isProject ? pick(COMPANIES) : personName(rand(0, 199));
    const alamat = Math.random() < 0.7 ? address() : null;
    const namaWs = Math.random() < 0.5 ? pick(WORKSHOPS) : null;
    const nonCash = mode !== "CASH";
    const bank = nonCash && Math.random() < 0.6 ? pick(BANKS) : null;

    await prisma.$transaction(
      async (tx) => {
        const noTransaksi = await nextDocNumber(tx, "transaksi");
        const grandTotal = lines.reduce((sum, l) => sum + l.it.hargaJual * l.qty, 0);

        const trx = await tx.transaction.create({
          data: {
            noTransaksi,
            tanggal,
            createdAt: tanggal,
            tipe: isProject ? "PROJECT" : "RETAIL",
            namaClient,
            alamat,
            namaWs,
            namaBank: bank?.namaBank ?? null,
            noRekening: bank?.noRekening ?? null,
            atasNama: bank?.atasNama ?? null,
            userId: kasirUserId,
            grandTotal,
          },
        });

        for (const { it, qty } of lines) {
          await tx.transactionItem.create({
            data: {
              transactionId: trx.id,
              itemId: it.id,
              namaSnapshot: it.nama,
              hargaSnapshot: it.hargaJual,
              hargaBeliSnapshot: it.hargaBeli,
              qty,
              subtotal: it.hargaJual * qty,
            },
          });
          await tx.stockLedger.create({
            data: {
              itemId: it.id,
              tanggal,
              tipe: "KELUAR",
              qty: -qty,
              keterangan: `Penjualan POS ${noTransaksi}`,
              refType: "TRANSACTION",
              refId: trx.id,
              userId: kasirUserId,
            },
          });
        }

        // Pembayaran saat checkout
        const payments: { tipe: PaymentType; jumlah: number; tanggal: Date; keterangan: string }[] = [];
        if (mode === "CASH") {
          payments.push({ tipe: "CASH", jumlah: grandTotal, tanggal, keterangan: `Pembayaran CASH untuk ${noTransaksi}` });
        } else if (mode === "INV_LUNAS") {
          const tipe: PaymentType = bank ? "TRANSFER" : "CASH";
          payments.push({ tipe, jumlah: grandTotal, tanggal, keterangan: `Pembayaran ${tipe} untuk ${noTransaksi}` });
        } else if (mode === "INV_PARTIAL") {
          const dp = Math.round((grandTotal * (0.3 + Math.random() * 0.4)) / 1000) * 1000;
          const tipe: PaymentType = bank ? "TRANSFER" : "CASH";
          payments.push({ tipe, jumlah: dp, tanggal, keterangan: `Pembayaran ${tipe} untuk ${noTransaksi}` });
          // Sebagian invoice cicilan sudah menerima angsuran berikutnya (tetap belum lunas).
          const sisa = grandTotal - dp;
          const daysSince = Math.floor((Date.now() - tanggal.getTime()) / DAY);
          if (sisa > 2000 && daysSince > 14 && Math.random() < 0.5) {
            const cicilan = Math.round((sisa * (0.3 + Math.random() * 0.4)) / 1000) * 1000;
            const tglCicil = new Date(tanggal.getTime() + rand(7, Math.min(daysSince, 45)) * DAY);
            payments.push({ tipe: "TRANSFER", jumlah: cicilan, tanggal: tglCicil, keterangan: "Cicilan pelanggan" });
          }
        }

        for (const p of payments) {
          await tx.payment.create({
            data: { tipe: p.tipe, jumlah: p.jumlah, tanggal: p.tanggal, keterangan: p.keterangan, transactionId: trx.id },
          });
        }

        if (mode !== "CASH") {
          const noInvoice = await nextDocNumber(tx, "invoice");
          const totalDibayar = payments.reduce((s, p) => s + p.jumlah, 0);
          const status = totalDibayar >= grandTotal ? "LUNAS" : totalDibayar === 0 ? "PENDING" : "PARTIAL";
          const invoice = await tx.invoice.create({
            data: {
              noInvoice,
              tanggal,
              status,
              transactionId: trx.id,
              namaClient,
              alamat,
              namaWs,
              total: grandTotal,
              totalDibayar,
            },
          });
          await tx.payment.updateMany({ where: { transactionId: trx.id, invoiceId: null }, data: { invoiceId: invoice.id } });
          stats.invoices++;
        }
      },
      { timeout: 20_000 }
    );

    for (const { it, qty } of lines) it.stock -= qty;
    stats.trx++;
  }
  return stats;
}

// ============ NON-GUDANG ============
async function seedNgProduk() {
  const used = new Set<string>();
  const rows: Prisma.NgProdukCreateManyInput[] = [];
  for (let i = 0; i < COUNT; i++) {
    let base = "";
    do base = `${pick(NG_BASE)} ${pick(NG_SPEC)}`;
    while (used.has(base) && used.size < NG_BASE.length * NG_SPEC.length);
    used.add(base);
    const hargaBeli = money(25_000, 2_500_000);
    rows.push({
      nama: `${DUMMY_NAME_PREFIX}${base}`,
      namaToko: NG_TOKO[i % NG_TOKO.length],
      kategori: pick(["Dapur", "Furnitur", "Pencahayaan", "Sanitasi", "Aksesoris"]),
      satuan: pick(NG_SATUAN),
      hargaBeli,
      hargaJual: Math.round((hargaBeli * (1.12 + Math.random() * 0.3)) / 500) * 500,
      aktif: Math.random() > 0.08,
      createdAt: pastDate(200, 150),
    });
  }
  await prisma.ngProduk.createMany({ data: rows });
  return prisma.ngProduk.findMany({ where: { nama: { startsWith: DUMMY_NAME_PREFIX } } });
}

async function seedNgKonsumen() {
  const rows: Prisma.NgKonsumenCreateManyInput[] = [];
  for (let i = 0; i < COUNT; i++) {
    rows.push({
      nama: `${DUMMY_NAME_PREFIX}${personName(i)}`,
      namaGrup: Math.random() < 0.45 ? `Proyek ${pick(["Ruko", "Cluster", "Apartemen", "Kantor", "Kafe"])} ${pick(KOTA)}` : null,
      alamat: Math.random() < 0.8 ? address() : null,
      namaWorkshop: Math.random() < 0.4 ? pick(WORKSHOPS) : null,
      createdAt: pastDate(190, 150),
    });
  }
  await prisma.ngKonsumen.createMany({ data: rows });
  return prisma.ngKonsumen.findMany({ where: { nama: { startsWith: DUMMY_NAME_PREFIX } } });
}

async function seedNgInvoices(
  produk: Awaited<ReturnType<typeof seedNgProduk>>,
  konsumen: Awaited<ReturnType<typeof seedNgKonsumen>>,
  ngUserId: number | null
) {
  type NgMode = "LUNAS" | "PARTIAL" | "PENDING";
  const modes: NgMode[] = [...Array<NgMode>(55).fill("LUNAS"), ...Array<NgMode>(20).fill("PARTIAL"), ...Array<NgMode>(25).fill("PENDING")];
  const aktif = produk.filter((p) => p.aktif);
  let created = 0;

  for (const mode of sample(modes, modes.length)) {
    const toko = pick(NG_TOKO);
    const pool = aktif.filter((p) => p.namaToko === toko);
    if (pool.length === 0) continue;
    const k = pick(konsumen);
    const tanggal = pastDate(140, 0);
    const computed = computeNgCart(
      sample(pool, rand(1, Math.min(5, pool.length))).map((p) => ({
        produkId: p.id,
        nama: p.nama,
        namaToko: p.namaToko,
        hargaBeli: Number(p.hargaBeli),
        hargaJual: Number(p.hargaJual),
        qty: rand(1, 15),
      }))
    );
    const method: NgPaymentType = Math.random() < 0.55 ? "TRANSFER" : "CASH";
    const bank = method === "TRANSFER" ? pick(BANKS) : null;
    const totalDibayar =
      mode === "LUNAS"
        ? computed.totalPenjualan
        : mode === "PARTIAL"
          ? Math.round((computed.totalPenjualan * (0.3 + Math.random() * 0.4)) / 1000) * 1000
          : 0;
    const jatuhTempo =
      mode === "LUNAS" ? null : new Date(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate() + 7);
    const clampPct = (v: number) => Math.max(-9999.99, Math.min(9999.99, v));

    await prisma.$transaction(
      async (tx) => {
        const noInvoice = await nextDocNumber(tx, "ng_invoice");
        const invoice = await tx.ngInvoice.create({
          data: {
            noInvoice,
            tanggal,
            createdAt: tanggal,
            status: mode,
            namaToko: toko,
            jatuhTempo,
            konsumenId: k.id,
            namaKonsumen: k.nama,
            namaGrup: k.namaGrup,
            alamat: k.alamat,
            namaWorkshop: k.namaWorkshop,
            namaBank: bank?.namaBank ?? null,
            noRekening: bank?.noRekening ?? null,
            atasNama: bank?.atasNama ?? null,
            totalModal: computed.totalModal,
            totalPenjualan: computed.totalPenjualan,
            totalProfit: computed.totalProfit,
            margin: clampPct(computed.margin),
            markup: clampPct(computed.markup),
            totalDibayar,
            userId: ngUserId,
            items: {
              create: computed.lines.map((line) => ({
                produkId: line.produkId,
                namaSnapshot: line.nama,
                namaTokoSnapshot: line.namaToko,
                hargaBeliSnapshot: line.hargaBeli,
                hargaJualSnapshot: line.hargaJual,
                qty: line.qty,
                subtotalModal: line.subtotalModal,
                subtotalPenjualan: line.subtotalPenjualan,
                subtotalProfit: line.subtotalProfit,
              })),
            },
          },
        });
        if (totalDibayar > 0) {
          await tx.ngPayment.create({
            data: {
              invoiceId: invoice.id,
              tanggal,
              tipe: method,
              jumlah: totalDibayar,
              keterangan: mode === "LUNAS" ? `Pelunasan awal untuk ${noInvoice}` : `Pembayaran sebagian untuk ${noInvoice}`,
              userId: ngUserId,
            },
          });
        }
      },
      { timeout: 20_000 }
    );
    created++;
  }
  return created;
}

// ============ MAIN ============
async function main() {
  await ensureNotSeeded();

  const [kasir, gudang, ng] = await Promise.all([
    prisma.user.findFirst({ where: { role: "ADMIN_KASIR", aktif: true }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: "ADMIN_GUDANG", aktif: true }, select: { id: true } }),
    prisma.user.findFirst({ where: { role: "ADMIN_NONGUDANG", aktif: true }, select: { id: true } }),
  ]);

  console.log("1/5 Barang gudang + stok masuk ...");
  const items = await seedItems(gudang?.id ?? null);

  console.log("2/5 Transaksi kasir + invoice ...");
  const trxStats = await seedTransactions(items, kasir?.id ?? null);

  console.log("3/5 Barang non-gudang ...");
  const produk = await seedNgProduk();

  console.log("4/5 Konsumen non-gudang ...");
  const konsumen = await seedNgKonsumen();

  console.log("5/5 Invoice non-gudang ...");
  const ngInvoices = await seedNgInvoices(produk, konsumen, ng?.id ?? null);

  console.log("\nSelesai:");
  console.log(`  Barang gudang      : ${items.length} (8 habis, 12 menipis)`);
  console.log(`  Transaksi kasir    : ${trxStats.trx} (invoice ${trxStats.invoices})`);
  console.log(`  NG barang/konsumen : ${produk.length} / ${konsumen.length}`);
  console.log(`  NG invoice         : ${ngInvoices}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
