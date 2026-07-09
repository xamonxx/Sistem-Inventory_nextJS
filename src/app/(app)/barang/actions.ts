"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { nextItemCode } from "@/lib/itemCode";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { dbId, strictBool, requiredText, money, boundedInt, safeError, firstIssue, type ActionResult } from "@/lib/validation";

const schema = z.object({
  id: dbId.optional(),
  // Kode boleh dikosongkan saat tambah barang -> di-generate otomatis (PC-XXX-NNN).
  // Bila diisi manual: batasi panjang & charset (allowlist).
  kode: z
    .string()
    .trim()
    .max(FIELD_LIMITS.kodeBarang, `Kode maksimal ${FIELD_LIMITS.kodeBarang} karakter`)
    .regex(/^[A-Za-z0-9._/-]*$/, "Kode hanya boleh huruf, angka, dan . _ / -")
    .optional()
    .default(""),
  nama: requiredText(FIELD_LIMITS.namaBarang, "Nama"),
  hargaBeli: money,
  hargaJual: money,
  stokAwal: boundedInt,
  minStok: boundedInt.refine((n) => n >= 0, "Minimum stok tidak boleh negatif."),
  aktif: strictBool.optional().default(true),
});

export async function saveItem(_prev: unknown, formData: FormData): Promise<ActionResult> {
  // Harga & stok awal HANYA boleh ADMIN_GUDANG
  const user = await requireRole("ADMIN_GUDANG");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    kode: formData.get("kode"),
    nama: formData.get("nama"),
    // Field number boleh dikosongkan di form (pakai placeholder) -> default aman.
    hargaBeli: formData.get("hargaBeli") || "0",
    hargaJual: formData.get("hargaJual") || "0",
    stokAwal: formData.get("stokAwal") || "0",
    minStok: formData.get("minStok") || "10",
    aktif: formData.get("aktif") === "on" || formData.get("aktif") === "true",
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const d = parsed.data;

  // Resolusi kode: saat tambah barang tanpa kode -> generate otomatis (PC-XXX-NNN).
  let kode = d.kode;
  if (!d.id && !kode) {
    kode = await nextItemCode(prisma, d.nama);
  }
  if (!kode) {
    return { error: "Kode wajib diisi." };
  }

  // Cek kode unik (selain dirinya sendiri saat edit)
  const dup = await prisma.item.findUnique({ where: { kode } });
  if (dup && dup.id !== d.id) {
    return { error: `Kode "${kode}" sudah dipakai barang lain.` };
  }

  try {
    if (d.id) {
      const before = await prisma.item.findUnique({ where: { id: d.id } });
      const updated = await prisma.item.update({
        where: { id: d.id },
        data: {
          kode,
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
          kode,
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
        detail: { kode, nama: d.nama },
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Kode "${kode}" sudah dipakai (unik).` };
    }
    return safeError(e, "Gagal menyimpan barang.");
  }

  revalidatePath("/barang");
  revalidatePath("/");        // Dashboard shows stock alerts
  revalidatePath("/stok");    // Stock page shows levels
  revalidateTag("stock");     // Invalidate stock cache (stokAwal changed)
  return { ok: true };
}

/** Sarankan kode otomatis untuk nama barang (dipakai tombol "Auto" di form). */
export async function suggestItemCode(nama: string): Promise<string> {
  await requireRole("ADMIN_GUDANG");
  const clean = String(nama ?? "").trim().slice(0, FIELD_LIMITS.namaBarang);
  if (!clean) return "";
  return nextItemCode(prisma, clean);
}

export async function toggleAktif(id: number, aktif: boolean): Promise<ActionResult> {
  const user = await requireRole("ADMIN_GUDANG");
  const parsed = z.object({ id: dbId, aktif: strictBool }).safeParse({ id, aktif });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    await prisma.item.update({ where: { id: parsed.data.id }, data: { aktif: parsed.data.aktif } });
    await logActivity({ userId: user.id, aksi: "TOGGLE_BARANG", entitas: "Item", entitasId: parsed.data.id, detail: { aktif: parsed.data.aktif } });
  } catch (e) {
    return safeError(e, "Gagal mengubah status barang.");
  }
  revalidatePath("/barang");
  return { ok: true };
}

/**
 * Hapus permanen barang terpilih (ADMIN_GUDANG). Hanya barang yang TIDAK punya
 * riwayat (transaksi, retur, kartu stok) yang boleh dihapus — supaya histori
 * keuangan tidak rusak. Barang yang punya riwayat dikembalikan sebagai "blocked".
 */
export async function deleteItems(
  ids: number[]
): Promise<{ ok: boolean; error?: string; deletedIds?: number[]; blocked?: string[] }> {
  const user = await requireRole("ADMIN_GUDANG");
  const parsed = z.array(dbId).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Pilihan barang tidak valid." };
  const selectedIds = Array.from(new Set(parsed.data));

  const deletable: number[] = [];
  const blocked: string[] = [];

  const [items, txCounts, retCounts, retGantiCounts, ledgerCounts] = await Promise.all([
    prisma.item.findMany({
      where: { id: { in: selectedIds } },
      select: { id: true, nama: true, kode: true },
    }),
    prisma.transactionItem.groupBy({
      by: ["itemId"],
      where: { itemId: { in: selectedIds } },
      _count: { id: true },
    }),
    prisma.returnItem.groupBy({
      by: ["itemId"],
      where: { itemId: { in: selectedIds } },
      _count: { id: true },
    }),
    prisma.returnItem.groupBy({
      by: ["itemGantiId"],
      where: { itemGantiId: { in: selectedIds } },
      _count: { id: true },
    }),
    prisma.stockLedger.groupBy({
      by: ["itemId"],
      where: { itemId: { in: selectedIds } },
      _count: { id: true },
    }),
  ]);

  const txMap = new Map(txCounts.map((row) => [row.itemId, row._count.id]));
  const retMap = new Map(retCounts.map((row) => [row.itemId, row._count.id]));
  const retGantiMap = new Map(retGantiCounts.map((row) => [row.itemGantiId, row._count.id]));
  const ledgerMap = new Map(ledgerCounts.map((row) => [row.itemId, row._count.id]));

  for (const item of items) {
    const tx = txMap.get(item.id) ?? 0;
    const ret = retMap.get(item.id) ?? 0;
    const retGanti = retGantiMap.get(item.id) ?? 0;
    const led = ledgerMap.get(item.id) ?? 0;

    if (tx + ret + retGanti + led > 0) {
      blocked.push(`${item.kode} · ${item.nama}`);
    } else {
      deletable.push(item.id);
    }
  }

  if (deletable.length > 0) {
    try {
      await prisma.item.deleteMany({ where: { id: { in: deletable } } });
      await logActivity({
        userId: user.id,
        aksi: "DELETE_BARANG",
        entitas: "Item",
        entitasId: deletable.join(","),
        detail: { dihapus: deletable.length, jumlahDipilih: selectedIds.length },
      });
    } catch (e) {
      return { ok: false, error: safeError(e, "Gagal menghapus barang.").error };
    }
  }

  revalidatePath("/barang");
  revalidatePath("/");
  revalidatePath("/stok");
  revalidateTag("stock");
  return { ok: true, deletedIds: deletable, blocked };
}

export async function getItemHistory(itemId: number) {
  await requireRole("ADMIN_KASIR", "ADMIN_GUDANG");
  const parsed = dbId.safeParse(itemId);
  if (!parsed.success) return [];
  const ledger = await prisma.stockLedger.findMany({
    where: { itemId: parsed.data },
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

export async function logBarcodePrint(itemId: number, nama: string): Promise<ActionResult> {
  const user = await requireRole("ADMIN_GUDANG");
  try {
    await logActivity({
      userId: user.id,
      aksi: "PRINT_BARCODE",
      entitas: "Item",
      entitasId: itemId,
      detail: { nama },
    });
    return { ok: true };
  } catch (e) {
    return safeError(e, "Gagal mencatat audit cetak barcode.");
  }
}
