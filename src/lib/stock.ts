import { prisma } from "@/lib/prisma";

/**
 * Stok akhir = stokAwal + Σ ledger.qty (signed).
 * Stok BOLEH negatif (sesuai cara kerja toko).
 */
export async function getStokAkhir(itemId: number): Promise<number> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return 0;
  const agg = await prisma.stockLedger.aggregate({
    where: { itemId },
    _sum: { qty: true },
  });
  return item.stokAwal + (agg._sum.qty ?? 0);
}

/** Hitung stok akhir untuk banyak item sekaligus (efisien untuk tabel). */
export async function getStokAkhirMap(
  itemIds?: number[]
): Promise<Map<number, number>> {
  const items = await prisma.item.findMany({
    where: itemIds ? { id: { in: itemIds } } : undefined,
    select: { id: true, stokAwal: true },
  });
  const grouped = await prisma.stockLedger.groupBy({
    by: ["itemId"],
    where: itemIds ? { itemId: { in: itemIds } } : undefined,
    _sum: { qty: true },
  });
  const ledgerMap = new Map(grouped.map((g) => [g.itemId, g._sum.qty ?? 0]));
  const result = new Map<number, number>();
  for (const it of items) {
    result.set(it.id, it.stokAwal + (ledgerMap.get(it.id) ?? 0));
  }
  return result;
}
