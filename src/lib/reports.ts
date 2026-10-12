import { Prisma } from "@prisma/client";
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

function dateWhere(range?: ReportRange) {
  if (!range || (!range.from && !range.to)) return undefined;
  const tanggal: { gte?: Date; lte?: Date } = {};
  if (range.from) tanggal.gte = range.from;
  if (range.to) tanggal.lte = range.to;
  return tanggal;
}

/**
 * Omzet & margin per barang dalam periode, diagregasi di database atas SEMUA
 * baris penjualan (tanpa batas baris), sehingga total omzet/margin/persentase
 * di halaman dan ekspor selalu lengkap.
 * Margin = (harga jual snapshot - harga beli snapshot) x qty.
 */
export async function laporanMargin(range?: ReportRange) {
  const conditions: Prisma.Sql[] = [];
  if (range?.from) conditions.push(Prisma.sql`t.tanggal >= ${range.from}`);
  if (range?.to) conditions.push(Prisma.sql`t.tanggal <= ${range.to}`);
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

  const grouped = await prisma.$queryRaw<
    { itemId: number; kode: string; nama: string; qty: unknown; omset: unknown; margin: unknown }[]
  >`
    SELECT ti.itemId AS itemId,
           i.kode AS kode,
           i.nama AS nama,
           SUM(ti.qty) AS qty,
           SUM(ti.subtotal) AS omset,
           SUM((ti.hargaSnapshot - ti.hargaBeliSnapshot) * ti.qty) AS margin
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transactionId
    JOIN items i ON i.id = ti.itemId
    ${where}
    GROUP BY ti.itemId, i.kode, i.nama
  `;

  return grouped
    .map((g) => ({
      kode: g.kode,
      nama: g.nama,
      qtyTerjual: Number(g.qty ?? 0),
      omset: Number(g.omset ?? 0),
      margin: Number(g.margin ?? 0),
    }))
    .sort((a, b) => b.omset - a.omset);
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
  const itemIds = items.map((i) => i.id);
  // Total mutasi sepanjang waktu: stokAwal + masuk - keluar = stok akhir.
  const [stokMap, masuk, keluar] = await Promise.all([
    getStokAkhirMap(itemIds),
    prisma.stockLedger.groupBy({ by: ["itemId"], where: { itemId: { in: itemIds }, qty: { gt: 0 } }, _sum: { qty: true } }),
    prisma.stockLedger.groupBy({ by: ["itemId"], where: { itemId: { in: itemIds }, qty: { lt: 0 } }, _sum: { qty: true } }),
  ]);
  const masukMap = new Map(masuk.map((m) => [m.itemId, m._sum.qty ?? 0]));
  const keluarMap = new Map(keluar.map((k) => [k.itemId, Math.abs(k._sum.qty ?? 0)]));
  return items.map((i) => {
    const stok = stokMap[i.id] ?? i.stokAwal;
    return {
      kode: i.kode,
      nama: i.nama,
      kategori: i.kategori,
      stokAwal: i.stokAwal,
      stokMasuk: masukMap.get(i.id) ?? 0,
      stokKeluar: keluarMap.get(i.id) ?? 0,
      stokAkhir: stok,
      minStok: i.minStok,
      hargaBeli: Number(i.hargaBeli),
      hargaJual: Number(i.hargaJual),
      nilaiAset: stok * Number(i.hargaBeli),
      status: stok < i.minStok ? "MENIPIS" : "AMAN",
    };
  });
}

/** Batas baris riwayat stok keluar per ekspor (melindungi memori browser & DB). */
export const STOK_KELUAR_MAX_ROWS = 5000;

export type StokKeluarRow = {
  tanggal: string; // ISO
  jenis: "Penjualan" | "Koreksi";
  noRef: string | null; // nomor transaksi untuk penjualan
  pelanggan: string | null;
  kode: string;
  nama: string;
  kategori: string | null;
  qty: number; // positif: jumlah unit yang keluar
  hargaSatuan: number | null; // snapshot harga jual saat transaksi
  nilai: number | null; // hargaSatuan * qty
  petugas: string | null;
  keterangan: string | null;
};

/**
 * Riwayat stok keluar dari kartu stok (sumber kebenaran stok): mutasi KELUAR
 * (penjualan) dan KOREKSI bernilai minus, dalam rentang periode. Penjualan
 * dilengkapi nomor transaksi, pelanggan, dan harga snapshot dari detail transaksi.
 */
export async function laporanStokKeluar(range?: ReportRange): Promise<{ rows: StokKeluarRow[]; truncated: boolean }> {
  const tanggal = dateWhere(range);
  const ledgers = await prisma.stockLedger.findMany({
    where: {
      ...(tanggal ? { tanggal } : {}),
      OR: [{ tipe: "KELUAR" }, { tipe: "KOREKSI", qty: { lt: 0 } }],
    },
    orderBy: [{ tanggal: "desc" }, { id: "desc" }],
    take: STOK_KELUAR_MAX_ROWS + 1,
    select: {
      tanggal: true,
      tipe: true,
      qty: true,
      keterangan: true,
      refType: true,
      refId: true,
      itemId: true,
      item: { select: { kode: true, nama: true, kategori: true } },
      user: { select: { nama: true } },
    },
  });
  const truncated = ledgers.length > STOK_KELUAR_MAX_ROWS;
  const page = truncated ? ledgers.slice(0, STOK_KELUAR_MAX_ROWS) : ledgers;

  const trxIds = Array.from(
    new Set(page.filter((l) => l.refType === "TRANSACTION" && l.refId != null).map((l) => l.refId as number))
  );
  const trxs = trxIds.length
    ? await prisma.transaction.findMany({
        where: { id: { in: trxIds } },
        select: { id: true, noTransaksi: true, namaClient: true, items: { select: { itemId: true, hargaSnapshot: true } } },
      })
    : [];
  const trxMap = new Map(trxs.map((t) => [t.id, t]));

  const rows: StokKeluarRow[] = page.map((l) => {
    const qty = Math.abs(l.qty);
    const trx = l.refType === "TRANSACTION" && l.refId != null ? trxMap.get(l.refId) : undefined;
    const line = trx?.items.find((i) => i.itemId === l.itemId);
    const harga = line ? Number(line.hargaSnapshot) : null;
    return {
      tanggal: l.tanggal.toISOString(),
      jenis: l.tipe === "KELUAR" ? "Penjualan" : "Koreksi",
      noRef: trx?.noTransaksi ?? null,
      pelanggan: trx?.namaClient ?? null,
      kode: l.item.kode,
      nama: l.item.nama,
      kategori: l.item.kategori,
      qty,
      hargaSatuan: harga,
      nilai: harga != null ? harga * qty : null,
      petugas: l.user?.nama ?? null,
      keterangan: l.keterangan,
    };
  });

  return { rows, truncated };
}

/** Parse "YYYY-MM-DD" jadi rentang inklusif (awal hari s/d akhir hari). */
export function parseReportRange(from?: string, to?: string): ReportRange {
  const range: ReportRange = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const d = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(d.getTime())) range.from = d;
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const d = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) range.to = d;
  }
  return range;
}
