"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const itemSchema = z.object({
  itemId: z.number().int(),
  qty: z.number().int().positive(),
  unitCost: z.number().min(0),
});

const schema = z.object({
  supplierName: z.string().trim().optional().default(""),
  referenceNo: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  items: z.array(itemSchema).min(1, "Minimal 1 barang harus dimasukkan."),
});

export type StockInPayload = z.infer<typeof schema>;

export async function submitStockIn(payload: StockInPayload) {
  const user = await requireRole("ADMIN_GUDANG");

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let totalAmount = new Prisma.Decimal(0);

      // Create a unified note details string
      const supplierRef = d.supplierName ? `Supplier: ${d.supplierName}` : "";
      const refNoStr = d.referenceNo ? `Ref: ${d.referenceNo}` : "";
      const headerNote = d.notes ? `Note: ${d.notes}` : "";
      const summaryNotes = [supplierRef, refNoStr, headerNote].filter(Boolean).join(" | ") || "Restock Manual";

      const ledgerEntries = [];

      for (const line of d.items) {
        const item = await tx.item.findUnique({ where: { id: line.itemId } });
        if (!item) {
          throw new Error(`Barang dengan ID ${line.itemId} tidak ditemukan.`);
        }

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
    });

    await logActivity({
      userId: user.id,
      aksi: "STOCK_IN_BATCH",
      entitas: "StockLedger",
      detail: { supplier: d.supplierName, ref: d.referenceNo, itemsCount: result.totalItems, total: result.totalAmount },
    });

    return result;
  } catch (error: any) {
    console.error("Batch Stock In error:", error);
    return { error: error.message ?? "Gagal menyimpan batch stock-in." };
  }
}
