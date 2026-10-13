"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { nextDocNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import { runSerializable } from "@/lib/serializable";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { dbId, money, qtyPositive, safeError } from "@/lib/validation";
import { invoiceStatusFor, isReceivedPayment, validateCheckoutTotals } from "@/lib/checkoutRules";
import { validateStockDemand } from "@/lib/inventoryRules";
import { createInvoiceVerifyUrl } from "@/lib/invoiceVerify";
import { afterCommit, invalidateAfterCommit } from "@/lib/postCommit";
import {
  findStoredResult,
  idempotencyKeySchema,
  IdempotencyMismatchError,
  recoverStoredResult,
  storeResult,
} from "@/lib/idempotency";

const itemSchema = z.object({
  itemId: dbId,
  qty: qtyPositive,
});

const paymentComponentSchema = z.object({
  tipe: z.enum(["CASH", "TRANSFER", "CREDIT"]),
  jumlah: money.refine((n) => n > 0, "Jumlah pembayaran harus lebih dari 0."),
});

const schema = z.object({
  tipe: z.enum(["RETAIL", "PROJECT"]),
  namaClient: z.string().trim().max(FIELD_LIMITS.namaClient, `Nama pelanggan maksimal ${FIELD_LIMITS.namaClient} karakter.`).optional().default(""),
  alamat: z.string().trim().max(FIELD_LIMITS.alamat, `Alamat maksimal ${FIELD_LIMITS.alamat} karakter.`).optional().default(""),
  namaWs: z.string().trim().max(FIELD_LIMITS.namaWs, `Nama workshop maksimal ${FIELD_LIMITS.namaWs} karakter.`).optional().default(""),
  projectNama: z.string().trim().max(FIELD_LIMITS.projectNama, `Nama proyek maksimal ${FIELD_LIMITS.projectNama} karakter.`).optional().default(""),
  projectGroupNama: z.string().trim().max(FIELD_LIMITS.projectGroupNama, `Grup proyek maksimal ${FIELD_LIMITS.projectGroupNama} karakter.`).optional().default(""),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CREDIT"]),
  // Info bank opsional (untuk transfer/kredit)
  namaBank: z.string().trim().max(FIELD_LIMITS.namaBank, `Nama bank maksimal ${FIELD_LIMITS.namaBank} karakter.`).optional().default(""),
  noRekening: z.string().trim().max(FIELD_LIMITS.noRekening, `No. rekening maksimal ${FIELD_LIMITS.noRekening} karakter.`).optional().default(""),
  atasNama: z.string().trim().max(FIELD_LIMITS.atasNama, `Atas nama maksimal ${FIELD_LIMITS.atasNama} karakter.`).optional().default(""),
  payments: z.array(paymentComponentSchema).optional().default([]),
  buatInvoice: z.boolean().optional().default(true),
  items: z.array(itemSchema).min(1, "Minimal 1 barang di keranjang."),
  idempotencyKey: idempotencyKeySchema,
}).refine((d) => {
  if (d.payments.length > 0) {
    const totalPayments = d.payments.reduce((sum, p) => sum + p.jumlah, 0);
    return totalPayments > 0;
  }
  return true;
}, { message: "Total pembayaran harus lebih dari 0." });

export type KasirPayload = z.infer<typeof schema>;

type CheckoutCommitted = {
  ok: true;
  id: number;
  noTransaksi: string;
  invoiceNo: string | null;
  grandTotal: number;
  totalDibayar: number;
  sisaTagihan: number;
};

