"use server";

import { z } from "zod";
import { Prisma, PaymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { invalidateAfterCommit } from "@/lib/postCommit";
import { runSerializable } from "@/lib/serializable";
import {
  findStoredResult,
  idempotencyKeySchema,
  IdempotencyMismatchError,
  recoverStoredResult,
  storeResult,
} from "@/lib/idempotency";
import { dbId, money, safeError, firstIssue } from "@/lib/validation";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { invoiceItemPayloadSchema } from "@/lib/invoiceRules";
import { InventoryRuleError, validateStockDemand } from "@/lib/inventoryRules";

class InvoiceRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceRuleError";
  }
}

// CREDIT = piutang tempo yang belum dibayar, jadi tidak boleh dicatat sebagai pelunasan.
const bayarSchema = z.object({
  invoiceId: dbId,
  jumlah: money.refine((n) => n > 0, "Jumlah bayar harus lebih dari 0."),
  tipe: z.enum(["CASH", "TRANSFER"], { message: "Metode pembayaran harus Tunai atau Transfer." }),
  idempotencyKey: idempotencyKeySchema,
});

type BayarInvoiceCommitted = {
  ok: true;
  payment: { id: number; tanggal: string; tipe: PaymentType; jumlah: number; keterangan: string | null };
};

export async function bayarInvoice(
  invoiceId: number,
  jumlah: number,
  tipe: Extract<PaymentType, "CASH" | "TRANSFER"> = "CASH",
  idempotencyKey?: string
) {
  // Pembayaran/penagihan = domain kasir
  const user = await requireRole("ADMIN_KASIR");

  const parsed = bayarSchema.safeParse({ invoiceId, jumlah, tipe, idempotencyKey });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  ({ invoiceId, jumlah, tipe, idempotencyKey } = parsed.data);

  let result;
  try {
    result = await runSerializable(async (tx) => {
      // Retry of an already committed payment: return it instead of paying twice.
      const stored = await findStoredResult<BayarInvoiceCommitted>(tx, idempotencyKey, "bayar_invoice", user.id);
      if (stored) return { ...stored, replayed: true };

      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) return { error: "Invoice tidak ditemukan." };

      const sisa = Number(inv.total) - Number(inv.totalDibayar);
      if (sisa <= 0) return { error: "Invoice ini sudah lunas." };
      const bayar = Math.min(jumlah, sisa);
      const totalDibayar = new Prisma.Decimal(inv.totalDibayar).add(bayar);
      const lunas = totalDibayar.gte(inv.total);

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { totalDibayar, status: lunas ? "LUNAS" : "PARTIAL" },
      });

      const payment = await tx.payment.create({
        data: {
          tipe,
          jumlah: bayar,
          invoiceId,
          keterangan: `Pembayaran cicilan untuk ${inv.noInvoice}`,
        },
      });

      // Audit row commits atomically with the payment.
      await logActivity({
        userId: user.id,
        aksi: "BAYAR_INVOICE",
        entitas: "Invoice",
        entitasId: invoiceId,
        detail: { bayar, lunas, tipe },
      }, tx);

      const committed: BayarInvoiceCommitted = {
        ok: true,
        payment: {
          id: payment.id,
          tanggal: payment.tanggal.toISOString(),
          tipe: payment.tipe,
          jumlah: Number(payment.jumlah),
          keterangan: payment.keterangan,
        },
      };
      await storeResult(tx, idempotencyKey, "bayar_invoice", user.id, committed);
      return { ...committed, replayed: false };
    });
  } catch (e) {
    if (e instanceof IdempotencyMismatchError) return { error: e.message };
    // A concurrent request with the same key may have committed first.
    const recovered = await recoverStoredResult<BayarInvoiceCommitted>(idempotencyKey, "bayar_invoice", user.id);
    if (!recovered) return safeError(e, "Gagal memproses pembayaran.");
    result = { ...recovered, replayed: true };
  }

  if (!("ok" in result)) return result;

  // Committed. Cache invalidation is best-effort and cannot report a failure.
  invalidateAfterCommit({ paths: ["/invoice", "/"] });
  return { ok: true, payment: result.payment, replayed: result.replayed };
}

