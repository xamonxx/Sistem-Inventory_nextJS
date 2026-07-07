"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import {
  dbId,
  strictBool,
  requiredText,
  optionalText,
  money,
  safeError,
  firstIssue,
  type ActionResult,
} from "@/lib/validation";

const schema = z
  .object({
    id: dbId.optional(),
    nama: requiredText(FIELD_LIMITS.namaBarang, "Nama barang"),
    namaToko: requiredText(FIELD_LIMITS.supplierName, "Toko sumber"),
    kategori: optionalText(40, "Kategori"),
    satuan: optionalText(20, "Satuan"),
    hargaBeli: money,
    hargaJual: money,
    aktif: strictBool.optional().default(true),
  })
  .refine((d) => d.hargaJual >= d.hargaBeli, {
    message: "Harga jual tidak boleh lebih kecil dari harga beli.",
    path: ["hargaJual"],
  });

export async function saveNgProduk(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("ADMIN_NONGUDANG");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    nama: formData.get("nama"),
    namaToko: formData.get("namaToko"),
    kategori: formData.get("kategori") || "",
    satuan: formData.get("satuan") || "",
    hargaBeli: formData.get("hargaBeli") || "0",
    hargaJual: formData.get("hargaJual") || "0",
    aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const d = parsed.data;

  const data = {
    nama: d.nama,
    namaToko: d.namaToko,
    kategori: d.kategori || null,
    satuan: d.satuan || null,
    hargaBeli: new Prisma.Decimal(d.hargaBeli),
    hargaJual: new Prisma.Decimal(d.hargaJual),
    aktif: d.aktif,
  };

  try {
    if (d.id) {
      const updated = await prisma.ngProduk.update({ where: { id: d.id }, data });
      await logActivity({
        userId: user.id,
        aksi: "UPDATE_NG_PRODUK",
        entitas: "NgProduk",
        entitasId: updated.id,
        detail: { nama: d.nama, namaToko: d.namaToko, hargaBeli: d.hargaBeli, hargaJual: d.hargaJual },
      });
    } else {
      const created = await prisma.ngProduk.create({ data });
      await logActivity({
        userId: user.id,
        aksi: "CREATE_NG_PRODUK",
        entitas: "NgProduk",
        entitasId: created.id,
        detail: { nama: d.nama, namaToko: d.namaToko },
      });
    }
  } catch (e) {
    return safeError(e, "Gagal menyimpan barang non-gudang.");
  }

  revalidatePath("/non-gudang/barang");
  return { ok: true };
}

export async function toggleNgProdukAktif(id: number, aktif: boolean): Promise<ActionResult> {
  const user = await requireRole("ADMIN_NONGUDANG");
  const parsed = z.object({ id: dbId, aktif: strictBool }).safeParse({ id, aktif });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    await prisma.ngProduk.update({ where: { id: parsed.data.id }, data: { aktif: parsed.data.aktif } });
    await logActivity({
      userId: user.id,
      aksi: "TOGGLE_NG_PRODUK",
      entitas: "NgProduk",
      entitasId: parsed.data.id,
      detail: { aktif: parsed.data.aktif },
    });
  } catch (e) {
    return safeError(e, "Gagal mengubah status barang.");
  }
  revalidatePath("/non-gudang/barang");
  return { ok: true };
}

/**
 * Hapus permanen barang non-gudang terpilih. Hanya barang yang TIDAK pernah
 * dipakai di invoice (ng_invoice_items) yang boleh dihapus — supaya histori
 * margin/pembelian tidak rusak. Barang yang terpakai dikembalikan sebagai "blocked".
 */
export async function deleteNgProduk(
  ids: number[]
): Promise<{ ok: boolean; error?: string; deletedIds?: number[]; blocked?: string[] }> {
  const user = await requireRole("ADMIN_NONGUDANG");
  const parsed = z.array(dbId).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Pilihan barang tidak valid." };

  const deletable: number[] = [];
  const blocked: string[] = [];

  for (const id of parsed.data) {
    const produk = await prisma.ngProduk.findUnique({
      where: { id },
      select: { id: true, nama: true, namaToko: true },
    });
    if (!produk) continue;

    const used = await prisma.ngInvoiceItem.count({ where: { produkId: id } });
    if (used > 0) {
      blocked.push(`${produk.nama} · ${produk.namaToko}`);
    } else {
      deletable.push(id);
    }
  }

  if (deletable.length > 0) {
    try {
      await prisma.ngProduk.deleteMany({ where: { id: { in: deletable } } });
      await logActivity({
        userId: user.id,
        aksi: "DELETE_NG_PRODUK",
        entitas: "NgProduk",
        entitasId: deletable.join(","),
        detail: { dihapus: deletable.length, jumlahDipilih: parsed.data.length },
      });
    } catch (e) {
      return { ok: false, error: safeError(e, "Gagal menghapus barang.").error };
    }
  }

  revalidatePath("/non-gudang/barang");
  return { ok: true, deletedIds: deletable, blocked };
}
