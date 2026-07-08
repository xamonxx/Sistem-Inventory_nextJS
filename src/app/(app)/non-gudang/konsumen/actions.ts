"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import {
  dbId,
  requiredText,
  optionalText,
  safeError,
  firstIssue,
  type ActionResult,
} from "@/lib/validation";

const schema = z.object({
  id: dbId.optional(),
  nama: requiredText(FIELD_LIMITS.namaClient, "Nama konsumen"),
  namaGrup: optionalText(FIELD_LIMITS.projectGroupNama, "Nama grup"),
  alamat: optionalText(FIELD_LIMITS.alamat, "Alamat"),
  namaWorkshop: optionalText(FIELD_LIMITS.namaWs, "Nama workshop"),
});

export async function saveNgKonsumen(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("ADMIN_NONGUDANG");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    nama: formData.get("nama"),
    namaGrup: formData.get("namaGrup") || "",
    alamat: formData.get("alamat") || "",
    namaWorkshop: formData.get("namaWorkshop") || "",
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const d = parsed.data;

  const data = {
    nama: d.nama,
    namaGrup: d.namaGrup || null,
    alamat: d.alamat || null,
    namaWorkshop: d.namaWorkshop || null,
  };

  try {
    if (d.id) {
      const updated = await prisma.ngKonsumen.update({ where: { id: d.id }, data });
      await logActivity({
        userId: user.id,
        aksi: "UPDATE_NG_KONSUMEN",
        entitas: "NgKonsumen",
        entitasId: updated.id,
        detail: { nama: d.nama, namaGrup: d.namaGrup },
      });
    } else {
      const created = await prisma.ngKonsumen.create({ data });
      await logActivity({
        userId: user.id,
        aksi: "CREATE_NG_KONSUMEN",
        entitas: "NgKonsumen",
        entitasId: created.id,
        detail: { nama: d.nama, namaGrup: d.namaGrup },
      });
    }
  } catch (e) {
    return safeError(e, "Gagal menyimpan konsumen.");
  }

  revalidatePath("/non-gudang/konsumen");
  return { ok: true };
}

/**
 * Hapus permanen konsumen terpilih. Konsumen yang sudah terpakai di invoice
 * (NgInvoice.konsumenId) dilindungi (blocked) agar histori invoice tetap utuh.
 */
export async function deleteNgKonsumen(
  ids: number[]
): Promise<{ ok: boolean; error?: string; deletedIds?: number[]; blocked?: string[] }> {
  const user = await requireRole("ADMIN_NONGUDANG");
  const parsed = z.array(dbId).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Pilihan konsumen tidak valid." };

  const deletable: number[] = [];
  const blocked: string[] = [];

  for (const id of parsed.data) {
    const k = await prisma.ngKonsumen.findUnique({ where: { id }, select: { id: true, nama: true } });
    if (!k) continue;

    const used = await prisma.ngInvoice.count({ where: { konsumenId: id } });
    if (used > 0) blocked.push(k.nama);
    else deletable.push(id);
  }

  if (deletable.length > 0) {
    try {
      await prisma.ngKonsumen.deleteMany({ where: { id: { in: deletable } } });
      await logActivity({
        userId: user.id,
        aksi: "DELETE_NG_KONSUMEN",
        entitas: "NgKonsumen",
        entitasId: deletable.join(","),
        detail: { dihapus: deletable.length, jumlahDipilih: parsed.data.length },
      });
    } catch (e) {
      return { ok: false, error: safeError(e, "Gagal menghapus konsumen.").error };
    }
  }

  revalidatePath("/non-gudang/konsumen");
  return { ok: true, deletedIds: deletable, blocked };
}