const updateInvoiceSchema = z.object({
  id: dbId,
  noInvoice: z.string().min(1, "Nomor invoice wajib diisi.").max(30, "Nomor invoice terlalu panjang."),
  tanggal: z.coerce.date(),
  namaClient: z.string().min(1, "Nama pelanggan wajib diisi.").max(FIELD_LIMITS.namaClient, "Nama pelanggan terlalu panjang."),
  alamat: z.string().max(FIELD_LIMITS.alamat, "Alamat terlalu panjang.").nullable().optional(),
  namaWs: z.string().max(FIELD_LIMITS.namaWs, "Nama workshop terlalu panjang.").nullable().optional(),
  // Info pembayaran (opsional) — tampil di bagian PEMBAYARAN pada invoice/nota.
  namaBank: z.string().max(FIELD_LIMITS.namaBank, "Nama bank terlalu panjang.").nullable().optional(),
  noRekening: z.string().max(FIELD_LIMITS.noRekening, "No. rekening terlalu panjang.").nullable().optional(),
  atasNama: z.string().max(FIELD_LIMITS.atasNama, "Atas nama terlalu panjang.").nullable().optional(),
});

export async function updateInvoice(
  id: number,
  data: {
    noInvoice: string;
    tanggal: Date | string;
    namaClient: string;
    alamat?: string | null;
    namaWs?: string | null;
  }
) {
  const user = await requireRole("ADMIN_KASIR");

  const parsed = updateInvoiceSchema.safeParse({ id, ...data });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const val = parsed.data;

  const existing = await prisma.invoice.findFirst({
    where: {
      noInvoice: val.noInvoice,
      id: { not: val.id },
    },
  });
  if (existing) {
    return { error: `Nomor invoice "${val.noInvoice}" sudah dipakai.` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: val.id },
        data: {
          noInvoice: val.noInvoice,
          tanggal: val.tanggal,
          namaClient: val.namaClient,
          alamat: val.alamat,
          namaWs: val.namaWs,
        },
      });

      await logActivity({
        userId: user.id,
        aksi: "UPDATE_INVOICE",
        entitas: "Invoice",
        entitasId: val.id,
        detail: { noInvoice: val.noInvoice },
      }, tx);
    });
  } catch (e) {
    return safeError(e, "Gagal mengubah invoice.");
  }

  invalidateAfterCommit({ paths: ["/invoice"] });
  return { ok: true };
}

export async function deleteInvoice(id: number) {
  const user = await requireRole("ADMIN_KASIR");
  const parsed = dbId.safeParse(id);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  id = parsed.data;

  let deleted: { noInvoice: string } | null;
  try {
    deleted = await runSerializable(async (tx) => {
      // Read inside the transaction so links cannot change between read and delete.
      const inv = await tx.invoice.findUnique({
        where: { id },
        select: { noInvoice: true, transactionId: true, returnId: true },
      });
      if (!inv) return null;

      // 1. Clean up transaction and all its dependencies if it exists
      if (inv.transactionId) {
        // Find any returns associated with this transaction
        const returns = await tx.return.findMany({
          where: { transactionId: inv.transactionId },
          select: { id: true },
        });
        const returnIds = returns.map((r) => r.id);

        if (returnIds.length > 0) {
          // Delete stock ledgers for returns
          await tx.stockLedger.deleteMany({
            where: {
              refType: "RETURN",
              refId: { in: returnIds },
            },
          });
          // Delete invoices associated with these returns (except the current one)
          await tx.invoice.deleteMany({
            where: {
              returnId: { in: returnIds },
              id: { not: id },
            },
          });
          // Delete the returns themselves
          await tx.return.deleteMany({
            where: { id: { in: returnIds } },
          });
        }

        // Delete stock ledgers for transaction
        await tx.stockLedger.deleteMany({
          where: {
            refType: "TRANSACTION",
            refId: inv.transactionId,
          },
        });

        // Delete payments associated with transaction
        await tx.payment.deleteMany({
          where: { transactionId: inv.transactionId },
        });

        // Delete other invoices associated with the same transaction (except the current one)
        await tx.invoice.deleteMany({
          where: {
            transactionId: inv.transactionId,
            id: { not: id },
          },
        });

        // Delete the transaction itself (cascades to transaction items)
        await tx.transaction.delete({
          where: { id: inv.transactionId },
        });
      }

      // 2. Clean up direct return if it exists on the invoice and wasn't already
      // deleted in step 1 (when inv.returnId is a return linked to inv.transactionId).
      if (inv.returnId) {
        const returnStillExists = await tx.return.findUnique({ where: { id: inv.returnId }, select: { id: true } });
        if (returnStillExists) {
          await tx.stockLedger.deleteMany({
            where: { refType: "RETURN", refId: inv.returnId },
          });
          await tx.invoice.deleteMany({
            where: { returnId: inv.returnId, id: { not: id } },
          });
          await tx.return.delete({ where: { id: inv.returnId } });
        }
      }

      // 3. Delete payments linked directly to this invoice
      await tx.payment.deleteMany({
        where: { invoiceId: id },
      });

      // 4. Delete the invoice itself
      await tx.invoice.delete({
        where: { id },
      });

      await logActivity({
        userId: user.id,
        aksi: "HAPUS_INVOICE",
        entitas: "Invoice",
        entitasId: id,
        detail: { noInvoice: inv.noInvoice },
      }, tx);

      return { noInvoice: inv.noInvoice };
    });
  } catch (e) {
    return safeError(e, "Gagal menghapus invoice.");
  }

  if (!deleted) return { error: "Invoice tidak ditemukan." };

  // Ledger rows changed: stock, dashboard, and cashier availability must refresh now (AUD-008).
  invalidateAfterCommit({ paths: ["/invoice", "/", "/stok", "/kasir", "/retur"], tags: ["stock"] });
  return { ok: true };
}

