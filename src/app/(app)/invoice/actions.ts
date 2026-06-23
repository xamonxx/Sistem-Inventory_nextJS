"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function bayarInvoice(invoiceId: number, jumlah: number) {
  // Pembayaran/penagihan = domain kasir
  const user = await requireRole("ADMIN_KASIR");

  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { error: "Invoice tidak ditemukan." };
  if (jumlah <= 0) return { error: "Jumlah bayar harus lebih dari 0." };

  const sisa = Number(inv.total) - Number(inv.totalDibayar);
  const bayar = Math.min(jumlah, sisa);
  const totalDibayar = new Prisma.Decimal(inv.totalDibayar).add(bayar);
  const lunas = totalDibayar.gte(inv.total);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { totalDibayar, status: lunas ? "LUNAS" : "PENDING" },
  });

  await logActivity({
    userId: user.id,
    aksi: "BAYAR_INVOICE",
    entitas: "Invoice",
    entitasId: invoiceId,
    detail: { bayar, lunas },
  });

  revalidatePath("/invoice");
  return { ok: true };
}
