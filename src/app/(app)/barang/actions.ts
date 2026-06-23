"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  id: z.coerce.number().optional(),
  kode: z.string().trim().min(1, "Kode wajib diisi"),
  nama: z.string().trim().min(1, "Nama wajib diisi"),
  hargaBeli: z.coerce.number().min(0),
  hargaJual: z.coerce.number().min(0),
  stokAwal: z.coerce.number().int(),
  minStok: z.coerce.number().int().min(0),
  aktif: z.coerce.boolean().optional().default(true),
});

export async function saveItem(_prev: unknown, formData: FormData) {
  // Harga & stok awal HANYA boleh ADMIN_GUDANG
  const user = await requireRole("ADMIN_GUDANG");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    kode: formData.get("kode"),
    nama: formData.get("nama"),
    hargaBeli: formData.get("hargaBeli"),
    hargaJual: formData.get("hargaJual"),
    stokAwal: formData.get("stokAwal"),
    minStok: formData.get("minStok"),
    aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  // Cek kode unik (selain dirinya sendiri saat edit)
  const dup = await prisma.item.findUnique({ where: { kode: d.kode } });
  if (dup && dup.id !== d.id) {
    return { error: `Kode "${d.kode}" sudah dipakai barang lain.` };
  }

  try {
    if (d.id) {
      const before = await prisma.item.findUnique({ where: { id: d.id } });
      const updated = await prisma.item.update({
        where: { id: d.id },
        data: {
          kode: d.kode,
          nama: d.nama,
          hargaBeli: new Prisma.Decimal(d.hargaBeli),
          hargaJual: new Prisma.Decimal(d.hargaJual),
          stokAwal: d.stokAwal,
          minStok: d.minStok,
          aktif: d.aktif,
        },
      });
      await logActivity({
        userId: user.id,
        aksi: "UPDATE_BARANG",
        entitas: "Item",
        entitasId: updated.id,
        detail: {
          hargaBeli: [Number(before?.hargaBeli), d.hargaBeli],
          hargaJual: [Number(before?.hargaJual), d.hargaJual],
          stokAwal: [before?.stokAwal, d.stokAwal],
        },
      });
    } else {
      const created = await prisma.item.create({
        data: {
          kode: d.kode,
          nama: d.nama,
          hargaBeli: new Prisma.Decimal(d.hargaBeli),
          hargaJual: new Prisma.Decimal(d.hargaJual),
          stokAwal: d.stokAwal,
          minStok: d.minStok,
          aktif: d.aktif,
        },
      });
      await logActivity({
        userId: user.id,
        aksi: "CREATE_BARANG",
        entitas: "Item",
        entitasId: created.id,
        detail: { kode: d.kode, nama: d.nama },
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Kode "${d.kode}" sudah dipakai (unik).` };
    }
    throw e;
  }

  revalidatePath("/barang");
  return { ok: true };
}

export async function toggleAktif(id: number, aktif: boolean) {
  const user = await requireRole("ADMIN_GUDANG");
  await prisma.item.update({ where: { id }, data: { aktif } });
  await logActivity({ userId: user.id, aksi: "TOGGLE_BARANG", entitas: "Item", entitasId: id, detail: { aktif } });
  revalidatePath("/barang");
}

export async function getItemHistory(itemId: number) {
  const ledger = await prisma.stockLedger.findMany({
    where: { itemId },
    orderBy: { id: "desc" },
    take: 10,
    include: { user: true },
  });
  return ledger.map((l) => ({
    id: l.id,
    tanggal: l.tanggal.toISOString(),
    tipe: l.tipe,
    qty: l.qty,
    keterangan: l.keterangan,
    user: l.user?.nama ?? "-",
  }));
}
