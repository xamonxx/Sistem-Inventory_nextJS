"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { nextDocNumber } from "@/lib/counters";
import { logActivity } from "@/lib/activity";

const itemSchema = z.object({
  itemId: z.number().int(),
  qty: z.number().int().positive(),
  discount: z.number().min(0).default(0),
});

const paymentComponentSchema = z.object({
  tipe: z.enum(["CASH", "TRANSFER", "CREDIT"]),
  jumlah: z.number().positive(),
});

const schema = z.object({
  tipe: z.enum(["RETAIL", "PROJECT"]),
  namaClient: z.string().trim().optional().default(""),
  alamat: z.string().trim().optional().default(""),
  namaWs: z.string().trim().optional().default(""),
  projectNama: z.string().trim().optional().default(""),
  projectGroupNama: z.string().trim().optional().default(""),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CREDIT"]),
  payments: z.array(paymentComponentSchema).optional().default([]),
  buatInvoice: z.boolean().optional().default(true),
  items: z.array(itemSchema).min(1, "Minimal 1 barang di keranjang."),
}).refine((d) => {
  if (d.payments.length > 0) {
    const totalPayments = d.payments.reduce((sum, p) => sum + p.jumlah, 0);
    return totalPayments > 0;
  }
  return true;
}, { message: "Total pembayaran harus lebih dari 0." });

export type KasirPayload = z.infer<typeof schema>;

export async function createTransaction(payload: KasirPayload) {
  const user = await requireRole("ADMIN_KASIR");

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  // Verify item master availability
  const ids = d.items.map((i) => i.itemId);
  const items = await prisma.item.findMany({ where: { id: { in: ids } } });
  const itemMap = new Map(items.map((i) => [i.id, i]));
  if (items.length !== ids.length) {
    return { error: "Ada barang yang tidak ditemukan di database." };
  }

  // Determine effective payments: if split payments provided, use them; else single method
  const effectivePayments = d.payments.length > 0
    ? d.payments
    : [{ tipe: d.paymentMethod, jumlah: 0 }]; // jumlah 0 means we don't know the amount yet

  const totalCashTransfer = effectivePayments
    .filter((p) => p.tipe === "CASH" || p.tipe === "TRANSFER")
    .reduce((sum, p) => sum + p.jumlah, 0);

  const hasCredit = effectivePayments.some((p) => p.tipe === "CREDIT");

  try {
    const result = await prisma.$transaction(async (tx) => {
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
          userId: user.id,
          grandTotal: new Prisma.Decimal(0),
        },
      });

      // 5. Save Line items and deduct stock
      for (const line of d.items) {
        const it = itemMap.get(line.itemId)!;

        const baseSubtotal = new Prisma.Decimal(it.hargaJual).mul(line.qty);
        const subtotal = baseSubtotal.sub(line.discount);
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

      // 6. Create Payment records for split payments (BUG-002 fix)
      if (effectivePayments.length > 0 && effectivePayments[0].jumlah > 0) {
        for (const payment of effectivePayments) {
          await tx.payment.create({
            data: {
              tipe: payment.tipe as any,
              jumlah: payment.jumlah,
              transactionId: trx.id,
              keterangan: `Pembayaran ${payment.tipe} untuk ${noTransaksi}`,
            },
          });
        }
      }

      // 7. Conditional Invoice creation
      let invoiceNo: string | null = null;
      if (d.buatInvoice || hasCredit) {
        invoiceNo = await nextDocNumber(tx, "invoice");
        const totalDibayar = hasCredit ? new Prisma.Decimal(totalCashTransfer) : grandTotal;
        const invoiceStatus = hasCredit && totalDibayar.lessThan(grandTotal) ? "PENDING" : "LUNAS";

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
        if (effectivePayments.length > 0 && effectivePayments[0].jumlah > 0) {
          await tx.payment.updateMany({
            where: { transactionId: trx.id, invoiceId: null },
            data: { invoiceId: invoice.id },
          });
        }
      }

      return { id: trx.id, noTransaksi, invoiceNo, grandTotal: Number(grandTotal) };
    });

    await logActivity({
      userId: user.id,
      aksi: "CREATE_TRANSAKSI",
      entitas: "Transaction",
      entitasId: result.id,
      detail: { noTransaksi: result.noTransaksi, total: result.grandTotal, tipe: d.tipe, paymentCount: effectivePayments.length },
    });

    return { ok: true, ...result };
  } catch (error: any) {
    console.error("Kasir checkout error:", error);
    return { error: "Terjadi kesalahan internal saat memproses checkout." };
  }
}
