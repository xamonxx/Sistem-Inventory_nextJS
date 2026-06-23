"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { nextDocNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";

const schema = z
  .object({
    tipe: z.enum(["RETUR", "TUKAR"]),
    itemReturId: z.number().int(),
    qtyRetur: z.number().int().positive(),
    itemGantiId: z.number().int().nullable().optional(),
    qtyGanti: z.number().int().positive().nullable().optional(),
    alasan: z.string().trim().optional().default(""),
    namaClient: z.string().trim().optional().default(""),
    alamat: z.string().trim().optional().default(""),
    namaWs: z.string().trim().optional().default(""),
  })
  .refine((d) => d.tipe === "RETUR" || (d.itemGantiId && d.qtyGanti), {
    message: "Untuk Tukar Barang, barang pengganti & qty wajib diisi.",
  });

export type ReturPayload = z.infer<typeof schema>;

export async function createReturn(payload: ReturPayload) {
  // Retur boleh kasir & gudang
  const user = await requireRole("ADMIN_KASIR", "ADMIN_GUDANG");

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  const itemRetur = await prisma.item.findUnique({ where: { id: d.itemReturId } });
  if (!itemRetur) return { error: "Barang retur tidak ditemukan." };

  let itemGanti = null;
  if (d.tipe === "TUKAR") {
    itemGanti = await prisma.item.findUnique({ where: { id: d.itemGantiId! } });
    if (!itemGanti) return { error: "Barang pengganti tidak ditemukan." };
  }

  const hargaRetur = new Prisma.Decimal(itemRetur.hargaJual);
  const totalRetur = hargaRetur.mul(d.qtyRetur);
  const hargaGanti = itemGanti ? new Prisma.Decimal(itemGanti.hargaJual) : new Prisma.Decimal(0);
  const totalGanti = itemGanti ? hargaGanti.mul(d.qtyGanti!) : new Prisma.Decimal(0);
  const selisih = totalGanti.sub(totalRetur); // >0 tagihan, <0 refund

  const result = await prisma.$transaction(async (tx) => {
    const noReturn = await nextDocNumber(tx, "return");

    const ret = await tx.return.create({
      data: {
        noReturn,
        tipe: d.tipe,
        alasan: d.alasan || null,
        itemReturId: itemRetur.id,
        qtyRetur: d.qtyRetur,
        hargaReturSnapshot: hargaRetur,
        itemGantiId: itemGanti?.id ?? null,
        qtyGanti: d.tipe === "TUKAR" ? d.qtyGanti : null,
        hargaGantiSnapshot: itemGanti ? hargaGanti : null,
        selisih,
        namaClient: d.namaClient || null,
        alamat: d.alamat || null,
        namaWs: d.namaWs || null,
        userId: user.id,
      },
    });

    // Barang A (diretur) MASUK stok
    await tx.stockLedger.create({
      data: {
        itemId: itemRetur.id,
        tipe: "RETUR",
        qty: d.qtyRetur,
        keterangan: `Retur ${noReturn}`,
        refType: "RETURN",
        refId: ret.id,
        userId: user.id,
      },
    });

    // Barang B (pengganti) KELUAR stok (boleh minus)
    if (itemGanti) {
      await tx.stockLedger.create({
        data: {
          itemId: itemGanti.id,
          tipe: "KELUAR",
          qty: -d.qtyGanti!,
          keterangan: `Tukar (pengganti) ${noReturn}`,
          refType: "RETURN",
          refId: ret.id,
          userId: user.id,
        },
      });
    }

    // Selisih positif => invoice tagihan
    let invoiceNo: string | null = null;
    if (selisih.gt(0)) {
      invoiceNo = await nextDocNumber(tx, "invoice");
      await tx.invoice.create({
        data: {
          noInvoice: invoiceNo,
          status: "PENDING",
          returnId: ret.id,
          namaClient: d.namaClient || null,
          alamat: d.alamat || null,
          namaWs: d.namaWs || null,
          total: selisih,
        },
      });
    }

    return { id: ret.id, noReturn, invoiceNo, selisih: Number(selisih) };
  });

  await logActivity({
    userId: user.id,
    aksi: d.tipe === "TUKAR" ? "TUKAR_BARANG" : "RETUR_BARANG",
    entitas: "Return",
    entitasId: result.id,
    detail: { noReturn: result.noReturn, selisih: result.selisih },
  });

  return {
    ok: true,
    ...result,
    namaRetur: itemRetur.nama,
    hargaRetur: Number(hargaRetur),
    qtyRetur: d.qtyRetur,
    namaGanti: itemGanti?.nama ?? null,
    hargaGanti: Number(hargaGanti),
    qtyGanti: d.qtyGanti ?? null,
  };
}

export async function findTransactionByCode(code: string) {
  const user = await requireRole("ADMIN_KASIR", "ADMIN_GUDANG");
  const trx = await prisma.transaction.findUnique({
    where: { noTransaksi: code },
    include: {
      items: {
        include: { item: true },
      },
    },
  });
  if (!trx) return { error: "Transaksi tidak ditemukan." };
  return {
    ok: true,
    id: trx.id,
    noTransaksi: trx.noTransaksi,
    namaClient: trx.namaClient ?? "",
    alamat: trx.alamat ?? "",
    namaWs: trx.namaWs ?? "",
    items: trx.items.map((it) => ({
      itemId: it.itemId,
      nama: it.namaSnapshot,
      kode: it.item.kode,
      qty: it.qty,
      harga: Number(it.hargaSnapshot),
    })),
  };
}
