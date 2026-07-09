"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { dbId, money, qtyPositive, optionalText, safeError, firstIssue } from "@/lib/validation";

const itemSchema = z.object({
  itemId: dbId,
  qty: qtyPositive,
  unitCost: money,
});

const schema = z.object({
  supplierName: optionalText(FIELD_LIMITS.supplierName, "Nama supplier"),
  referenceNo: optionalText(FIELD_LIMITS.referenceNo, "No. referensi"),
  notes: optionalText(FIELD_LIMITS.notes, "Catatan"),
  items: z.array(itemSchema).min(1, "Minimal 1 barang harus dimasukkan.").max(500, "Terlalu banyak item."),
});

export type StockInPayload = z.infer<typeof schema>;

export async function submitStockIn(payload: StockInPayload) {
  const user = await requireRole("ADMIN_GUDANG");

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const d = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let totalAmount = new Prisma.Decimal(0);
      const itemIds = Array.from(new Set(d.items.map((line) => line.itemId)));
      const items = await tx.item.findMany({ where: { id: { in: itemIds } } });
      const itemMap = new Map(items.map((item) => [item.id, item]));
      if (items.length !== itemIds.length) {
        throw new Error("Salah satu barang tidak ditemukan.");
      }

      // Create a unified note details string
      const supplierRef = d.supplierName ? `Supplier: ${d.supplierName}` : "";
      const refNoStr = d.referenceNo ? `Ref: ${d.referenceNo}` : "";
      const headerNote = d.notes ? `Note: ${d.notes}` : "";
      const summaryNotes = [supplierRef, refNoStr, headerNote].filter(Boolean).join(" | ") || "Restock Manual";

      const ledgerEntries = [];

      for (const line of d.items) {
        const item = itemMap.get(line.itemId)!;

        const lineTotal = new Prisma.Decimal(line.unitCost).mul(line.qty);
        totalAmount = totalAmount.add(lineTotal);

        // 1. Create Stock Ledger MASUK entry
        const entry = await tx.stockLedger.create({
          data: {
            itemId: item.id,
            tipe: "MASUK",
            qty: line.qty,
            keterangan: summaryNotes,
            refType: "MANUAL",
            userId: user.id,
          },
        });

        // 2. Update item purchase price (hargaBeli) and inventory metadata
        await tx.item.update({
          where: { id: item.id },
          data: {
            hargaBeli: new Prisma.Decimal(line.unitCost),
          },
        });

        ledgerEntries.push({ itemId: item.id, qty: line.qty, unitCost: line.unitCost });
      }

      return {
        ok: true,
        totalItems: d.items.length,
        totalAmount: Number(totalAmount),
        entries: ledgerEntries,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await logActivity({
      userId: user.id,
      aksi: "STOCK_IN_BATCH",
      entitas: "StockLedger",
      detail: { supplier: d.supplierName, ref: d.referenceNo, itemsCount: result.totalItems, total: result.totalAmount },
    });

    // Invalidate caches after successful batch stock-in
    revalidatePath("/");            // Dashboard shows inventory value
    revalidatePath("/stok");        // Stock levels changed
    revalidatePath("/stok/masuk");  // Stock-in page
    revalidatePath("/barang");      // Item prices (hargaBeli) changed
    revalidateTag("stock");         // Invalidate stock cache

    return result;
  } catch (error) {
    return safeError(error, "Gagal menyimpan batch stock-in.");
  }
}
