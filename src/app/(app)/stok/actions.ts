"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getStokAkhir } from "@/lib/stock";
import { logActivity } from "@/lib/activity";

const masukSchema = z.object({
  itemId: z.coerce.number().int(),
  qty: z.coerce.number().int().positive("Qty harus > 0"),
  keterangan: z.string().trim().optional().default(""),
});

export async function barangMasuk(_prev: unknown, formData: FormData) {
  const user = await requireRole("ADMIN_GUDANG");
  const parsed = masukSchema.safeParse({
    itemId: formData.get("itemId"),
    qty: formData.get("qty"),
    keterangan: formData.get("keterangan"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const d = parsed.data;

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
  revalidatePath("/stok");
  return { ok: true };
}

const koreksiSchema = z.object({
  itemId: z.coerce.number().int(),
  stokSeharusnya: z.coerce.number().int(),
  keterangan: z.string().trim().optional().default(""),
});

export async function koreksiStok(_prev: unknown, formData: FormData) {
  const user = await requireRole("ADMIN_GUDANG");
  const parsed = koreksiSchema.safeParse({
    itemId: formData.get("itemId"),
    stokSeharusnya: formData.get("stokSeharusnya"),
    keterangan: formData.get("keterangan"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const d = parsed.data;

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
  revalidatePath("/stok");
  return { ok: true };
}