export async function deleteInvoices(ids: number[]) {
  const user = await requireRole("ADMIN_KASIR");
  const parsed = z.array(dbId).min(1, "Minimal 1 invoice dipilih.").max(200, "Terlalu banyak invoice dipilih.").safeParse(ids);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  ids = Array.from(new Set(parsed.data));

  try {
    await runSerializable(async (tx) => {
      // Read inside the transaction so links cannot change between read and delete.
      const invoices = await tx.invoice.findMany({
        where: { id: { in: ids } },
        select: { id: true, transactionId: true, returnId: true },
      });

      const transactionIds = invoices
        .map((inv) => inv.transactionId)
        .filter((id): id is number => id !== null);
      const directReturnIds = invoices
        .map((inv) => inv.returnId)
        .filter((id): id is number => id !== null);

      // 1. Handle transactionIds
      if (transactionIds.length > 0) {
        // Find returns linked to these transactions
        const returns = await tx.return.findMany({
          where: { transactionId: { in: transactionIds } },
          select: { id: true },
        });
        const returnIds = returns.map((r) => r.id);
        const allReturnIds = Array.from(new Set([...returnIds, ...directReturnIds]));

        if (allReturnIds.length > 0) {
          // Delete return stock ledgers
          await tx.stockLedger.deleteMany({
            where: {
              refType: "RETURN",
              refId: { in: allReturnIds },
            },
          });
          // Delete other invoices associated with returns (excluding the ones we are deleting anyway)
          await tx.invoice.deleteMany({
            where: {
              returnId: { in: allReturnIds },
              id: { notIn: ids },
            },
          });
          // Delete returns
          await tx.return.deleteMany({
            where: { id: { in: allReturnIds } },
          });
        }

        // Delete transaction stock ledgers
        await tx.stockLedger.deleteMany({
          where: {
            refType: "TRANSACTION",
            refId: { in: transactionIds },
          },
        });

        // Delete payments for these transactions
        await tx.payment.deleteMany({
          where: { transactionId: { in: transactionIds } },
        });

        // Delete other invoices associated with the same transactions
        await tx.invoice.deleteMany({
          where: {
            transactionId: { in: transactionIds },
            id: { notIn: ids },
          },
        });

        // Delete transactions
        await tx.transaction.deleteMany({
          where: { id: { in: transactionIds } },
        });
      } else if (directReturnIds.length > 0) {
        // Just direct returns (no transactionIds)
        await tx.stockLedger.deleteMany({
          where: {
            refType: "RETURN",
            refId: { in: directReturnIds },
          },
        });
        await tx.invoice.deleteMany({
          where: {
            returnId: { in: directReturnIds },
            id: { notIn: ids },
          },
        });
        await tx.return.deleteMany({
          where: { id: { in: directReturnIds } },
        });
      }

      // 2. Delete payments linked directly to these invoices
      await tx.payment.deleteMany({
        where: { invoiceId: { in: ids } },
      });

      // 3. Delete the invoices themselves
      await tx.invoice.deleteMany({
        where: { id: { in: ids } },
      });

      await logActivity({
        userId: user.id,
        aksi: "HAPUS_INVOICE_MASSAL",
        entitas: "Invoice",
        detail: { count: ids.length, ids },
      }, tx);
    });
  } catch (e) {
    return safeError(e, "Gagal menghapus beberapa invoice.");
  }

  // Ledger rows changed: stock, dashboard, and cashier availability must refresh now (AUD-008).
  invalidateAfterCommit({ paths: ["/invoice", "/", "/stok", "/kasir", "/retur"], tags: ["stock"] });
  return { ok: true };
}

