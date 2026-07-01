import { prisma } from "@/lib/prisma";
import { getStokAkhirMap } from "@/lib/stock";

/** Rentang tanggal filter laporan (inklusif). */
export type ReportRange = { from?: Date; to?: Date };

/** Where-clause TransactionItem berdasar tanggal transaksi induk. */
function txItemDateWhere(range?: ReportRange) {
  if (!range || (!range.from && !range.to)) return undefined;
  const tanggal: { gte?: Date; lte?: Date } = {};
  if (range.from) tanggal.gte = range.from;
  if (range.to) tanggal.lte = range.to;
  return { transaction: { is: { tanggal } } };
}

/** Where-clause berbasis kolom tanggal langsung (Invoice, dll). */
function dateWhere(range?: ReportRange) {
  if (!range || (!range.from && !range.to)) return undefined;
  const tanggal: { gte?: Date; lte?: Date } = {};
  if (range.from) tanggal.gte = range.from;
  if (range.to) tanggal.lte = range.to;
  return tanggal;
}

/** Omset & margin per item (basis: TransactionItem). */
export async function laporanMargin(range?: ReportRange) {
  const dateFilter = txItemDateWhere(range);
  const grouped = await prisma.transactionItem.groupBy({
    by: ["itemId", "namaSnapshot"],
    _sum: { qty: true, subtotal: true },
    where: dateFilter,
  });

  const rows = await Promise.all(
    grouped.map(async (g) => {
      // margin = Σ (hargaJual - hargaBeli) * qty pada baris terkait (periode sama)
      const lines = await prisma.transactionItem.findMany({
        where: { itemId: g.itemId, ...(dateFilter ?? {}) },
        select: { qty: true, hargaSnapshot: true, hargaBeliSnapshot: true },
      });
      const margin = lines.reduce(
        (a, l) => a + (Number(l.hargaSnapshot) - Number(l.hargaBeliSnapshot)) * l.qty,
        0
      );
      return {
        nama: g.namaSnapshot,
        qtyTerjual: g._sum.qty ?? 0,
        omset: Number(g._sum.subtotal ?? 0),
        margin,
      };
    })
  );
  return rows.sort((a, b) => b.omset - a.omset);
}

/** Barang terlaris (top by qty terjual). */
export async function barangTerlaris(limit = 10, range?: ReportRange) {
  const rows = await laporanMargin(range);
  return [...rows].sort((a, b) => b.qtyTerjual - a.qtyTerjual).slice(0, limit);
}

export async function laporanOmset() {
  const trx = await prisma.transaction.findMany({
    orderBy: { tanggal: "desc" },
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

export async function laporanPiutang(range?: ReportRange) {
  const tanggal = dateWhere(range);
  const inv = await prisma.invoice.findMany({
    where: tanggal ? { tanggal } : undefined,
    orderBy: { tanggal: "desc" },
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

export async function laporanStok() {
  const items = await prisma.item.findMany({ orderBy: { kode: "asc" } });
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
