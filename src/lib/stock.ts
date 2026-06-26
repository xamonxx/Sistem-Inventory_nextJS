import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

/**
 * Stok akhir = stokAwal + Σ ledger.qty (signed).
 * Stok BOLEH negatif (sesuai cara kerja toko).
 * 
 * OPTIMIZED: Cached for 60 seconds to reduce repeated queries.
 * Cache invalidated via 'stock' tag when ledger changes.
 */
export const getStokAkhir = unstable_cache(
  async (itemId: number): Promise<number> => {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return 0;
    const agg = await prisma.stockLedger.aggregate({
      where: { itemId },
      _sum: { qty: true },
    });
    return item.stokAwal + (agg._sum.qty ?? 0);
  },
  ["stock-balance"],
  { 
    revalidate: 60, // Cache for 60 seconds
    tags: ["stock"], // Invalidate when stock changes
  }
);

/** 
 * Hitung stok akhir untuk banyak item sekaligus (efisien untuk tabel).
 * 
 * OPTIMIZED: Cached for 60 seconds to reduce repeated bulk queries.
 * Cache invalidated via 'stock' tag when ledger changes.
 * Returns plain object (not Map) for JSON serialization compatibility.
 */
export const getStokAkhirMap = unstable_cache(
  async (itemIds?: number[]): Promise<Record<number, number>> => {
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
    const result: Record<number, number> = {};
    for (const it of items) {
      result[it.id] = it.stokAwal + (ledgerMap.get(it.id) ?? 0);
    }
    return result;
  },
  ["stock-map"],
  { 
    revalidate: 60, // Cache for 60 seconds
    tags: ["stock"], // Invalidate when stock changes
  }
);
