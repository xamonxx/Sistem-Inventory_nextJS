"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { nextDocNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";

const returnItemSchema = z.object({
  transactionItemId: z.number().int().positive(),
  itemId: z.number().int().positive(),
  qtyReturned: z.number().int().positive(),
  hargaSnapshot: z.number().positive(),
  namaSnapshot: z.string(),
});

const replacementItemSchema = z.object({
  itemId: z.number().int().positive(),
  qtyReplacement: z.number().int().positive(),
});

const schema = z.object({
  tipe: z.enum(["RETUR", "TUKAR"]),
  transactionId: z.number().int().positive(),
  returnItems: z.array(returnItemSchema).min(1, "Minimal 1 barang diretur."),
  replacementItems: z.array(replacementItemSchema).optional().default([]),
  alasan: z.string().trim().optional().default(""),
  namaClient: z.string().trim().optional().default(""),
  alamat: z.string().trim().optional().default(""),
  namaWs: z.string().trim().optional().default(""),
}).refine((d) => {
  if (d.tipe === "TUKAR" && d.replacementItems.length === 0) return false;
  return true;
}, { message: "Tukar barang wajib memiliki barang pengganti." });

export type ReturPayload = z.infer<typeof schema>;
type ReturnItemInput = z.infer<typeof returnItemSchema>;
type ReplacementItemInput = z.infer<typeof replacementItemSchema>;

