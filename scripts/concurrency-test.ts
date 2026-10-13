/**
 * DB-backed concurrency regression for AUD-004 / AUD-005.
 * Calls the real Server Actions concurrently. Run only through
 * `npm run test:concurrency`, which creates and drops a disposable database.
 */
import { prisma } from "../src/lib/prisma";
import { createTransaction } from "../src/app/(app)/kasir/actions";
import { updateInvoiceAndItems } from "../src/app/(app)/invoice/actions";
import { createNgInvoice } from "../src/app/(app)/non-gudang/buat-invoice/actions";
import { bayarNgInvoice, updateNgInvoice } from "../src/app/(app)/non-gudang/invoice/actions";

const ITERATIONS = 8;
let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function assertDisposableDb() {
  const url = process.env.DATABASE_URL ?? "";
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.startsWith("sistem_inventory_conc_")) {
    throw new Error("Refusing to run: DATABASE_URL is not a disposable sistem_inventory_conc_* database.");
  }
}

async function stockOf(itemId: number) {
  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId }, select: { stokAwal: true } });
  const ledger = await prisma.stockLedger.aggregate({ where: { itemId }, _sum: { qty: true } });
  return item.stokAwal + (ledger._sum.qty ?? 0);
}

const okResult = (r: unknown) => !!r && typeof r === "object" && "ok" in r && (r as { ok: unknown }).ok === true;

async function scenarioInvoiceEditVsCheckout(round: number) {
  // Invoice already sells one unit of B; item A has exactly one unit left.
  const itemA = await prisma.item.create({
    data: { kode: `CONC-A-${round}`, nama: `Conc A ${round}`, hargaJual: 10000, hargaBeli: 5000, stokAwal: 1, aktif: true },
  });
  const itemB = await prisma.item.create({
    data: { kode: `CONC-B-${round}`, nama: `Conc B ${round}`, hargaJual: 20000, hargaBeli: 9000, stokAwal: 50, aktif: true },
  });
  const sale = await createTransaction({
    tipe: "RETAIL", namaClient: `Conc ${round}`, alamat: "", namaWs: "", projectNama: "", projectGroupNama: "",
    paymentMethod: "TRANSFER", namaBank: "", noRekening: "", atasNama: "",
    payments: [{ tipe: "TRANSFER", jumlah: 20000 }], buatInvoice: true,
    items: [{ itemId: itemB.id, qty: 1 }],
  });
  if (!okResult(sale) || !("invoiceNo" in sale) || !sale.invoiceNo) throw new Error(`setup sale failed: ${JSON.stringify(sale)}`);
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { noInvoice: sale.invoiceNo } });

  // Race: edit adds the last unit of A while a checkout buys it.
  const [edit, checkout] = await Promise.all([
    updateInvoiceAndItems(
      invoice.id,
      { noInvoice: invoice.noInvoice, tanggal: invoice.tanggal, namaClient: `Conc ${round}` },
      [{ itemId: itemB.id, qty: 1 }, { itemId: itemA.id, qty: 1 }]
    ),
    createTransaction({
      tipe: "RETAIL", namaClient: "", alamat: "", namaWs: "", projectNama: "", projectGroupNama: "",
      paymentMethod: "TRANSFER", namaBank: "", noRekening: "", atasNama: "",
      payments: [{ tipe: "TRANSFER", jumlah: 10000 }], buatInvoice: false,
      items: [{ itemId: itemA.id, qty: 1 }],
    }),
  ]);

  const stockA = await stockOf(itemA.id);
  const winners = [edit, checkout].filter(okResult).length;
  return { stockA, winners, edit, checkout };
}

async function scenarioNgEditVsPayment(round: number) {
  const produk = await prisma.ngProduk.create({
    data: { nama: `Conc NG ${round}`, namaToko: "Toko Conc", hargaBeli: 60000, hargaJual: 100000, aktif: true },
  });
  const created = await createNgInvoice({
    tanggal: new Date().toISOString(), namaToko: "Toko Conc", konsumenId: null, namaKonsumen: `Conc ${round}`,
    namaGrup: "", alamat: "", namaWorkshop: "", paymentStatus: "TEMPO", paymentMethod: "CASH",
    namaBank: "", noRekening: "", atasNama: "", items: [{ produkId: produk.id, qty: 1 }],
  });
  if (!okResult(created) || !("invoice" in created)) throw new Error(`setup NG invoice failed: ${JSON.stringify(created)}`);
  const invoiceId = created.invoice.id;

  // Race: pay 80.000 while an edit lowers the total to 50.000.
  const [payment, edit] = await Promise.all([
    bayarNgInvoice({ invoiceId, jumlah: 80000, tipe: "CASH" }),
    updateNgInvoice({
      invoiceId, tanggal: new Date().toISOString(), paymentMethod: "CASH",
      items: [{ produkId: produk.id, nama: produk.nama, hargaBeli: 30000, hargaJual: 50000, qty: 1 }],
    }),
  ]);

  const inv = await prisma.ngInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  const total = Number(inv.totalPenjualan);
  const paid = Number(inv.totalDibayar);
  const sumPayments = inv.payments.reduce((a, p) => a + Number(p.jumlah), 0);
  const expectedStatus = paid >= total ? "LUNAS" : paid > 0 ? "PARTIAL" : "PENDING";
  return { total, paid, sumPayments, status: inv.status, expectedStatus, payment, edit };
}

async function main() {
  assertDisposableDb();
  const user = await prisma.user.create({
    data: { username: `conc-${Date.now()}`, nama: "Concurrency Test", password: "not-a-real-hash", role: "ADMIN_KASIR" },
  });
  process.env.TEST_USER_ID = String(user.id);

  console.log("\n=== AUD-004: Gudang invoice edit vs checkout (last unit) ===");
  for (let i = 1; i <= ITERATIONS; i++) {
    const r = await scenarioInvoiceEditVsCheckout(i);
    ok(`round ${i}: stock never negative (stock=${r.stockA}, winners=${r.winners})`, r.stockA >= 0 && r.winners <= 1,
      JSON.stringify({ edit: r.edit, checkout: r.checkout }));
    const loserError = [r.edit, r.checkout]
      .map((x) => (x && typeof x === "object" && "error" in x ? String((x as { error: unknown }).error) : ""))
      .find(Boolean);
    ok(`round ${i}: loser gets an actionable message (AUD-010)`, !loserError || !/kesalahan internal/i.test(loserError), loserError);
  }

  console.log("\n=== AUD-005: Non-Gudang edit vs payment ===");
  for (let i = 1; i <= ITERATIONS; i++) {
    const r = await scenarioNgEditVsPayment(i);
    ok(
      `round ${i}: paid ≤ total, payments = paid, status consistent (total=${r.total}, paid=${r.paid}, ${r.status})`,
      r.paid <= r.total && Math.abs(r.sumPayments - r.paid) < 0.005 && r.status === r.expectedStatus,
      JSON.stringify({ payment: r.payment, edit: r.edit })
    );
  }
}

main()
  .catch((e) => {
    failed++;
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n  LULUS : ${passed}\n  GAGAL : ${failed}\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
