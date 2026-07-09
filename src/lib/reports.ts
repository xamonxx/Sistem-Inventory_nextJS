import { prisma } from "@/lib/prisma";
import { getStokAkhirMap } from "@/lib/stock";

export type ReportRange = { from?: Date; to?: Date };
export type ReportPage = { take?: number; skip?: number };

const DEFAULT_REPORT_TAKE = 500;
const MAX_REPORT_TAKE = 2000;

function pageArgs(page?: ReportPage) {
  const take = Math.min(Math.max(Math.trunc(page?.take ?? DEFAULT_REPORT_TAKE), 1), MAX_REPORT_TAKE);
  const skip = Math.max(Math.trunc(page?.skip ?? 0), 0);
  return { take, skip };
}

function txItemDateWhere(range?: ReportRange) {
  if (!range || (!range.from && !range.to)) return undefined;
  const tanggal: { gte?: Date; lte?: Date } = {};
  if (range.from) tanggal.gte = range.from;
  if (range.to) tanggal.lte = range.to;
  return { transaction: { is: { tanggal } } };
}

function dateWhere(range?: ReportRange) {
  if (!range || (!range.from && !range.to)) return undefined;
  const tanggal: { gte?: Date; lte?: Date } = {};
  if (range.from) tanggal.gte = range.from;
  if (range.to) tanggal.lte = range.to;
  return tanggal;
}

export async function laporanMargin(range?: ReportRange, page?: ReportPage) {
  const dateFilter = txItemDateWhere(range);
  const pageOptions = pageArgs(page);
  const lines = await prisma.transactionItem.findMany({
    where: dateFilter,
    orderBy: { transaction: { tanggal: "desc" } },
    ...pageOptions,
    select: {
      itemId: true,
      namaSnapshot: true,
      qty: true,
      subtotal: true,
      hargaSnapshot: true,
      hargaBeliSnapshot: true,
      item: { select: { kode: true } },
    },
  });

  const rows = new Map<
    number,
    { kode: string; nama: string; qtyTerjual: number; omset: number; margin: number }
  >();

  for (const line of lines) {
    const current = rows.get(line.itemId) ?? {
      kode: line.item.kode,
      nama: line.namaSnapshot,
      qtyTerjual: 0,
      omset: 0,
      margin: 0,
    };
    current.qtyTerjual += line.qty;
    current.omset += Number(line.subtotal);
    current.margin += (Number(line.hargaSnapshot) - Number(line.hargaBeliSnapshot)) * line.qty;
    rows.set(line.itemId, current);
  }

  return Array.from(rows.values()).sort((a, b) => b.omset - a.omset);
}

export async function barangTerlaris(limit = 10, range?: ReportRange) {
  const rows = await laporanMargin(range);
  return [...rows].sort((a, b) => b.qtyTerjual - a.qtyTerjual).slice(0, limit);
}

export async function laporanOmset(page?: ReportPage) {
  const pageOptions = pageArgs(page);
  const trx = await prisma.transaction.findMany({
    orderBy: { tanggal: "desc" },
    ...pageOptions,
    select: { noTransaksi: true, tanggal: true, namaClient: true, namaWs: true, grandTotal: true },
  });
  return trx.map((t) => ({
    noTransaksi: t.noTransaksi,
    tanggal: t.tanggal.toISOString().slice(0, 10),
    client: t.namaClient ?? "",
    ws: t.namaWs ?? "",
    omset: Number(t.grandTotal),
  }));
}

export async function laporanPiutang(range?: ReportRange, page?: ReportPage) {
  const tanggal = dateWhere(range);
  const pageOptions = pageArgs(page);
  const inv = await prisma.invoice.findMany({
    where: tanggal ? { tanggal } : undefined,
    orderBy: { tanggal: "desc" },
    ...pageOptions,
  });
  return inv.map((i) => ({
    noInvoice: i.noInvoice,
    tanggal: i.tanggal.toISOString().slice(0, 10),
    client: i.namaClient ?? "",
    total: Number(i.total),
    dibayar: Number(i.totalDibayar),
    sisa: Number(i.total) - Number(i.totalDibayar),
    status: i.status,
  }));
}

export async function laporanStok(page?: ReportPage) {
  const pageOptions = pageArgs(page);
  const items = await prisma.item.findMany({ orderBy: { kode: "asc" }, ...pageOptions });
  const stokMap = await getStokAkhirMap(items.map((i) => i.id));
  return items.map((i) => {
    const stok = stokMap[i.id] ?? i.stokAwal;
    return {
      kode: i.kode,
      nama: i.nama,
      stokAkhir: stok,
      minStok: i.minStok,
      hargaBeli: Number(i.hargaBeli),
      hargaJual: Number(i.hargaJual),
      nilaiAset: stok * Number(i.hargaBeli),
      status: stok < i.minStok ? "MENIPIS" : "AMAN",
    };
  });
}
