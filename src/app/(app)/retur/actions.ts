"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { nextDocNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { dbId, money, qtyPositive, optionalText, safeError, firstIssue } from "@/lib/validation";
import { buildReturnItemCreateData } from "@/lib/returnRules";
import { createInvoiceVerifyUrl } from "@/lib/invoiceVerify";
import { afterCommit, invalidateAfterCommit } from "@/lib/postCommit";
import {
  findStoredResult,
  idempotencyKeySchema,
  IdempotencyMismatchError,
  recoverStoredResult,
  storeResult,
} from "@/lib/idempotency";
import { validateStockDemand } from "@/lib/inventoryRules";

const returnItemSchema = z.object({
  transactionItemId: dbId,
  itemId: dbId,
  qtyReturned: qtyPositive,
  hargaSnapshot: money.refine((n) => n > 0, "Harga tidak valid."),
  namaSnapshot: optionalText(FIELD_LIMITS.namaBarang, "Nama barang"),
});

const replacementItemSchema = z.object({
  itemId: dbId,
  qtyReplacement: qtyPositive,
});

const schema = z.object({
  tipe: z.enum(["RETUR", "TUKAR"]),
  transactionId: dbId,
  returnItems: z.array(returnItemSchema).min(1, "Minimal 1 barang diretur.").max(200, "Terlalu banyak item."),
  replacementItems: z.array(replacementItemSchema).max(200, "Terlalu banyak item.").optional().default([]),
  alasan: optionalText(FIELD_LIMITS.alasan, "Alasan"),
  namaClient: optionalText(FIELD_LIMITS.namaClient, "Nama pelanggan"),
  alamat: optionalText(FIELD_LIMITS.alamat, "Alamat"),
  namaWs: optionalText(FIELD_LIMITS.namaWs, "Nama workshop"),
  idempotencyKey: idempotencyKeySchema,
}).refine((d) => {
  if (d.tipe === "TUKAR" && d.replacementItems.length === 0) return false;
  return true;
}, { message: "Tukar barang wajib memiliki barang pengganti." });

export type ReturPayload = z.infer<typeof schema>;

type ReturnCommitted = {
  ok: true;
  id: number;
  noReturn: string;
  invoiceNo: string | null;
  selisih: number;
  replacementItems: { itemId: number; nama: string; hargaJual: number; qtyReplacement: number }[];
};