export async function updateInvoiceAndItems(
  id: number,
  metadata: {
    noInvoice: string;
    tanggal: Date | string;
    namaClient: string;
    alamat?: string | null;
    namaWs?: string | null;
    namaBank?: string | null;
    noRekening?: string | null;
    atasNama?: string | null;
  },
  itemsPayload: { itemId: number; qty: number }[]
) {
  const user = await requireRole("ADMIN_KASIR");

  const parsed = updateInvoiceSchema.safeParse({ id, ...metadata });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const val = parsed.data;
  const parsedItems = invoiceItemPayloadSchema.safeParse(itemsPayload);
  if (!parsedItems.success) return { error: firstIssue(parsedItems.error) };
  const invoiceItems = parsedItems.data;

  const existing = await prisma.invoice.findFirst({
    where: {
      noInvoice: val.noInvoice,
      id: { not: val.id },
    },
  });
  if (existing) {
    return { error: `Nomor invoice "${val.noInvoice}" sudah dipakai.` };
  }

  try {
    // AUD-004: the whole read-check-write runs Serializable (retried on conflict),
    // so a concurrent checkout cannot consume the same stock between the check and the write.
    await runSerializable(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: val.id },
        include: { transaction: true, return: true },
      });
      if (!inv) throw new InvoiceRuleError("Invoice tidak ditemukan.");

      await tx.invoice.update({
        where: { id: val.id },
        data: {
          noInvoice: val.noInvoice,
          tanggal: val.tanggal,
          namaClient: val.namaClient,
          alamat: val.alamat,
          namaWs: val.namaWs,
        },
      });

      // Update info pembayaran (opsional) pada transaksi yang tertaut — bagian
      // PEMBAYARAN di invoice/nota mengambil data ini dari Transaction.
      const bankTxId = inv.transactionId ?? inv.return?.transactionId ?? null;
      if (bankTxId) {
        const norm = (v?: string | null) => (v && v.trim() ? v.trim() : null);
        await tx.transaction.update({
          where: { id: bankTxId },
          data: {
            namaBank: norm(val.namaBank),
            noRekening: norm(val.noRekening),
            atasNama: norm(val.atasNama),
          },
        });
      }

      if (inv.transactionId) {
        const txId = inv.transactionId;

        const existingTxItems = await tx.transactionItem.findMany({
          where: { transactionId: txId },
        });

        const returnedQtyRows = await tx.returnItem.groupBy({
          by: ["transactionItemId"],
          where: { transactionItemId: { in: existingTxItems.map((item) => item.id) } },
          _sum: { qtyReturned: true },
        });
        const desiredQtyMap = new Map(invoiceItems.map((item) => [item.itemId, item.qty]));
        for (const returned of returnedQtyRows) {
          const existingItem = existingTxItems.find((item) => item.id === returned.transactionItemId);
          if (!existingItem) continue;
          const returnedQty = returned._sum.qtyReturned ?? 0;
          const desiredQty = desiredQtyMap.get(existingItem.itemId) ?? 0;
          if (desiredQty < returnedQty) {
            throw new InvoiceRuleError(
              `Qty "${existingItem.namaSnapshot}" tidak boleh lebih kecil dari jumlah yang sudah diretur (${returnedQty}).`
            );
          }
        }

        const desiredItems = invoiceItems.filter((item) => item.qty > 0);
        const desiredIds = desiredItems.map((item) => item.itemId);
        const masterItems = await tx.item.findMany({
          where: { id: { in: desiredIds } },
        });
        if (masterItems.length !== desiredIds.length) {
          throw new InventoryRuleError("Salah satu barang tidak ditemukan di database.");
        }
        const masterMap = new Map(masterItems.map((item) => [item.id, item]));
        const existingMap = new Map(existingTxItems.map((item) => [item.itemId, item]));
        const ledgerRows = await tx.stockLedger.groupBy({
          by: ["itemId"],
          where: { itemId: { in: desiredIds } },
          _sum: { qty: true },
        });
        const ledgerMap = new Map(ledgerRows.map((row) => [row.itemId, row._sum.qty ?? 0]));
        const stockValidation = validateStockDemand(
          desiredItems.map((payloadItem) => {
            const item = masterMap.get(payloadItem.itemId)!;
            return {
              nama: item.nama,
              aktif: item.aktif,
              stokAwal: item.stokAwal,
              ledgerQty: ledgerMap.get(item.id) ?? 0,
              currentReservedQty: existingMap.get(item.id)?.qty ?? 0,
              requestedQty: payloadItem.qty,
            };
          })
        );
        if (!stockValidation.ok) {
          throw new InventoryRuleError(stockValidation.error);
        }

        for (const payloadItem of invoiceItems) {
          const matched = existingTxItems.find((x) => x.itemId === payloadItem.itemId);
          
          if (!matched) {
            if (payloadItem.qty <= 0) continue;
            const itemObj = masterMap.get(payloadItem.itemId);
            if (!itemObj) throw new InventoryRuleError("Barang tidak ditemukan di database.");

            const subtotal = new Prisma.Decimal(itemObj.hargaJual).mul(payloadItem.qty);
            await tx.transactionItem.create({
              data: {
                transactionId: txId,
                itemId: payloadItem.itemId,
                namaSnapshot: itemObj.nama,
                hargaSnapshot: itemObj.hargaJual,
                hargaBeliSnapshot: itemObj.hargaBeli,
                qty: payloadItem.qty,
                subtotal,
              },
            });

            await tx.stockLedger.create({
              data: {
                itemId: payloadItem.itemId,
                tipe: "KELUAR",
                qty: -payloadItem.qty,
                keterangan: `Penjualan POS (Koreksi) ${inv.noInvoice}`,
                refType: "TRANSACTION",
                refId: txId,
                userId: user.id,
              },
            });
            continue;
          }

          if (payloadItem.qty <= 0) {
            await tx.transactionItem.delete({
              where: { id: matched.id },
            });
            await tx.stockLedger.deleteMany({
              where: {
                itemId: payloadItem.itemId,
                refType: "TRANSACTION",
                refId: txId,
              },
            });
          } else {
            const newSubtotal = new Prisma.Decimal(matched.hargaSnapshot).mul(payloadItem.qty);
            await tx.transactionItem.update({
              where: { id: matched.id },
              data: {
                qty: payloadItem.qty,
                subtotal: newSubtotal,
              },
            });
            await tx.stockLedger.updateMany({
              where: {
                itemId: payloadItem.itemId,
                refType: "TRANSACTION",
                refId: txId,
              },
              data: {
                qty: -payloadItem.qty,
              },
            });
          }
        }

        const payloadItemIds = invoiceItems.map((x) => x.itemId);
        for (const extItem of existingTxItems) {
          if (!payloadItemIds.includes(extItem.itemId)) {
            await tx.transactionItem.delete({
              where: { id: extItem.id },
            });
            await tx.stockLedger.deleteMany({
              where: {
                itemId: extItem.itemId,
                refType: "TRANSACTION",
                refId: txId,
              },
            });
          }
        }

        const updatedItems = await tx.transactionItem.findMany({
          where: { transactionId: txId },
        });
        const newGrandTotal = updatedItems.reduce((acc, x) => acc.add(x.subtotal), new Prisma.Decimal(0));

        await tx.transaction.update({
          where: { id: txId },
          data: { grandTotal: newGrandTotal },
        });

        await tx.invoice.update({
          where: { id: val.id },
          data: { total: newGrandTotal },
        });
      }

      const updatedInv = await tx.invoice.findUnique({
        where: { id: val.id },
      });
      if (updatedInv) {
        const newTotal = Number(updatedInv.total);
        const totalDibayar = Number(updatedInv.totalDibayar);
        if (totalDibayar > newTotal) {
          throw new InvoiceRuleError(
            `Total invoice baru tidak boleh lebih kecil dari pembayaran yang sudah tercatat (Rp ${totalDibayar.toLocaleString("id-ID")}).`
          );
        }
        const lunas = totalDibayar >= newTotal;
        const nextStatus = lunas ? "LUNAS" : totalDibayar > 0 ? "PARTIAL" : "PENDING";
        await tx.invoice.update({
          where: { id: val.id },
          data: {
            status: nextStatus,
          },
        });
      }

      await logActivity({
        userId: user.id,
        aksi: "UPDATE_INVOICE_DAN_BARANG",
        entitas: "Invoice",
        entitasId: val.id,
        detail: { noInvoice: val.noInvoice, itemsCount: invoiceItems.length },
      }, tx);
    });
  } catch (e) {
    if (e instanceof InventoryRuleError || e instanceof InvoiceRuleError) return { error: e.message };
    return safeError(e, "Gagal mengubah rincian invoice.");
  }

  // Ledger rows changed: stock, dashboard, and cashier availability must refresh now (AUD-008).
  invalidateAfterCommit({ paths: ["/invoice", "/", "/stok", "/kasir", "/retur"], tags: ["stock"] });
  return { ok: true };
}
