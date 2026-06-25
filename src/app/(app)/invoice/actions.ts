"use server";

import { revalidatePath } from "next/cache";
import { Prisma, PaymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function bayarInvoice(invoiceId: number, jumlah: number, tipe: PaymentType = "CASH") {
  // Pembayaran/penagihan = domain kasir
  const user = await requireRole("ADMIN_KASIR");

  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { error: "Invoice tidak ditemukan." };
  if (jumlah <= 0) return { error: "Jumlah bayar harus lebih dari 0." };

  const sisa = Number(inv.total) - Number(inv.totalDibayar);
  const bayar = Math.min(jumlah, sisa);
  const totalDibayar = new Prisma.Decimal(inv.totalDibayar).add(bayar);
  const lunas = totalDibayar.gte(inv.total);

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
}
