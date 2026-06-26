"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, PaymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { dbId, money, safeError, firstIssue } from "@/lib/validation";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

const bayarSchema = z.object({
  invoiceId: dbId,
  jumlah: money.refine((n) => n > 0, "Jumlah bayar harus lebih dari 0."),
  tipe: z.nativeEnum(PaymentType),
});

export async function bayarInvoice(invoiceId: number, jumlah: number, tipe: PaymentType = "CASH") {
  // Pembayaran/penagihan = domain kasir
  const user = await requireRole("ADMIN_KASIR");

  const parsed = bayarSchema.safeParse({ invoiceId, jumlah, tipe });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  ({ invoiceId, jumlah, tipe } = parsed.data);

  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { error: "Invoice tidak ditemukan." };

  const sisa = Number(inv.total) - Number(inv.totalDibayar);
  if (sisa <= 0) return { error: "Invoice ini sudah lunas." };
  const bayar = Math.min(jumlah, sisa);
  const totalDibayar = new Prisma.Decimal(inv.totalDibayar).add(bayar);
  const lunas = totalDibayar.gte(inv.total);

  try {
    const newPayment = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { totalDibayar, status: lunas ? "LUNAS" : "PENDING" },
      });

      return await tx.payment.create({
        data: {
          tipe,
          jumlah: bayar,
          invoiceId,
          keterangan: `Pembayaran cicilan untuk ${inv.noInvoice}`,
        },
      });
    });

    await logActivity({
      userId: user.id,
      aksi: "BAYAR_INVOICE",
      entitas: "Invoice",
      entitasId: invoiceId,
      detail: { bayar, lunas, tipe },
    });

    revalidatePath("/invoice");
    return {
      ok: true,
      payment: {
        id: newPayment.id,
        tanggal: newPayment.tanggal.toISOString(),
        tipe: newPayment.tipe,
        jumlah: Number(newPayment.jumlah),
        keterangan: newPayment.keterangan,
      },
    };
  } catch (e) {
    return safeError(e, "Gagal memproses pembayaran.");
  }
}

const updateInvoiceSchema = z.object({
  id: dbId,
  noInvoice: z.string().min(1, "Nomor invoice wajib diisi.").max(30, "Nomor invoice terlalu panjang."),
  tanggal: z.coerce.date(),
  namaClient: z.string().min(1, "Nama klien wajib diisi.").max(FIELD_LIMITS.namaClient, "Nama klien terlalu panjang."),
  alamat: z.string().max(FIELD_LIMITS.alamat, "Alamat terlalu panjang.").nullable().optional(),
  namaWs: z.string().max(FIELD_LIMITS.namaWs, "Nama workshop terlalu panjang.").nullable().optional(),
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
    await prisma.invoice.update({
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
    });

    revalidatePath("/invoice");
    return { ok: true };
  } catch (e) {
    return safeError(e, "Gagal mengubah invoice.");
  }
}

export async function deleteInvoice(id: number) {
  const user = await requireRole("ADMIN_KASIR");

  try {
    const inv = await prisma.invoice.findUnique({
      where: { id },
      select: { noInvoice: true, transactionId: true, returnId: true },
    });
    if (!inv) return { error: "Invoice tidak ditemukan." };

    await prisma.$transaction(async (tx) => {
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
    });

    await logActivity({
      userId: user.id,
      aksi: "HAPUS_INVOICE",
      entitas: "Invoice",
      entitasId: id,
      detail: { noInvoice: inv.noInvoice },
    });

    revalidatePath("/invoice");
    return { ok: true };
  } catch (e) {
    return safeError(e, "Gagal menghapus invoice.");
  }
}

export async function deleteInvoices(ids: number[]) {
  const user = await requireRole("ADMIN_KASIR");

  try {
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: ids } },
      select: { id: true, transactionId: true, returnId: true },
    });

    const transactionIds = invoices
      .map((inv) => inv.transactionId)
      .filter((id): id is number => id !== null);
    const directReturnIds = invoices
      .map((inv) => inv.returnId)
      .filter((id): id is number => id !== null);

    await prisma.$transaction(async (tx) => {
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
    });

    await logActivity({
      userId: user.id,
      aksi: "HAPUS_INVOICE_MASSAL",
      entitas: "Invoice",
      detail: { count: ids.length, ids },
    });

    revalidatePath("/invoice");
    return { ok: true };
  } catch (e) {
    return safeError(e, "Gagal menghapus beberapa invoice.");
  }
}

export async function updateInvoiceAndItems(
  id: number,
  metadata: {
    noInvoice: string;
    tanggal: Date | string;
    namaClient: string;
    alamat?: string | null;
    namaWs?: string | null;
  },
  itemsPayload: { itemId: number; qty: number }[]
) {
  const user = await requireRole("ADMIN_KASIR");

  const parsed = updateInvoiceSchema.safeParse({ id, ...metadata });
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

  const inv = await prisma.invoice.findUnique({
    where: { id: val.id },
    include: { transaction: true, return: true },
  });
  if (!inv) return { error: "Invoice tidak ditemukan." };

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

      if (inv.transactionId) {
        const txId = inv.transactionId;

        const existingTxItems = await tx.transactionItem.findMany({
          where: { transactionId: txId },
        });

        for (const payloadItem of itemsPayload) {
          const matched = existingTxItems.find((x) => x.itemId === payloadItem.itemId);
          
          if (!matched) {
            if (payloadItem.qty <= 0) continue;
            const itemObj = await tx.item.findUnique({ where: { id: payloadItem.itemId } });
            if (!itemObj) continue;

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

        const payloadItemIds = itemsPayload.map((x) => x.itemId);
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
        const newTotalDibayar = Math.min(Number(updatedInv.totalDibayar), newTotal);
        const lunas = newTotalDibayar >= newTotal;
        await tx.invoice.update({
          where: { id: val.id },
          data: {
            totalDibayar: newTotalDibayar,
            status: lunas ? "LUNAS" : "PENDING",
          },
        });
      }
    });

    await logActivity({
      userId: user.id,
      aksi: "UPDATE_INVOICE_DAN_BARANG",
      entitas: "Invoice",
      entitasId: val.id,
      detail: { noInvoice: val.noInvoice, itemsCount: itemsPayload.length },
    });

    revalidatePath("/invoice");
    return { ok: true };
  } catch (e) {
    return safeError(e, "Gagal mengubah rincian invoice.");
  }
}