export async function createTransaction(payload: KasirPayload) {
  const user = await requireRole("ADMIN_KASIR");

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  // Determine effective payments: if split payments provided, use them; else single method
  const effectivePayments = d.payments.length > 0
    ? d.payments
    : [{ tipe: d.paymentMethod, jumlah: 0 }]; // jumlah 0 means we don't know the amount yet

  let result;
  try {
    result = await runSerializable(async (tx) => {
      // Retry of an already committed checkout: return it instead of selling twice.
      const stored = await findStoredResult<CheckoutCommitted>(tx, d.idempotencyKey, "checkout", user.id);
      if (stored) return { ...stored, replayed: true };

      const uniqueIds = Array.from(new Set(d.items.map((item) => item.itemId)));
      const items = await tx.item.findMany({ where: { id: { in: uniqueIds } } });
      const itemMap = new Map(items.map((item) => [item.id, item]));
      if (items.length !== uniqueIds.length) {
        return { ok: false as const, error: "Ada barang yang tidak ditemukan di database." };
      }

      const checkoutValidation = validateCheckoutTotals({
        lines: d.items.map((line) => ({
          itemId: line.itemId,
          hargaJual: Number(itemMap.get(line.itemId)!.hargaJual),
          qty: line.qty,
        })),
        payments: effectivePayments,
        buatInvoice: d.buatInvoice,
      });
      if (!checkoutValidation.ok) {
        return { ok: false as const, error: checkoutValidation.error };
      }

      const ledgerRows = await tx.stockLedger.groupBy({
        by: ["itemId"],
        where: { itemId: { in: uniqueIds } },
        _sum: { qty: true },
      });
      const ledgerMap = new Map(ledgerRows.map((row) => [row.itemId, row._sum.qty ?? 0]));
      const stockValidation = validateStockDemand(
        d.items.map((line) => {
          const item = itemMap.get(line.itemId)!;
          return {
            nama: item.nama,
            aktif: item.aktif,
            stokAwal: item.stokAwal,
            ledgerQty: ledgerMap.get(item.id) ?? 0,
            requestedQty: line.qty,
          };
        })
      );
      if (!stockValidation.ok) {
        return { ok: false as const, error: stockValidation.error };
      }

      // 1. Dynamic Client creation or lookup if project/client name provided
      let clientId: number | null = null;
      if (d.namaClient) {
        const client = await tx.client.findFirst({
          where: { nama: d.namaClient },
        });
        if (client) {
          clientId = client.id;
        } else {
          const newClient = await tx.client.create({
            data: { nama: d.namaClient, alamat: d.alamat || null },
          });
          clientId = newClient.id;
        }
      }

      // 2. Dynamic Workshop creation or lookup
      let workshopId: number | null = null;
      if (d.namaWs) {
        const ws = await tx.workshop.findFirst({
          where: { nama: d.namaWs },
        });
        if (ws) {
          workshopId = ws.id;
        } else {
          const newWs = await tx.workshop.create({
            data: { nama: d.namaWs, alamat: d.alamat || null },
          });
          workshopId = newWs.id;
        }
      }

      // 3. Dynamic Project & Project Group creation or lookup
      let projectId: number | null = null;
      if (d.projectNama) {
        let projectGroupId: number | null = null;
        if (d.projectGroupNama) {
          const pg = await tx.projectGroup.findFirst({
            where: { nama: d.projectGroupNama },
          });
          if (pg) {
            projectGroupId = pg.id;
          } else {
            const newPg = await tx.projectGroup.create({
              data: { nama: d.projectGroupNama },
            });
            projectGroupId = newPg.id;
          }
        }

        const proj = await tx.project.findFirst({
          where: { nama: d.projectNama, projectGroupId },
        });
        if (proj) {
          projectId = proj.id;
        } else {
          const newProj = await tx.project.create({
            data: { nama: d.projectNama, projectGroupId },
          });
          projectId = newProj.id;
        }
      }

      // 4. Generate Order Code
      const noTransaksi = await nextDocNumber(tx, "transaksi");
      let grandTotal = new Prisma.Decimal(0);

      const trx = await tx.transaction.create({
        data: {
          noTransaksi,
          tipe: d.tipe,
          clientId,
          workshopId,
          projectId,
          namaClient: d.namaClient || null,
          alamat: d.alamat || null,
          namaWs: d.namaWs || null,
          // Simpan info bank hanya bila metode non-tunai (transfer/kredit/split)
          namaBank: d.paymentMethod !== "CASH" ? (d.namaBank || null) : null,
          noRekening: d.paymentMethod !== "CASH" ? (d.noRekening || null) : null,
          atasNama: d.paymentMethod !== "CASH" ? (d.atasNama || null) : null,
          userId: user.id,
          grandTotal: new Prisma.Decimal(0),
        },
      });

      // 5. Save Line items and deduct stock
      for (const line of d.items) {
        const it = itemMap.get(line.itemId)!;

        const baseSubtotal = new Prisma.Decimal(it.hargaJual).mul(line.qty);
        const subtotal = baseSubtotal;
        grandTotal = grandTotal.add(subtotal);

        await tx.transactionItem.create({
          data: {
            transactionId: trx.id,
            itemId: it.id,
            namaSnapshot: it.nama,
            hargaSnapshot: it.hargaJual,
            hargaBeliSnapshot: it.hargaBeli,
            qty: line.qty,
            subtotal,
          },
        });

        await tx.stockLedger.create({
          data: {
            itemId: it.id,
            tipe: "KELUAR",
            qty: -line.qty,
            keterangan: `Penjualan POS ${noTransaksi}`,
            refType: "TRANSACTION",
            refId: trx.id,
            userId: user.id,
          },
        });
      }

      // Update grandTotal on parent order
      await tx.transaction.update({
        where: { id: trx.id },
        data: { grandTotal },
      });

      // 6. Create Payment records for money actually received (CASH/TRANSFER).
      // CREDIT is an unpaid receivable: it stays as invoice remaining balance, not a Payment.
      const receivedPayments = effectivePayments.filter(isReceivedPayment);
      for (const payment of receivedPayments) {
        await tx.payment.create({
          data: {
            tipe: payment.tipe,
            jumlah: payment.jumlah,
            transactionId: trx.id,
            keterangan: `Pembayaran ${payment.tipe} untuk ${noTransaksi}`,
          },
        });
      }

      // 7. Conditional Invoice creation
      let invoiceNo: string | null = null;
      const totalDibayar = new Prisma.Decimal(checkoutValidation.totalPaid);
      if (d.buatInvoice || checkoutValidation.hasCredit) {
        invoiceNo = await nextDocNumber(tx, "invoice");
        const invoiceStatus = invoiceStatusFor(Number(grandTotal), Number(totalDibayar));

        const invoice = await tx.invoice.create({
          data: {
            noInvoice: invoiceNo,
            status: invoiceStatus,
            transactionId: trx.id,
            clientId,
            projectId,
            namaClient: d.namaClient || null,
            alamat: d.alamat || null,
            namaWs: d.namaWs || null,
            total: grandTotal,
            totalDibayar,
          },
        });

        // Link payments to invoice
        if (receivedPayments.length > 0) {
          await tx.payment.updateMany({
            where: { transactionId: trx.id, invoiceId: null },
            data: { invoiceId: invoice.id },
          });
        }
      }

      const sisaTagihan = Prisma.Decimal.max(grandTotal.sub(totalDibayar), 0);

      // Audit row commits atomically with the sale.
      await logActivity({
        userId: user.id,
        aksi: "CREATE_TRANSAKSI",
        entitas: "Transaction",
        entitasId: trx.id,
        detail: {
          noTransaksi,
          total: Number(grandTotal),
          tipe: d.tipe,
          paymentCount: effectivePayments.length,
          totalDibayar: Number(totalDibayar),
          piutangTempo: Number(sisaTagihan),
        },
      }, tx);

      const committed: CheckoutCommitted = {
        ok: true,
        id: trx.id,
        noTransaksi,
        invoiceNo,
        grandTotal: Number(grandTotal),
        totalDibayar: Number(totalDibayar),
        sisaTagihan: Number(sisaTagihan),
      };
      await storeResult(tx, d.idempotencyKey, "checkout", user.id, committed);
      return { ...committed, replayed: false };
    });
  } catch (error) {
    if (error instanceof IdempotencyMismatchError) return { error: error.message };
    // A concurrent request with the same key may have committed first.
    const recovered = await recoverStoredResult<CheckoutCommitted>(d.idempotencyKey, "checkout", user.id);
    if (!recovered) return safeError(error, "Terjadi kesalahan internal saat memproses checkout.");
    result = { ...recovered, replayed: true };
  }

  if (!result.ok) return { error: result.error };

  // Committed. Nothing below may turn this sale into a reported failure.
  invalidateAfterCommit({ paths: ["/", "/stok", "/kasir", "/invoice"], tags: ["stock"] });

  const invoiceNo = result.invoiceNo;
  const verifyUrl = invoiceNo
    ? await afterCommit("createInvoiceVerifyUrl", () => createInvoiceVerifyUrl(invoiceNo))
    : null;

  return {
    ok: true,
    id: result.id,
    noTransaksi: result.noTransaksi,
    invoiceNo: result.invoiceNo,
    grandTotal: result.grandTotal,
    totalDibayar: result.totalDibayar,
    sisaTagihan: result.sisaTagihan,
    verifyUrl,
    replayed: result.replayed,
  };
}
