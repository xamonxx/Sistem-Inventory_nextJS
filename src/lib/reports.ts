import { prisma } from "@/lib/prisma";
import { getStokAkhirMap } from "@/lib/stock";

/** Omset & margin per item (basis: TransactionItem). */
export async function laporanMargin() {
  const grouped = await prisma.transactionItem.groupBy({
    by: ["itemId", "namaSnapshot"],
    _sum: { qty: true, subtotal: true },
  });

  const rows = await Promise.all(
    grouped.map(async (g) => {
      // margin = Σ (hargaJual - hargaBeli) * qty pada baris terkait
      const lines = await prisma.transactionItem.findMany({
        where: { itemId: g.itemId },
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
export async function barangTerlaris(limit = 10) {
  const rows = await laporanMargin();
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

export async function laporanPiutang() {
  const inv = await prisma.invoice.findMany({ orderBy: { tanggal: "desc" } });
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
