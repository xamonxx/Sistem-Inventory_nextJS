"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getStokAkhir } from "@/lib/stock";
import { logActivity } from "@/lib/activity";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { dbId, qtyPositive, boundedInt, optionalText, safeError, firstIssue, type ActionResult } from "@/lib/validation";

const masukSchema = z.object({
  itemId: dbId,
  qty: qtyPositive,
  keterangan: optionalText(FIELD_LIMITS.keterangan, "Keterangan"),
});

export async function barangMasuk(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("ADMIN_GUDANG");
  const parsed = masukSchema.safeParse({
    itemId: formData.get("itemId"),
    qty: formData.get("qty"),
    keterangan: formData.get("keterangan"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;

  try {
    // Pastikan barang ada (hindari FK error & data sampah).
    const item = await prisma.item.findUnique({ where: { id: d.itemId }, select: { id: true } });
    if (!item) return { error: "Barang tidak ditemukan." };

    await prisma.stockLedger.create({
      data: {
        itemId: d.itemId,
        tipe: "MASUK",
        qty: d.qty,
        keterangan: d.keterangan || "Barang masuk / restock",
        refType: "MANUAL",
        userId: user.id,
      },
    });
    await logActivity({ userId: user.id, aksi: "BARANG_MASUK", entitas: "Item", entitasId: d.itemId, detail: { qty: d.qty } });
  } catch (e) {
    return safeError(e, "Gagal mencatat barang masuk.");
  }
  revalidatePath("/stok");
  revalidateTag("stock"); // Invalidate stock cache
  return { ok: true };
}

const koreksiSchema = z.object({
  itemId: dbId,
  stokSeharusnya: boundedInt,
  keterangan: optionalText(FIELD_LIMITS.keterangan, "Keterangan"),
});

export async function koreksiStok(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("ADMIN_GUDANG");
  const parsed = koreksiSchema.safeParse({
    itemId: formData.get("itemId"),
    stokSeharusnya: formData.get("stokSeharusnya"),
    keterangan: formData.get("keterangan"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;

  try {
    const item = await prisma.item.findUnique({ where: { id: d.itemId }, select: { id: true } });
    if (!item) return { error: "Barang tidak ditemukan." };

    const stokSekarang = await getStokAkhir(d.itemId);
    const delta = d.stokSeharusnya - stokSekarang;
    if (delta === 0) return { error: "Stok sudah sesuai, tidak ada koreksi." };

    await prisma.stockLedger.create({
      data: {
        itemId: d.itemId,
        tipe: "KOREKSI",
        qty: delta,
        keterangan: d.keterangan || `Koreksi stok ${stokSekarang} -> ${d.stokSeharusnya}`,
        refType: "MANUAL",
        userId: user.id,
      },
    });
    await logActivity({ userId: user.id, aksi: "KOREKSI_STOK", entitas: "Item", entitasId: d.itemId, detail: { dari: stokSekarang, ke: d.stokSeharusnya } });
  } catch (e) {
    return safeError(e, "Gagal melakukan koreksi stok.");
  }
  revalidatePath("/stok");
  revalidateTag("stock"); // Invalidate stock cache
  return { ok: true };
}
