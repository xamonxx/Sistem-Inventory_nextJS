import { prisma } from "@/lib/prisma";

export type NgReportRange = { from?: Date; to?: Date };

export type NgSummary = {
  totalPembelian: number; // Σ modal (harga beli) seluruh toko
  totalOmzet: number; // Σ penjualan
  totalProfit: number;
  margin: number; // profit / omzet * 100
  markup: number; // profit / pembelian * 100
  jumlahInvoice: number;
  totalDibayar: number;
  totalPiutang: number; // Σ (penjualan - dibayar)
  jumlahLunas: number;
  jumlahTempo: number; // PENDING
  jumlahPartial: number;
  jumlahTerlambat: number;
};

export type NgTokoRow = {
  namaToko: string;
  jumlahInvoice: number;
  totalQty: number;
  totalPembelian: number;
  totalOmzet: number;
  totalProfit: number;
  margin: number;
};

export type NgProdukRow = {
  nama: string;
  qty: number;
  pembelian: number;
  omzet: number;
  profit: number;
  margin: number;
};

export type NgTrenRow = {
  periode: string; // "MMM YYYY" label
  ym: string; // "YYYY-MM" sort key
  pembelian: number;
  omzet: number;
  profit: number;
};

export type NgAnalisa = {
  summary: NgSummary;
  perToko: NgTokoRow[];
  topProduk: NgProdukRow[];
  tren: NgTrenRow[];
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function pct(num: number, den: number): number {
  return den > 0 ? round2((num / den) * 100) : 0;
}

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * Agregasi analitik modul Non-Gudang untuk rentang periode.
 * Menghitung ringkasan margin, pembelian per toko sumber, top produk, dan tren
 * bulanan dari NgInvoice + NgInvoiceItem (tanpa payable — modal hanya untuk margin).
 * 1 toko sumber per invoice, jadi seluruh item satu invoice = satu toko.
 */
export async function ngAnalisa(range?: NgReportRange): Promise<NgAnalisa> {
  const hasRange = !!(range?.from || range?.to);
  
  let isDaily = false;
  if (range?.from && range?.to) {
    const diffMs = range.to.getTime() - range.from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 31) {
      isDaily = true;
    }
  }

  const invoices = await prisma.ngInvoice.findMany({
    where: hasRange ? { tanggal: { gte: range?.from, lte: range?.to } } : undefined,
    select: {
      tanggal: true,
      status: true,
      jatuhTempo: true,
      namaToko: true,
      totalModal: true,
      totalPenjualan: true,
      totalProfit: true,
      totalDibayar: true,
      items: {
        select: { namaSnapshot: true, qty: true, subtotalModal: true, subtotalPenjualan: true, subtotalProfit: true },
      },
    },
  });

  const now = Date.now();
  const summary: NgSummary = {
    totalPembelian: 0,
    totalOmzet: 0,
    totalProfit: 0,
    margin: 0,
    markup: 0,
    jumlahInvoice: invoices.length,
    totalDibayar: 0,
    totalPiutang: 0,
    jumlahLunas: 0,
    jumlahTempo: 0,
    jumlahPartial: 0,
    jumlahTerlambat: 0,
  };

  const tokoMap = new Map<string, NgTokoRow>();
  const produkMap = new Map<string, NgProdukRow>();
  const trenMap = new Map<string, NgTrenRow>();

  for (const inv of invoices) {
    const modal = Number(inv.totalModal);
    const omzet = Number(inv.totalPenjualan);
    const profit = Number(inv.totalProfit);
    const dibayar = Number(inv.totalDibayar);
    const qtyInv = inv.items.reduce((s, it) => s + it.qty, 0);

    summary.totalPembelian += modal;
    summary.totalOmzet += omzet;
    summary.totalProfit += profit;
    summary.totalDibayar += dibayar;
    summary.totalPiutang += Math.max(0, omzet - dibayar);

    if (inv.status === "LUNAS") summary.jumlahLunas++;
    else if (inv.status === "PARTIAL") summary.jumlahPartial++;
    else summary.jumlahTempo++;
    if (inv.status !== "LUNAS" && inv.jatuhTempo && now > inv.jatuhTempo.getTime()) summary.jumlahTerlambat++;

    // Per toko sumber
    const t = tokoMap.get(inv.namaToko) ?? {
      namaToko: inv.namaToko,
      jumlahInvoice: 0,
      totalQty: 0,
      totalPembelian: 0,
      totalOmzet: 0,
      totalProfit: 0,
      margin: 0,
    };
    t.jumlahInvoice += 1;
    t.totalQty += qtyInv;
    t.totalPembelian += modal;
    t.totalOmzet += omzet;
    t.totalProfit += profit;
    tokoMap.set(inv.namaToko, t);

    // Tren bulanan/harian
    const d = inv.tanggal;
    let periodKey: string;
    let periodLabel: string;
    if (isDaily) {
      periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      periodLabel = `${String(d.getDate()).padStart(2, "0")} ${MONTH_ID[d.getMonth()]}`;
    } else {
      periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      periodLabel = `${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`;
    }

    const tren = trenMap.get(periodKey) ?? {
      periode: periodLabel,
      ym: periodKey,
      pembelian: 0,
      omzet: 0,
      profit: 0,
    };
    tren.pembelian += modal;
    tren.omzet += omzet;
    tren.profit += profit;
    trenMap.set(periodKey, tren);

    // Top produk (per item snapshot)
    for (const it of inv.items) {
      const p = produkMap.get(it.namaSnapshot) ?? { nama: it.namaSnapshot, qty: 0, pembelian: 0, omzet: 0, profit: 0, margin: 0 };
      p.qty += it.qty;
      p.pembelian += Number(it.subtotalModal);
      p.omzet += Number(it.subtotalPenjualan);
      p.profit += Number(it.subtotalProfit);
      produkMap.set(it.namaSnapshot, p);
    }
  }

  summary.totalPembelian = round2(summary.totalPembelian);
  summary.totalOmzet = round2(summary.totalOmzet);
  summary.totalProfit = round2(summary.totalProfit);
  summary.totalDibayar = round2(summary.totalDibayar);
  summary.totalPiutang = round2(summary.totalPiutang);
  summary.margin = pct(summary.totalProfit, summary.totalOmzet);
  summary.markup = pct(summary.totalProfit, summary.totalPembelian);

  const perToko = [...tokoMap.values()]
    .map((t) => ({ ...t, margin: pct(t.totalProfit, t.totalOmzet) }))
    .sort((a, b) => b.totalPembelian - a.totalPembelian);
  const topProduk = [...produkMap.values()]
    .map((p) => ({ ...p, margin: pct(p.profit, p.omzet) }))
    .sort((a, b) => b.omzet - a.omzet)
    .slice(0, 10);
  const tren = [...trenMap.values()].sort((a, b) => a.ym.localeCompare(b.ym));

  return { summary, perToko, topProduk, tren };
}