export async function createReturn(payload: ReturPayload) {
  const user = await requireRole("ADMIN_KASIR", "ADMIN_GUDANG");

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const d = parsed.data;

  let result;
  try {
  result = await prisma.$transaction(async (tx) => {
    // Retry of an already committed return: return it instead of moving stock twice.
    const stored = await findStoredResult<ReturnCommitted>(tx, d.idempotencyKey, "retur", user.id);
    if (stored) return { ...stored, replayed: true };

    const transaction = await tx.transaction.findUnique({
      where: { id: d.transactionId },
      include: {
        items: {
          include: { item: true },
        },
      },
    });
    if (!transaction) {
      return { ok: false, error: "Transaksi asli tidak ditemukan." };
    }

    const txItemMap = new Map(transaction.items.map((i) => [i.id, i]));
    const requestedByTxItem = new Map<number, number>();

    for (const ri of d.returnItems) {
      const txItem = txItemMap.get(ri.transactionItemId);
      if (!txItem) {
        return { ok: false, error: `Item "${ri.namaSnapshot}" tidak ditemukan di transaksi asli.` };
      }
      if (txItem.itemId !== ri.itemId) {
        return { ok: false, error: `Item "${ri.namaSnapshot}" tidak cocok dengan transaksi asli.` };
      }
      if (ri.hargaSnapshot !== Number(txItem.hargaSnapshot)) {
        return { ok: false, error: `Harga "${ri.namaSnapshot}" tidak sesuai dengan nota asli (${Number(txItem.hargaSnapshot)}).` };
      }
      requestedByTxItem.set(
        ri.transactionItemId,
        (requestedByTxItem.get(ri.transactionItemId) ?? 0) + ri.qtyReturned
      );
    }

    const previouslyReturned = await tx.returnItem.groupBy({
      by: ["transactionItemId"],
      where: {
        transactionItemId: { in: Array.from(requestedByTxItem.keys()) },
        return: { transactionId: d.transactionId },
      },
      _sum: { qtyReturned: true },
    });
    const alreadyReturnedMap = new Map(
      previouslyReturned.map((row) => [row.transactionItemId, row._sum.qtyReturned ?? 0])
    );

    for (const [transactionItemId, requestedQty] of requestedByTxItem) {
      const txItem = txItemMap.get(transactionItemId)!;
      const alreadyReturned = alreadyReturnedMap.get(transactionItemId) ?? 0;
      const availableForReturn = txItem.qty - alreadyReturned;
      if (requestedQty > availableForReturn) {
        return {
          ok: false,
          error: `Qty retur "${txItem.namaSnapshot}" melebihi sisa (beli ${txItem.qty}, sudah diretur ${alreadyReturned}, sisa ${availableForReturn}).`,
        };
      }
    }

    let replacementItems: { itemId: number; nama: string; hargaJual: number; qtyReplacement: number }[] = [];
    if (d.tipe === "TUKAR" && d.replacementItems.length > 0) {
      const repIds = Array.from(new Set(d.replacementItems.map((r) => r.itemId)));
      const repItemsFromDb = await tx.item.findMany({ where: { id: { in: repIds } } });
      const repItemMap = new Map(repItemsFromDb.map((i) => [i.id, i]));
      for (const ri of d.replacementItems) {
        const item = repItemMap.get(ri.itemId);
        if (!item) {
          return { ok: false, error: "Barang pengganti tidak ditemukan di database." };
        }
        replacementItems.push({
          itemId: item.id,
          nama: item.nama,
          hargaJual: Number(item.hargaJual),
          qtyReplacement: ri.qtyReplacement,
        });
      }

      const requestedByItem = new Map<number, number>();
      for (const item of replacementItems) {
        requestedByItem.set(item.itemId, (requestedByItem.get(item.itemId) ?? 0) + item.qtyReplacement);
      }
      const incomingByItem = new Map<number, number>();
      for (const item of d.returnItems) {
        incomingByItem.set(item.itemId, (incomingByItem.get(item.itemId) ?? 0) + item.qtyReturned);
      }
      const ledgerRows = await tx.stockLedger.groupBy({
        by: ["itemId"],
        where: { itemId: { in: repIds } },
        _sum: { qty: true },
      });
      const ledgerMap = new Map(ledgerRows.map((row) => [row.itemId, row._sum.qty ?? 0]));
      const stockValidation = validateStockDemand(
        repItemsFromDb.map((item) => ({
          nama: item.nama,
          aktif: item.aktif,
          stokAwal: item.stokAwal,
          ledgerQty: ledgerMap.get(item.id) ?? 0,
          requestedQty: requestedByItem.get(item.id) ?? 0,
          incomingQty: incomingByItem.get(item.id) ?? 0,
        }))
      );
      if (!stockValidation.ok) {
        return { ok: false, error: stockValidation.error };
      }
    }

    const totalRetur = d.returnItems.reduce(
      (sum, ri) => sum + ri.hargaSnapshot * ri.qtyReturned,
      0
    );
    const totalGanti = replacementItems.reduce(
      (sum, ri) => sum + ri.hargaJual * ri.qtyReplacement,
      0
    );
    const selisih = totalGanti - totalRetur;

    const returnItemCreate = buildReturnItemCreateData({
      tipe: d.tipe,
      returnItems: d.returnItems,
      replacementItems,
    });
    if (!returnItemCreate.ok) {
      return { ok: false, error: returnItemCreate.error };
    }

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
          create: returnItemCreate.createData,
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

    // Audit row commits atomically with the return/exchange.
    await logActivity({
      userId: user.id,
      aksi: d.tipe === "TUKAR" ? "TUKAR_BARANG" : "RETUR_BARANG",
      entitas: "Return",
      entitasId: ret.id,
      detail: { noReturn, selisih, itemCount: d.returnItems.length },
    }, tx);

    const committed: ReturnCommitted = { ok: true, id: ret.id, noReturn, invoiceNo, selisih, replacementItems };
    await storeResult(tx, d.idempotencyKey, "retur", user.id, committed);
    return { ...committed, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (e instanceof IdempotencyMismatchError) return { error: e.message };
    // A concurrent request with the same key may have committed first.
    const recovered = await recoverStoredResult<ReturnCommitted>(d.idempotencyKey, "retur", user.id);
    if (!recovered) return safeError(e, "Gagal memproses retur.");
    result = { ...recovered, replayed: true };
  }

  if ("error" in result) return { error: result.error };
  const replacementItems = result.replacementItems ?? [];

  // Committed. Nothing below may turn this return into a reported failure.
  invalidateAfterCommit({ paths: ["/", "/stok", "/retur", "/invoice"], tags: ["stock"] });

  const returnItemNames = d.returnItems.map((ri) => ri.namaSnapshot).join(", ");
  const gantiItemNames = replacementItems.map((ri) => ri.nama).join(", ");

  const invoiceNo = result.invoiceNo;
  const verifyUrl = invoiceNo
    ? await afterCommit("createInvoiceVerifyUrl", () => createInvoiceVerifyUrl(invoiceNo))
    : null;

  return {
    ok: true,
    id: result.id,
    noReturn: result.noReturn,
    invoiceNo: result.invoiceNo,
    verifyUrl,
    selisih: result.selisih,
    namaRetur: returnItemNames,
    qtyRetur: d.returnItems.reduce((s, ri) => s + ri.qtyReturned, 0),
    namaGanti: gantiItemNames || null,
    qtyGanti: replacementItems.reduce((s, ri) => s + ri.qtyReplacement, 0),
    replayed: result.replayed,
  };
}

export async function findTransactionByCode(code: string) {
  await requireRole("ADMIN_KASIR", "ADMIN_GUDANG");
  // Batasi panjang & normalisasi kode transaksi sebelum query.
  let searchCode = String(code ?? "").trim().slice(0, 40);
  if (!searchCode) return { error: "Kode transaksi atau nomor invoice wajib diisi." };

  // Normalisasi input jika huruf kecil (contoh: inv-00007 -> INV-00007, pc00005 -> PC00005)
  if (searchCode.toLowerCase().startsWith("inv-")) {
    searchCode = "INV-" + searchCode.slice(4);
  } else if (searchCode.toLowerCase().startsWith("pc")) {
    searchCode = "PC" + searchCode.slice(2);
  }

  let trx = null;

  // 1. Coba cari sebagai Invoice terlebih dahulu
  const inv = await prisma.invoice.findUnique({
    where: { noInvoice: searchCode },
    include: { return: true },
  });

  if (inv) {
    let targetTrxId = inv.transactionId;
    if (!targetTrxId && inv.returnId && inv.return) {
      targetTrxId = inv.return.transactionId;
    }

    if (targetTrxId) {
      trx = await prisma.transaction.findUnique({
        where: { id: targetTrxId },
        include: {
          items: {
            include: { item: true },
          },
        },
      });
    }
  }

  // 2. Jika tidak ditemukan lewat Invoice, cari langsung ke Transaction
  if (!trx) {
    trx = await prisma.transaction.findUnique({
      where: { noTransaksi: searchCode },
      include: {
        items: {
          include: { item: true },
        },
      },
    });
  }

  if (!trx) {
    return { error: "Transaksi atau invoice tidak ditemukan." };
  }

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