export async function createReturn(payload: ReturPayload) {
  const user = await requireRole("ADMIN_KASIR", "ADMIN_GUDANG");

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  // 1. Validasi transaksi asli ada
  const transaction = await prisma.transaction.findUnique({
    where: { id: d.transactionId },
    include: {
      items: {
        include: { item: true },
      },
    },
  });
  if (!transaction) {
    return { error: "Transaksi asli tidak ditemukan." };
  }

  const txItemMap = new Map(transaction.items.map((i) => [i.id, i]));

  // 2. Validasi setiap return item ada di transaksi asli
  for (const ri of d.returnItems) {
    const txItem = txItemMap.get(ri.transactionItemId);
    if (!txItem) {
      return { error: `Item "${ri.namaSnapshot}" tidak ditemukan di transaksi asli.` };
    }
    if (txItem.itemId !== ri.itemId) {
      return { error: `Item "${ri.namaSnapshot}" tidak cocok dengan transaksi asli.` };
    }

    // 3. Hitung sudah berapa banyak qty item ini diretur sebelumnya
    const previouslyReturned = await prisma.returnItem.aggregate({
      where: {
        transactionItemId: ri.transactionItemId,
        return: { transactionId: d.transactionId },
      },
      _sum: { qtyReturned: true },
    });
    const alreadyReturned = previouslyReturned._sum.qtyReturned ?? 0;
    const availableForReturn = txItem.qty - alreadyReturned;
    if (ri.qtyReturned > availableForReturn) {
      return {
        error: `Qty retur "${ri.namaSnapshot}" melebihi sisa (beli ${txItem.qty}, sudah diretur ${alreadyReturned}, sisa ${availableForReturn}).`,
      };
    }

    // 4. Validasi harga snapshot cocok dengan transaksi asli
    if (ri.hargaSnapshot !== Number(txItem.hargaSnapshot)) {
      return { error: `Harga "${ri.namaSnapshot}" tidak sesuai dengan nota asli (${Number(txItem.hargaSnapshot)}).` };
    }
  }

  // 5. Validasi barang pengganti (untuk TUKAR)
  let replacementItems: { itemId: number; nama: string; hargaJual: number; qtyReplacement: number }[] = [];
  if (d.tipe === "TUKAR" && d.replacementItems.length > 0) {
    const repIds = d.replacementItems.map((r) => r.itemId);
    const repItemsFromDb = await prisma.item.findMany({ where: { id: { in: repIds } } });
    const repItemMap = new Map(repItemsFromDb.map((i) => [i.id, i]));
    for (const ri of d.replacementItems) {
      const item = repItemMap.get(ri.itemId);
      if (!item) {
        return { error: "Barang pengganti tidak ditemukan di database." };
      }
      replacementItems.push({
        itemId: item.id,
        nama: item.nama,
        hargaJual: Number(item.hargaJual),
        qtyReplacement: ri.qtyReplacement,
      });
    }
  }

  // 6. Hitung total nilai
  let totalRetur = 0;
  for (const ri of d.returnItems) {
    totalRetur += ri.hargaSnapshot * ri.qtyReturned;
  }
  let totalGanti = 0;
  for (const ri of replacementItems) {
    totalGanti += ri.hargaJual * ri.qtyReplacement;
  }
  const selisih = totalGanti - totalRetur;

  const result = await prisma.$transaction(async (tx) => {
    const noReturn = await nextDocNumber(tx, "return");

    const ret = await tx.return.create({
      data: {
        noReturn,
        tipe: d.tipe,
        transactionId: d.transactionId,
        alasan: d.alasan || null,
        selisih,
        namaClient: d.namaClient || null,
        alamat: d.alamat || null,
        namaWs: d.namaWs || null,
        userId: user.id,
        items: {
          create: d.returnItems.map((ri) => ({
            transactionItemId: ri.transactionItemId,
            itemId: ri.itemId,
            namaSnapshot: ri.namaSnapshot,
            hargaSnapshot: ri.hargaSnapshot,
            qtyReturned: ri.qtyReturned,
            subtotal: ri.hargaSnapshot * ri.qtyReturned,
            ...(d.tipe === "TUKAR" ? {
              itemGantiId: replacementItems.find((r) => r.itemId === replacementItems[0]?.itemId)?.itemId ?? null,
              namaGantiSnapshot: replacementItems.find((r) => r.itemId === replacementItems[0]?.itemId)?.nama ?? null,
              hargaGantiSnapshot: replacementItems.find((r) => r.itemId === replacementItems[0]?.itemId)?.hargaJual ?? null,
              qtyGanti: replacementItems.find((r) => r.itemId === replacementItems[0]?.itemId)?.qtyReplacement ?? null,
              subtotalGanti: replacementItems.find((r) => r.itemId === replacementItems[0]?.itemId)
                ? (replacementItems.find((r) => r.itemId === replacementItems[0]?.itemId)!.hargaJual * replacementItems.find((r) => r.itemId === replacementItems[0]?.itemId)!.qtyReplacement)
                : null,
            } : {}),
          })),
        },
      },
      include: { items: true },
    });

    // Stock ledger: barang diretur MASUK
    for (const ri of d.returnItems) {
      await tx.stockLedger.create({
        data: {
          itemId: ri.itemId,
          tipe: "RETUR",
          qty: ri.qtyReturned,
          keterangan: `Retur ${noReturn}`,
          refType: "RETURN",
          refId: ret.id,
          userId: user.id,
        },
      });
    }

    // Stock ledger: barang pengganti KELUAR
    for (const ri of replacementItems) {
      await tx.stockLedger.create({
        data: {
          itemId: ri.itemId,
          tipe: "KELUAR",
          qty: -ri.qtyReplacement,
          keterangan: `Tukar (pengganti) ${noReturn}`,
          refType: "RETURN",
          refId: ret.id,
          userId: user.id,
        },
      });
    }

    // Selisih positif => invoice tagihan
    let invoiceNo: string | null = null;
    if (selisih > 0) {
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

    return { id: ret.id, noReturn, invoiceNo, selisih, items: ret.items };
  });

  await logActivity({
    userId: user.id,
    aksi: d.tipe === "TUKAR" ? "TUKAR_BARANG" : "RETUR_BARANG",
    entitas: "Return",
    entitasId: result.id,
    detail: { noReturn: result.noReturn, selisih: result.selisih, itemCount: d.returnItems.length },
  });

  const returnItemNames = d.returnItems.map((ri) => ri.namaSnapshot).join(", ");
  const gantiItemNames = replacementItems.map((ri) => ri.nama).join(", ");

  return {
    ok: true,
    id: result.id,
    noReturn: result.noReturn,
    invoiceNo: result.invoiceNo,
    selisih: result.selisih,
    namaRetur: returnItemNames,
    qtyRetur: d.returnItems.reduce((s, ri) => s + ri.qtyReturned, 0),
    namaGanti: gantiItemNames || null,
    qtyGanti: replacementItems.reduce((s, ri) => s + ri.qtyReplacement, 0),
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

  // Hitung qty yang sudah diretur untuk setiap item
  const returnedQtys = await prisma.returnItem.groupBy({
    by: ["transactionItemId"],
    where: {
      transactionItem: { transactionId: trx.id },
      return: { transactionId: trx.id },
    },
    _sum: { qtyReturned: true },
  });
  const returnedMap = new Map(returnedQtys.map((r) => [r.transactionItemId, r._sum.qtyReturned ?? 0]));

  return {
    ok: true,
    id: trx.id,
    noTransaksi: trx.noTransaksi,
    namaClient: trx.namaClient ?? "",
    alamat: trx.alamat ?? "",
    namaWs: trx.namaWs ?? "",
    items: trx.items.map((it) => {
      const alreadyReturned = returnedMap.get(it.id) ?? 0;
      return {
        transactionItemId: it.id,
        itemId: it.itemId,
        nama: it.namaSnapshot,
        kode: it.item.kode,
        qty: it.qty,
        alreadyReturned,
        availableForReturn: it.qty - alreadyReturned,
        harga: Number(it.hargaSnapshot),
      };
    }),
  };
}
